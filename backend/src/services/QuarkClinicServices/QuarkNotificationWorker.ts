import { hostname } from "os";
import { Op } from "sequelize";
import sequelize from "../../database";
import QuarkAppointmentNotification from "../../models/QuarkAppointmentNotification";
import OutboundMessage from "../../models/OutboundMessage";
import Whatsapp from "../../models/Whatsapp";
import { digest } from "../MessagingServices/state";
import QuarkAppointment from "../../models/QuarkAppointment";
import { logger } from "../../utils/logger";
import { QuarkConfig } from "./config";
import SendQuarkWhatsAppMessage from "./SendQuarkWhatsAppMessage";
import { QuarkOutboxPayload } from "./notificationLedger";
import { quietHoursDelayMs, randomSendIntervalMs } from "./workerTiming";
import { assertExecution } from "../MessagingServices/policy";
import {
  formatAppointmentDateTime,
  quarkPhoneVariants
} from "./appointmentUtils";
import { removeLegacyConfirmationCodes } from "./messageTemplates";
import { emitQuarkDashboardUpdate } from "./dashboardEvents";
import {
  isSameDayReschedule,
  quarkNotificationExpiresAt
} from "./notificationPolicy";

const workerId = `${hostname()}-${process.pid}`.slice(0, 64);
let workerTimer: NodeJS.Timeout | undefined;
let workerStopped = true;
let activeWorkerRun: Promise<void> | undefined;

const triggerWorker = (config: QuarkConfig, delay: number): void => {
  workerTimer = setTimeout(() => {
    activeWorkerRun = runWorker(config).finally(() => {
      activeWorkerRun = undefined;
    });
  }, delay);
  workerTimer.unref();
};

export const claimNextNotification = async (): Promise<
  QuarkAppointmentNotification | undefined
> =>
  sequelize.transaction(async transaction => {
    const notification = await QuarkAppointmentNotification.findOne({
      where: {
        status: { [Op.in]: ["PENDING", "FAILED_RETRY"] },
        nextAttemptAt: { [Op.lte]: new Date() }
      },
      order: [
        ["priorityAt", "ASC"],
        ["nextAttemptAt", "ASC"],
        ["createdAt", "ASC"]
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true
    } as any);

    if (!notification) return undefined;
    await notification.update(
      {
        status: "PROCESSING",
        processingStartedAt: new Date(),
        workerId
      },
      { transaction }
    );
    return notification;
  });

const sanitizeError = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : "Unknown send error";
  return raw.replace(/[\r\n]+/g, " ").slice(0, 500);
};

const isPermanentError = (message: string): boolean =>
  message.includes("PERMANENT") ||
  message.includes("ERR_NUMBER_NOT_ON_WHATSAPP") ||
  message.includes("Configured WhatsApp") ||
  message.includes("Unexpected outbox payload");

const retryDelayMs = (attempts: number): number => {
  const exponential = Math.min(60 * 60 * 1000, 60000 * 2 ** (attempts - 1));
  return exponential + Math.floor(Math.random() * 14001) + 1000;
};

export const recoverStuckNotifications = async (
  config: QuarkConfig
): Promise<void> => {
  const threshold = new Date(Date.now() - config.processingTimeoutMs);
  if (config.whatsappId) {
    const uncertain = await QuarkAppointmentNotification.findAll({
      where: {
        [Op.or]: [
          { status: "UNKNOWN" },
          { status: "FAILED_RETRY", lastError: "ERR_MESSAGE_QUEUED" }
        ]
      },
      order: [["updatedAt", "ASC"]],
      limit: 100
    });
    for (const notice of uncertain) {
      try {
        const outboundIds = quarkPhoneVariants(
          notice.recipientPhone || "",
          config.defaultCountryCode
        ).map(phone =>
          digest(`${config.whatsappId}:${phone}:quark-notice:${notice.id}`)
        );
        const rows = outboundIds.length
          ? await OutboundMessage.findAll({
              where: { id: { [Op.in]: outboundIds } },
              order: [["updatedAt", "DESC"]]
            })
          : [];
        const row =
          rows.find(item => item.status === "SENT" && item.messageId) ||
          rows[0];
        if (!row) {
          // The worker stopped after claiming the notice but before the
          // durable central queue entry was created. Nothing can have been
          // delivered, so retrying is safe and prevents a stranded UNKNOWN.
          if (notice.status === "UNKNOWN")
            await notice.update({
              status: "PENDING",
              nextAttemptAt: new Date(),
              processingStartedAt: null,
              workerId: null,
              lastError: null
            });
          continue;
        }

        if (row.status === "SENT" && row.messageId) {
          const payload = JSON.parse(notice.payload) as QuarkOutboxPayload;
          const sentAt = row.finishedAt || row.updatedAt || new Date();
          await notice.update({
            status: "SENT",
            messageId: row.messageId,
            sentAt,
            processingStartedAt: null,
            workerId: null,
            lastError: null
          });
          if (payload.requestsConfirmation && payload.scheduleFingerprint)
            await QuarkAppointment.update(
              {
                awaitingConfirmation: true,
                confirmationRequestedAt: sentAt
              },
              {
                where: {
                  appointmentId: notice.appointmentId,
                  status: "AGENDADO",
                  scheduleFingerprint: payload.scheduleFingerprint
                }
              }
            );
          continue;
        }

        if (row.status === "PENDING") {
          const minimumRetryAt = new Date(
            Date.now() + Math.max(5 * 60 * 1000, config.sendIntervalMaxMs || 0)
          );
          await notice.update({
            status: "FAILED_RETRY",
            nextAttemptAt:
              row.dueAt && row.dueAt > minimumRetryAt
                ? row.dueAt
                : minimumRetryAt,
            processingStartedAt: null,
            workerId: null,
            lastError: "ERR_MESSAGE_QUEUED"
          });
          continue;
        }

        if (["PROCESSING", "UNKNOWN"].includes(row.status)) {
          await notice.update({
            status: "UNKNOWN",
            processingStartedAt: null,
            workerId: null,
            lastError: row.errorCode || "ERR_SEND_OUTCOME_UNKNOWN"
          });
          continue;
        }

        if (["BLOCKED", "FAILED"].includes(row.status)) {
          const outboundError = row.errorCode || "ERR_OUTBOUND_BLOCKED";
          await notice.update({
            status: isPermanentError(outboundError)
              ? "DEAD_LETTER"
              : "SUPPRESSED",
            processingStartedAt: null,
            workerId: null,
            lastError: outboundError
          });
        }
      } catch (error) {
        logger.warn({
          info: "Queued Quark notification could not be reconciled",
          notificationId: notice.id,
          err: error
        });
      }
    }
  }
  const [count] = await QuarkAppointmentNotification.update(
    {
      status: "UNKNOWN",
      nextAttemptAt: new Date(),
      processingStartedAt: null,
      workerId: null,
      lastError: "ERR_SEND_OUTCOME_UNKNOWN"
    },
    {
      where: {
        status: "PROCESSING",
        processingStartedAt: { [Op.lt]: threshold }
      }
    }
  );
  if (count > 0) {
    logger.warn({
      info: "Quark notifications require reconciliation after worker timeout",
      count
    });
  }
};

const hourlyLimitReached = async (config: QuarkConfig): Promise<boolean> => {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const count = await QuarkAppointmentNotification.count({
    where: { status: "SENT", sentAt: { [Op.gte]: since } }
  });
  return count >= config.maxMessagesPerHour;
};

const parsePayload = (notification: QuarkAppointmentNotification) => {
  const payload = JSON.parse(notification.payload) as QuarkOutboxPayload;
  if (
    typeof payload?.body !== "string" ||
    typeof payload?.patientName !== "string"
  ) {
    throw new Error("Unexpected outbox payload");
  }
  return payload;
};

export const processNotification = async (
  config: QuarkConfig,
  notification: QuarkAppointmentNotification
): Promise<void> => {
  let accepted = false;
  try {
    const newerNotification = await QuarkAppointmentNotification.findOne({
      where: {
        appointmentId: notification.appointmentId,
        recipientPhone: notification.recipientPhone,
        id: { [Op.gt]: notification.id },
        status: {
          [Op.in]: ["PENDING", "PROCESSING", "FAILED_RETRY", "SENT"]
        }
      }
    });
    if (newerNotification) {
      await notification.update({
        status: "SUPPRESSED",
        processingStartedAt: null,
        workerId: null,
        lastError: "Superseded by a newer appointment notification"
      });
      return;
    }

    if (["CREATED", "UPDATED", "RESCHEDULED"].includes(notification.eventType)) {
      await notification.update({
        status: "SUPPRESSED",
        processingStartedAt: null,
        workerId: null,
        lastError: "Confirmation notices are sent only in reminder windows"
      });
      return;
    }

    const payload = parsePayload(notification);
    if (!payload.phone) throw new Error("QUARK_PERMANENT_INVALID_PHONE");
    if (!payload.scheduleFingerprint)
      throw new Error("ERR_LEGACY_NOTICE_REVIEW_REQUIRED");
    await assertExecution(payload.phone, true);
    const notificationExpiresAt = quarkNotificationExpiresAt(
      notification.eventType,
      payload.validUntil,
      notification.createdAt,
      config.timezone
    );
    if (
      notificationExpiresAt &&
      new Date(notificationExpiresAt).getTime() <= Date.now()
    ) {
      await notification.update({
        status: "SUPPRESSED",
        processingStartedAt: null,
        workerId: null,
        lastError: "Notification expired after the appointment time"
      });
      return;
    }

    if (
      config.testAllowlist.length > 0 &&
      !config.testAllowlist.includes(payload.phone)
    ) {
      await notification.update({
        status: "PENDING",
        nextAttemptAt: new Date(Date.now() + 60 * 60 * 1000),
        processingStartedAt: null,
        workerId: null,
        lastError: "Paused by test allowlist"
      });
      return;
    }

    const record = await QuarkAppointment.findOne({
      where: { appointmentId: notification.appointmentId }
    });
    if (!record || record.scheduleFingerprint !== payload.scheduleFingerprint)
      throw new Error("ERR_APPOINTMENT_CHANGED");
    const stored = JSON.parse(record.snapshot || "{}");
    const sameDayReschedule = isSameDayReschedule(
      notification.eventType,
      record.scheduledAt,
      notification.createdAt,
      config.timezone
    );
    const templateName =
      notification.eventType === "CANCELLED"
        ? process.env.CLOUD_QUARK_CANCELLED_TEMPLATE
        : process.env.CLOUD_QUARK_APPOINTMENT_TEMPLATE;
    const dates = formatAppointmentDateTime(record.scheduledAt);
    const parameters = [
      dates.date,
      dates.time,
      String(stored.clinicaNome || "nossa clínica")
    ];
    const sentMessage = await SendQuarkWhatsAppMessage(
      config,
      payload.phone,
      payload.patientName,
      removeLegacyConfirmationCodes(payload.body),
      {
        idempotencyKey: `quark-notice:${notification.id}`,
        proactive: true,
        appointmentNotice: true,
        appointmentId: notification.appointmentId,
        scheduleFingerprint: payload.scheduleFingerprint,
        expiresAt: notificationExpiresAt || undefined,
        allowCancelledAppointment: notification.eventType === "CANCELLED",
        allowConfirmedAppointment: notification.eventType === "RESCHEDULED",
        allowSameDayRescheduledAppointment: sameDayReschedule,
        allowAppointmentPhoneVariants: true,
        sendOnlyOnWeekday: payload.sendOnlyOnWeekday,
        template: templateName
          ? {
              name: templateName,
              language: process.env.CLOUD_TEMPLATE_LANGUAGE || "pt_BR",
              parameters
            }
          : undefined
      }
    );
    accepted = true;
    await notification.update({
      status: "SENT",
      sentAt: new Date(),
      processingStartedAt: null,
      workerId: null,
      lastError: null,
      messageId: sentMessage.messageId,
      ticketId: sentMessage.ticketId
    });
    if (payload.requestsConfirmation) {
      await QuarkAppointment.update(
        {
          awaitingConfirmation: true,
          confirmationRequestedAt: new Date()
        },
        {
          where: {
            appointmentId: notification.appointmentId,
            status: "AGENDADO",
            scheduleFingerprint: payload.scheduleFingerprint
          }
        }
      );
    }
    logger.info({
      info: "QuarkClinic notification sent",
      notificationId: notification.id,
      appointmentId: notification.appointmentId,
      eventType: notification.eventType
    });
    emitQuarkDashboardUpdate("notification", notification.id);
  } catch (error) {
    const lastError = sanitizeError(error);
    const unknown =
      accepted ||
      lastError === "ERR_SEND_OUTCOME_UNKNOWN" ||
      lastError === "ERR_LOCAL_PERSISTENCE_PENDING";
    const waiting = [
      "ERR_MESSAGE_QUEUED",
      "ERR_MESSAGING_PAUSED",
      "ERR_QUIET_HOURS",
      "ERR_CHANNEL_DISCONNECTED",
      "QUARK_TEMPORARY_WHATSAPP_DISCONNECTED",
      "ERR_OPERATION_BUSY"
    ].includes(lastError);
    const deadLetter = isPermanentError(lastError);
    // Only known, pre-send deferrals can be retried. The central ledger uses the same key.
    await notification.update({
      status: unknown
        ? "UNKNOWN"
        : waiting
        ? "FAILED_RETRY"
        : deadLetter
        ? "DEAD_LETTER"
        : "SUPPRESSED",
      attempts: notification.attempts + (waiting ? 0 : 1),
      nextAttemptAt: new Date(
        Date.now() +
          (lastError === "ERR_MESSAGE_QUEUED"
            ? Math.max(5 * 60 * 1000, config.sendIntervalMaxMs)
            : 60000)
      ),
      processingStartedAt: null,
      workerId: null,
      lastError
    });
    logger.warn({
      info: "Quark notification paused or blocked",
      notificationId: notification.id,
      errorCode: lastError
    });
    emitQuarkDashboardUpdate("notification", notification.id);
  }
};

const runWorker = async (config: QuarkConfig): Promise<void> => {
  if (workerStopped) return;
  let nextDelay = config.workerPollIntervalMs;

  try {
    await recoverStuckNotifications(config);
    // Do not consume queued notices while the current unofficial API reconnects.
    if (
      !config.whatsappId ||
      (await Whatsapp.findByPk(config.whatsappId))?.status !== "CONNECTED"
    )
      return;
    const quietDelay = quietHoursDelayMs(config);
    if (quietDelay > 0) {
      nextDelay = Math.min(quietDelay, 15 * 60 * 1000);
    } else if (await hourlyLimitReached(config)) {
      nextDelay = 60 * 1000;
    } else {
      const notification = await claimNextNotification();
      if (notification) {
        await processNotification(config, notification);
        nextDelay = randomSendIntervalMs(config);
      }
    }
  } catch (error) {
    logger.error({
      info: "QuarkClinic notification worker failed",
      err: error
    });
  } finally {
    if (!workerStopped) {
      triggerWorker(config, nextDelay);
    }
  }
};

export const StartQuarkNotificationWorker = async (
  config: QuarkConfig
): Promise<void> => {
  if (config.dryRun) {
    logger.warn(
      "QuarkClinic worker is paused because QUARK_DRY_RUN is enabled"
    );
    return;
  }
  if (!workerStopped) return;

  workerStopped = false;
  triggerWorker(config, 1000);
};

export const StopQuarkNotificationWorker = async (): Promise<void> => {
  workerStopped = true;
  if (workerTimer) clearTimeout(workerTimer);
  workerTimer = undefined;
  if (activeWorkerRun) await activeWorkerRun;
};
