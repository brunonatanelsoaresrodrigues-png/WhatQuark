import { registerMessageAttribution } from "../MessageServices/MessageAttributionService";
import { MessageOrigin } from "../../models/MessageAttribution";
import persistCloudOutbound from "./persistCloudOutbound";
import { Op } from "sequelize";
import OutboundMessage from "../../models/OutboundMessage";
import User from "../../models/User";
import Contact from "../../models/Contact";
import { canAccessTicket } from "../../helpers/TicketAccessPolicy";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { getQuarkConfig } from "../QuarkClinicServices/config";
import { getQuarkAppointment } from "../QuarkClinicServices/QuarkClinicClient";
import { weekdayInTimezone } from "../QuarkClinicServices/reminderTiming";
import { buildAppointmentSnapshot } from "../QuarkClinicServices/appointmentUtils";
import QuarkAppointment from "../../models/QuarkAppointment";
import AppError from "../../errors/AppError";
import {
  ProviderMediaInput,
  ProviderMessage,
  SendMediaOptions,
  SendMessageOptions
} from "../../providers/WhatsApp/types";
import { assertExecution, inServiceWindow, SendPolicy } from "./policy";
import { getPreference } from "./preferences";
import { digest, readState, withLease } from "./state";
import { logger } from "../../utils/logger";

interface Transport {
  sendMessage(
    id: number,
    to: string,
    body: string,
    options?: SendMessageOptions
  ): Promise<ProviderMessage>;
  sendMedia(
    id: number,
    to: string,
    media: ProviderMediaInput,
    options?: SendMediaOptions
  ): Promise<ProviderMessage>;
}
interface Payload {
  to: string;
  body?: string;
  media?: {
    filename: string;
    mimetype: string;
    path?: string;
    base64?: string;
  };
  options: SendMessageOptions & SendMediaOptions;
}
const persistAccepted = async (
  result: ProviderMessage,
  payload: Payload
): Promise<void> => {
  await registerMessageAttribution(result.id, {
    origin: (payload.options.policy?.origin || "SYSTEM") as MessageOrigin,
    sentByUserId: payload.options.policy?.sentByUserId || null
  });
  if (process.env.WHATSAPP_PROVIDER === "cloud")
    await persistCloudOutbound(result, payload);
};
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const positive = (value: string | undefined, fallback: number) =>
  Number(value) > 0 ? Number(value) : fallback;
const codeOf = (error: unknown) =>
  error instanceof Error ? error.message : "ERR_SEND_UNKNOWN";
let timer: NodeJS.Timeout | undefined;
let active: Promise<void> | undefined;
let stopping = false;
const inFlightRuns = new Set<Promise<void>>();

export const validateSend = async (
  whatsappId: number,
  phone: string,
  policy: SendPolicy
): Promise<void> => {
  await assertExecution(phone);
  const channel = await Whatsapp.findByPk(whatsappId);
  if (channel?.status !== "CONNECTED")
    throw new AppError("ERR_CHANNEL_DISCONNECTED", 409);
  if (!/^\d{8,15}$/.test(phone))
    throw new AppError("ERR_INVALID_RECIPIENT", 400);
  if (
    policy.expiresAt &&
    (!Number.isFinite(Date.parse(policy.expiresAt)) ||
      Date.parse(policy.expiresAt) <= Date.now())
  )
    throw new AppError("ERR_MESSAGE_EXPIRED", 409);
  const lastInbound = await readState<string | null>(
    `inbound-time:${whatsappId}:${phone}`,
    null
  );
  const windowOpen = inServiceWindow(lastInbound);
  const preference = await getPreference(phone);
  if ((policy.proactive || !windowOpen) && preference.consent !== "GRANTED")
    throw new AppError(
      preference.consent === "REVOKED"
        ? "ERR_RECIPIENT_OPTED_OUT"
        : "ERR_CONSENT_REQUIRED",
      409
    );
  if (
    process.env.WHATSAPP_PROVIDER === "cloud" &&
    !windowOpen &&
    !policy.template
  )
    throw new AppError("ERR_APPROVED_TEMPLATE_REQUIRED", 409);
  if (policy.proactive) {
    if (
      policy.sendOnlyOnWeekday !== undefined &&
      weekdayInTimezone(
        new Date(),
        process.env.QUARK_TIMEZONE || "America/Sao_Paulo"
      ) !== policy.sendOnlyOnWeekday
    )
      throw new AppError("ERR_NOTICE_WEEKDAY_EXPIRED", 409);
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: process.env.QUARK_TIMEZONE || "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    } as any).format(new Date());
    const start = process.env.QUARK_QUIET_HOURS_START || "20:00";
    const end = process.env.QUARK_QUIET_HOURS_END || "08:00";
    if (
      start !== end &&
      (start > end ? time >= start || time < end : time >= start && time < end)
    )
      throw new AppError("ERR_QUIET_HOURS", 429);
  }
  if (policy.ticketId) {
    const ticket = await Ticket.findByPk(policy.ticketId);
    if (!ticket || ticket.whatsappId !== whatsappId)
      throw new AppError("ERR_TICKET_CHANGED", 409);
    if (
      policy.botEventId &&
      (await readState(`bot-current-event:${ticket.id}`, "")) !==
        policy.botEventId
    )
      throw new AppError("ERR_BOT_STALE_REPLY", 409);
    if (
      policy.bot &&
      (ticket.userId ||
        ticket.status === "closed" ||
        (!policy.allowPausedBot &&
          (await readState(`bot-pause:${ticket.id}`, false))))
    )
      throw new AppError("ERR_BOT_PAUSED", 409);
    if (
      Object.prototype.hasOwnProperty.call(policy, "expectedQueueId") &&
      (ticket.queueId || null) !== policy.expectedQueueId
    )
      throw new AppError("ERR_TICKET_CHANGED", 409);
    const contact = await Contact.findByPk(ticket.contactId);
    if (!contact || contact.number !== phone)
      throw new AppError("ERR_TICKET_CHANGED", 409);
    if (policy.origin === "HUMAN") {
      const actor = policy.sentByUserId
        ? await User.findByPk(policy.sentByUserId, { include: ["queues"] })
        : null;
      if (
        !actor ||
        !canAccessTicket(actor, ticket) ||
        ticket.status !== "open" ||
        (actor.profile !== "admin" && ticket.userId !== actor.id)
      )
        throw new AppError("ERR_TICKET_CHANGED", 409);
    }
    if (
      policy.origin === "INACTIVITY" &&
      (!ticket.awaitingPatientSince || ticket.status !== "open")
    )
      throw new AppError("ERR_TICKET_CHANGED", 409);
  }
  if (policy.appointmentId) {
    await assertExecution(phone, true);
    const appointment = await QuarkAppointment.findOne({
      where: { appointmentId: policy.appointmentId }
    });
    const statuses = policy.allowCancelledAppointment
      ? ["CANCELADO", "CANCELADO_VIA_SMS", "EXCLUIDO"]
      : policy.allowConfirmedAppointment
      ? ["AGENDADO", "CONFIRMADO"]
      : ["AGENDADO"];
    const operation = await readState(
      `quark-operation:${policy.appointmentId}`,
      { status: "READY" }
    );
    if (["UNKNOWN", "PROCESSING"].includes(operation.status))
      throw new AppError("ERR_QUARK_REVIEW_REQUIRED", 409);
    if (
      !appointment ||
      appointment.phone !== phone ||
      !statuses.includes(appointment.status) ||
      (policy.scheduleFingerprint &&
        appointment.scheduleFingerprint !== policy.scheduleFingerprint)
    )
      throw new AppError("ERR_APPOINTMENT_CHANGED", 409);
    const config = getQuarkConfig();
    const current = buildAppointmentSnapshot(
      await getQuarkAppointment(config, policy.appointmentId),
      config
    );
    if (
      current.phone !== phone ||
      !statuses.includes(current.status) ||
      current.scheduleFingerprint !== policy.scheduleFingerprint
    )
      throw new AppError("ERR_APPOINTMENT_CHANGED", 409);
  }
};

const runOutbound = async (transport: Transport): Promise<void> => {
  // A crash after transport acceptance is not evidence that delivery failed.
  await OutboundMessage.update(
    { status: "UNKNOWN", errorCode: "ERR_SEND_OUTCOME_UNKNOWN" },
    {
      where: {
        status: "PROCESSING",
        attemptedAt: { [Op.lt]: new Date(Date.now() - 15 * 60000) }
      }
    }
  );
  const accepted = await OutboundMessage.findAll({
    where: {
      status: "UNKNOWN",
      messageId: { [Op.ne]: "" },
      result: { [Op.ne]: "" }
    },
    limit: 10
  });
  for (const row of accepted) {
    if (!row.messageId || !row.result) continue;
    try {
      await persistAccepted(JSON.parse(row.result), JSON.parse(row.payload));
      await row.update({ status: "SENT", errorCode: null });
    } catch {
      /* Accepted message is never sent again, only local persistence is retried. */
    }
  }
  const candidates = await OutboundMessage.findAll({
    where: { status: "PENDING", dueAt: { [Op.lte]: new Date() } },
    order: [
      ["priority", "DESC"],
      ["createdAt", "ASC"]
    ],
    limit: 10
  });
  for (const candidate of candidates) {
    if (stopping) return;
    try {
      await withLease(`outbound-channel:${candidate.whatsappId}`, () =>
        withLease(`outbound-recipient:${candidate.recipient}`, async () => {
          const row = await OutboundMessage.findByPk(candidate.id);
          if (!row || row.status !== "PENDING") return;
          const payload = JSON.parse(row.payload) as Payload;
          const policy = payload.options.policy || {};
          if (
            policy.expiresAt &&
            (!Number.isFinite(Date.parse(policy.expiresAt)) ||
              Date.parse(policy.expiresAt) <= Date.now())
          ) {
            await row.update({
              status: "BLOCKED",
              errorCode: "ERR_MESSAGE_EXPIRED",
              finishedAt: new Date()
            });
            return;
          }
          const recent = {
            whatsappId: row.whatsappId,
            attemptedAt: { [Op.gte]: new Date(Date.now() - 3600000) }
          };
          const limit = positive(process.env.MESSAGING_MAX_PER_HOUR, 100);
          if ((await OutboundMessage.count({ where: recent })) >= limit) {
            await row.update({ dueAt: new Date(Date.now() + 60000) });
            return;
          }
          const latest = await OutboundMessage.findOne({
            where: {
              whatsappId: row.whatsappId,
              attemptedAt: { [Op.gte]: new Date(0) }
            },
            order: [["attemptedAt", "DESC"]]
          });
          const gap =
            positive(process.env.MESSAGING_MIN_INTERVAL_SECONDS, 2) * 1000;
          if (
            latest?.attemptedAt &&
            Date.now() - latest.attemptedAt.getTime() < gap
          )
            return;
          if (policy.proactive) {
            const previous = await OutboundMessage.findAll({
              where: {
                recipient: row.recipient,
                attemptedAt: { [Op.gte]: new Date(Date.now() - 24 * 3600000) }
              }
            });
            const notices = previous.filter(
              item => JSON.parse(item.payload).options?.policy?.proactive
            );
            if (
              notices.length >=
              positive(process.env.MESSAGING_MAX_NOTICES_PER_DAY, 3)
            ) {
              await row.update({ dueAt: new Date(Date.now() + 3600000) });
              return;
            }
            if (
              notices.some(
                item =>
                  item.attemptedAt &&
                  Date.now() - item.attemptedAt.getTime() < 3600000
              )
            ) {
              await row.update({ dueAt: new Date(Date.now() + 60000) });
              return;
            }
          }
          const deliver = async () => {
            if (stopping) return;
            try {
              await validateSend(row.whatsappId, row.recipient, policy);
            } catch (error) {
              const code = codeOf(error);
              if (
                [
                  "ERR_MESSAGING_PAUSED",
                  "ERR_QUIET_HOURS",
                  "ERR_CHANNEL_DISCONNECTED"
                ].includes(code)
              )
                await row.update({
                  dueAt: new Date(Date.now() + 60000),
                  errorCode: code
                });
              else
                await row.update({
                  status: "BLOCKED",
                  finishedAt: new Date(),
                  errorCode: code
                });
              return;
            }
            if (stopping) return;
            await row.update({
              status: "PROCESSING",
              attemptedAt: new Date(),
              errorCode: null
            });
            try {
              payload.options.policy = { ...policy, outboundId: row.id };
              const send =
                row.kind === "text"
                  ? transport.sendMessage(
                      row.whatsappId,
                      payload.to,
                      payload.body || "",
                      payload.options
                    )
                  : transport.sendMedia(
                      row.whatsappId,
                      payload.to,
                      {
                        ...payload.media!,
                        data: payload.media?.base64
                          ? Buffer.from(payload.media.base64, "base64")
                          : undefined
                      },
                      payload.options
                    );
              let timeout: NodeJS.Timeout | undefined;
              const result = await Promise.race([
                send,
                new Promise<never>((_, reject) => {
                  timeout = setTimeout(
                    () => reject(new Error("ERR_SEND_OUTCOME_UNKNOWN")),
                    60000
                  );
                })
              ]).finally(() => {
                if (timeout) clearTimeout(timeout);
              });
              await row.update({
                status: "SENT",
                finishedAt: new Date(),
                messageId: result.id,
                result: JSON.stringify(result)
              });
              await persistAccepted(result, payload);
            } catch (error) {
              // Do not retry exceptions from transport or post-send storage automatically.
              await row.update({
                status: "UNKNOWN",
                errorCode: "ERR_SEND_OUTCOME_UNKNOWN",
                finishedAt: new Date()
              });
              logger.error({
                info: "Outbound send requires reconciliation",
                outboundId: row.id
              });
            }
          };
          if (policy.appointmentId)
            await withLease(
              `quark-appointment:${policy.appointmentId}`,
              deliver
            );
          else await deliver();
        })
      );
    } catch (error) {
      if (codeOf(error) !== "ERR_OPERATION_BUSY")
        logger.error({
          info: "Outbound dispatcher failed",
          outboundId: candidate.id,
          errorCode: codeOf(error)
        });
    }
  }
};

export const processOutbound = (transport: Transport): Promise<void> => {
  if (stopping) return Promise.resolve();
  const run = runOutbound(transport);
  inFlightRuns.add(run);
  void run.finally(() => inFlightRuns.delete(run)).catch(() => undefined);
  return run;
};

export const enqueueOutbound = async (
  transport: Transport,
  whatsappId: number,
  to: string,
  body: string | ProviderMediaInput,
  options: SendMessageOptions & SendMediaOptions = {}
): Promise<ProviderMessage> => {
  if (stopping) throw new AppError("ERR_SHUTTING_DOWN", 503);
  const phone = to.split("@")[0];
  const policy = options.policy || {};
  const payload: Payload = { to, options };
  if (to.endsWith("@g.us")) throw new AppError("ERR_INVALID_RECIPIENT", 400);
  if (typeof body === "string") payload.body = body;
  else
    payload.media = {
      filename: body.filename,
      mimetype: body.mimetype,
      path: body.path,
      base64: body.data?.toString("base64")
    };
  const identity =
    policy.idempotencyKey ||
    `${Math.floor(Date.now() / 300000)}:${digest(JSON.stringify(payload))}`;
  const id = digest(`${whatsappId}:${phone}:${identity}`);
  let row = await OutboundMessage.findByPk(id);
  if (!row) {
    await validateSend(whatsappId, phone, policy);
    [row] = await OutboundMessage.findOrCreate({
      where: { id },
      defaults: {
        id,
        whatsappId,
        recipient: phone,
        kind: typeof body === "string" ? "text" : "media",
        payload: JSON.stringify(payload),
        status: "PENDING",
        priority: policy.origin === "HUMAN" ? 10 : policy.proactive ? 1 : 5,
        dueAt: new Date()
      }
    });
  }
  // Works before the periodic loop starts too; all processes share channel leases.
  void processOutbound(transport).catch(() => undefined);
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await row.reload();
    if (row.status === "SENT" && row.result) return JSON.parse(row.result);
    if (["UNKNOWN", "BLOCKED", "FAILED"].includes(row.status))
      throw new AppError(row.errorCode || "ERR_SEND_OUTCOME_UNKNOWN", 409);
    await delay(250);
  }
  throw new AppError("ERR_MESSAGE_QUEUED", 202);
};
export const startDispatcher = (transport: Transport): void => {
  if (timer) return;
  stopping = false;
  timer = setInterval(() => {
    if (!active)
      active = processOutbound(transport)
        .catch(error =>
          logger.error({
            info: "Dispatcher cycle failed",
            errorCode: codeOf(error)
          })
        )
        .finally(() => {
          active = undefined;
        });
  }, 1000);
  timer.unref();
};
export const stopDispatcher = async (): Promise<void> => {
  stopping = true;
  if (timer) clearInterval(timer);
  timer = undefined;
  await Promise.all(
    Array.from(inFlightRuns).map(run => run.catch(() => undefined))
  );
};
