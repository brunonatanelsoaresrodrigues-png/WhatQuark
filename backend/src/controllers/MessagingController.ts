import { appointmentSnapshotFrom } from "../services/QuarkClinicServices/EnqueueManualQuarkReminderService";
import { manualReminderAppointmentMessage } from "../services/QuarkClinicServices/messageTemplates";
import { Request, Response } from "express";
import { Op } from "sequelize";
import AppError from "../errors/AppError";
import OutboundMessage from "../models/OutboundMessage";
import QuarkAppointment from "../models/QuarkAppointment";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import {
  messagingStatus,
  inServiceWindow
} from "../services/MessagingServices/policy";
import {
  getPreference,
  setPreference
} from "../services/MessagingServices/preferences";
import {
  readState,
  writeState,
  withLease
} from "../services/MessagingServices/state";
import { getTicketInactivityConfig } from "../services/TicketInactivityServices/config";
import {
  appointmentReference,
  buildAppointmentSnapshot
} from "../services/QuarkClinicServices/appointmentUtils";
import { getQuarkConfig } from "../services/QuarkClinicServices/config";
import { getQuarkAppointment } from "../services/QuarkClinicServices/QuarkClinicClient";
import QuarkAppointmentResponse from "../models/QuarkAppointmentResponse";
import AutomationState from "../models/AutomationState";
import ListContactAppointmentsService from "../services/QuarkClinicServices/ListContactAppointmentsService";

export const status = async (_req: Request, res: Response) =>
  res.json(await messagingStatus());
export const pause = async (req: Request, res: Response) => {
  if (typeof req.body.paused !== "boolean")
    throw new AppError("ERR_INVALID_PAUSE", 400);
  await writeState("messaging:paused", req.body.paused);
  await AutomationState.create({
    id: `pause-audit:${Date.now()}:${req.user.id}`,
    data: JSON.stringify({ paused: req.body.paused, actorUserId: req.user.id })
  });
  return res.json(await messagingStatus());
};
export const outbox = async (_req: Request, res: Response) =>
  res.json(
    await OutboundMessage.findAll({
      attributes: [
        "id",
        "whatsappId",
        "recipient",
        "status",
        "errorCode",
        "createdAt",
        "attemptedAt",
        "messageId"
      ],
      where: {
        status: { [Op.in]: ["PENDING", "UNKNOWN", "BLOCKED", "FAILED"] }
      },
      order: [["createdAt", "DESC"]],
      limit: 100
    })
  );
export const context = async (req: Request, res: Response) => {
  const ticket = await ShowTicketService(req.params.ticketId);
  const phone = ticket.contact.number;
  const lastInboundAt = await readState<string | null>(
    `inbound-time:${ticket.whatsappId}:${phone}`,
    null
  );
  const appointmentContext = await ListContactAppointmentsService({ phone });
  const config = getTicketInactivityConfig();
  const pending = await OutboundMessage.findAll({
    where: {
      recipient: phone,
      whatsappId: ticket.whatsappId,
      status: {
        [Op.in]: ["PENDING", "PROCESSING", "UNKNOWN", "BLOCKED", "FAILED"]
      }
    },
    attributes: ["id", "status", "errorCode", "createdAt"],
    order: [["createdAt", "DESC"]],
    limit: 10
  });
  return res.json({
    ...(await messagingStatus()),
    outbound: pending,
    automationReview: await readState(`bot-review:${ticket.id}`, null),
    preference: await getPreference(phone),
    botPaused:
      !!ticket.userId || (await readState(`bot-pause:${ticket.id}`, false)),
    lastInboundAt,
    serviceWindowOpen: inServiceWindow(lastInboundAt),
    inactivityEnabled: config.enabled,
    inactivityTimeoutMinutes: config.timeoutMinutes,
    ...appointmentContext
  });
};
export const preference = async (req: Request, res: Response) => {
  const { consent, evidence, relationship } = req.body;
  if (
    !["GRANTED", "REVOKED"].includes(consent) ||
    typeof evidence !== "string" ||
    evidence.trim().length < 10 ||
    evidence.length > 500 ||
    typeof relationship !== "string" ||
    !relationship.trim() ||
    relationship.length > 100
  )
    throw new AppError("ERR_CONSENT_EVIDENCE_REQUIRED", 400);
  const ticket = await ShowTicketService(req.params.ticketId);
  return res.json(
    await setPreference(
      ticket.contact.number,
      consent,
      evidence.trim(),
      Number(req.user.id),
      relationship.trim()
    )
  );
};
export const bot = async (req: Request, res: Response) => {
  if (typeof req.body.paused !== "boolean")
    throw new AppError("ERR_INVALID_PAUSE", 400);
  await writeState(`bot-pause:${req.params.ticketId}`, req.body.paused);
  return res.json({ paused: req.body.paused });
};
export const reconcileQuark = async (req: Request, res: Response) => {
  const appointmentId = req.params.appointmentId;
  return withLease(`quark-appointment:${appointmentId}`, async () => {
    const operation = await readState<any>(
      `quark-operation:${appointmentId}`,
      {}
    );
    if (!["UNKNOWN", "PROCESSING"].includes(operation.status))
      throw new AppError("ERR_NO_PENDING_RECONCILIATION", 409);
    const config = getQuarkConfig();
    if (process.env.QUARK_INTEGRATION_ENABLED !== "true")
      throw new AppError("ERR_QUARK_DISABLED", 409);
    const remote = buildAppointmentSnapshot(
      await getQuarkAppointment(config, appointmentId),
      config
    );
    if (remote.status !== operation.desired)
      throw new AppError("ERR_QUARK_REVIEW_REQUIRED", 409);
    await QuarkAppointment.update(
      {
        status: remote.status,
        awaitingConfirmation: false,
        confirmationRequestedAt: null
      },
      { where: { appointmentId } }
    );
    if (operation.auditId)
      await QuarkAppointmentResponse.update(
        {
          status: "SUCCESS",
          newQuarkStatus: remote.status,
          appliedAt: new Date(),
          errorCode: null
        },
        { where: { id: operation.auditId } }
      );
    await writeState(`quark-operation:${appointmentId}`, {
      ...operation,
      status: "APPLIED",
      reconciledBy: req.user.id,
      reconciledAt: new Date().toISOString()
    });
    return res.json({ status: remote.status });
  });
};

export const reminderPreview = async (req: Request, res: Response) => {
  const record = await QuarkAppointment.findOne({
    where: { appointmentId: req.params.appointmentId }
  });
  if (!record || !record.phone)
    throw new AppError("ERR_APPOINTMENT_CHANGED", 409);
  const ref = appointmentReference(
    record.appointmentId,
    record.scheduleFingerprint,
    record.phone
  );
  const body = `${manualReminderAppointmentMessage(
    appointmentSnapshotFrom(record)
  )}\n\nPara confirmar: CONFIRMAR ${ref}\nPara solicitar cancelamento: CANCELAR ${ref}\n\nPara deixar de receber avisos, responda PARAR.`;
  return res.json({
    phone: record.phone,
    fingerprint: record.scheduleFingerprint,
    body
  });
};
