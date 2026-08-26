import { hostname } from "os";
import { literal, Op } from "sequelize";
import sequelize from "../../database";
import QuarkAppointmentNotification from "../../models/QuarkAppointmentNotification";
import QuarkAppointment from "../../models/QuarkAppointment";
import { logger } from "../../utils/logger";
import { QuarkConfig } from "./config";
import SendQuarkWhatsAppMessage from "./SendQuarkWhatsAppMessage";
import { QuarkOutboxPayload } from "./notificationLedger";
import { quietHoursDelayMs, randomSendIntervalMs } from "./workerTiming";
import { emitQuarkDashboardUpdate } from "./dashboardEvents";
import { weekdayInTimezone } from "./reminderTiming";
import {
  appointmentStillMatchesNotification,
  quarkNotificationCanBeSent
} from "./notificationPolicy";
import { quarkWhatsAppIsConnected } from "./QuarkWhatsAppConnectionGuard";

const workerId = `${hostname()}-${process.pid}`.slice(0, 64);
const DISCONNECTED_ERROR = "QUARK_TEMPORARY_WHATSAPP_DISCONNECTED";
const DISCONNECTED_POLL_INTERVAL_MS = 30 * 1000;
let workerTimer: NodeJS.Timeout | undefined;
let workerStopped = true;
let activeWorkerRun: Promise<void> | undefined;
let lastWhatsAppConnected: boolean | undefined;
let connectionPauseLogged = false;

export const quarkNotificationFamilyKey = (notificationKey: string): string =>
  notificationKey.replace(/:to:[^:]+$/, "");

const triggerWorker = (config: QuarkConfig, delay: number): void => {
  workerTimer = setTimeout(() => {
    activeWorkerRun = runWorker(config).finally(() => {
      activeWorkerRun = undefined;
    });
  }, delay);
  workerTimer.unref();
};

const claimNextNotification = async (
  recoveryQuotaReached: boolean
): Promise<QuarkAppointmentNotification | undefined> =>
  sequelize.transaction(async transaction => {
    const notification = await QuarkAppointmentNotification.findOne({
      where: {
        status: { [Op.in]: ["PENDING", "FAILED_RETRY"] },
        nextAttemptAt: { [Op.lte]: new Date() },
        ...(recoveryQuotaReached
          ? { eventType: { [Op.ne]: "COVERAGE_RECOVERY" } }
          : {})
      },
      order: [
        [literal("CASE WHEN `priorityAt` IS NULL THEN 1 ELSE 0 END"), "ASC"],
        ["priorityAt", "ASC"],
        [
          literal(
            "CASE `eventType` WHEN 'CANCELLED' THEN 0 WHEN 'REMINDER' THEN 1 WHEN 'MANUAL_REMINDER' THEN 2 WHEN 'RESCHEDULED' THEN 3 WHEN 'CREATED' THEN 4 WHEN 'COVERAGE_RECOVERY' THEN 5 ELSE 6 END"
          ),
          "ASC"
        ],
        ["createdAt", "ASC"],
        ["id", "ASC"]
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

const recoverStuckNotifications = async (
  config: QuarkConfig
): Promise<void> => {
  const threshold = new Date(Date.now() - config.processingTimeoutMs);
  const [count] = await QuarkAppointmentNotification.update(
    {
      status: "FAILED_RETRY",
      nextAttemptAt: new Date(),
      processingStartedAt: null,
      workerId: null,
      lastError: "Recovered after worker timeout"
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
      info: "Recovered stuck QuarkClinic outbox notifications",
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

const recoveryHourlyLimitReached = async (
  config: QuarkConfig
): Promise<boolean> => {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const count = await QuarkAppointmentNotification.count({
    where: {
      eventType: "COVERAGE_RECOVERY",
      status: "SENT",
      sentAt: { [Op.gte]: since }
    }
  });
  return (
    count >=
    Math.min(config.maxRecoveryMessagesPerHour, config.maxMessagesPerHour)
  );
};

export const recoverDisconnectedNotifications = async (): Promise<number> => {
  const [count] = await QuarkAppointmentNotification.update(
    {
      status: "FAILED_RETRY",
      attempts: 0,
      nextAttemptAt: new Date(),
      processingStartedAt: null,
      workerId: null,
      lastError: "Requeued after WhatsApp reconnection"
    },
    {
      where: {
        status: "DEAD_LETTER",
        lastError: DISCONNECTED_ERROR
      }
    }
  );
  return count;
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

const suppressIfFamilyAlreadySent = async (
  notification: QuarkAppointmentNotification
): Promise<boolean> => {
  const familyKey = quarkNotificationFamilyKey(notification.notificationKey);
  const sentSibling = await QuarkAppointmentNotification.findOne({
    where: {
      appointmentId: notification.appointmentId,
      id: { [Op.ne]: notification.id },
      notificationKey: { [Op.like]: `${familyKey}:to:%` },
      status: "SENT"
    },
    attributes: ["id"]
  });
  if (!sentSibling) return false;

  await notification.update({
    status: "SUPPRESSED",
    processingStartedAt: null,
    workerId: null,
    lastError: "Same appointment notification already sent to another phone"
  });
  return true;
};

const deferForRecipientCooldown = async (
  config: QuarkConfig,
  notification: QuarkAppointmentNotification,
  phone: string
): Promise<boolean> => {
  const since = new Date(Date.now() - config.recipientCooldownMs);
  const recent = await QuarkAppointmentNotification.findOne({
    where: {
      recipientPhone: phone,
      status: "SENT",
      sentAt: { [Op.gte]: since }
    },
    attributes: ["sentAt"],
    order: [["sentAt", "DESC"]]
  });
  if (!recent?.sentAt) return false;

  await notification.update({
    status: "PENDING",
    nextAttemptAt: new Date(
      Math.max(
        Date.now() + 1000,
        recent.sentAt.getTime() + config.recipientCooldownMs
      )
    ),
    processingStartedAt: null,
    workerId: null,
    lastError: "Deferred by per-recipient anti-spam cooldown"
  });
  return true;
};

export const processNotification = async (
  config: QuarkConfig,
  notification: QuarkAppointmentNotification
): Promise<void> => {
  try {
    if (!quarkNotificationCanBeSent(notification.eventType)) {
      await notification.update({
        status: "SUPPRESSED",
        processingStartedAt: null,
        workerId: null,
        lastError: "Blocked by reminder-only outbound policy"
      });
      return;
    }

    if (await suppressIfFamilyAlreadySent(notification)) return;

    const newerNotification = await QuarkAppointmentNotification.findOne({
      where: {
        appointmentId: notification.appointmentId,
        recipientPhone: notification.recipientPhone,
        id: { [Op.gt]: notification.id },
        ...(notification.eventType === "RESCHEDULED"
          ? { eventType: "RESCHEDULED" }
          : {}),
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

    const payload = parsePayload(notification);
    if (!payload.phone) throw new Error("QUARK_PERMANENT_INVALID_PHONE");

    const currentAppointment = await QuarkAppointment.findOne({
      where: { appointmentId: notification.appointmentId },
      attributes: ["status", "scheduledAt"]
    });
    if (
      !currentAppointment ||
      !appointmentStillMatchesNotification(
        currentAppointment.status,
        currentAppointment.scheduledAt,
        payload.validUntil,
        notification.eventType
      )
    ) {
      await notification.update({
        status: "SUPPRESSED",
        processingStartedAt: null,
        workerId: null,
        lastError: "Appointment is no longer scheduled as notified"
      });
      return;
    }

    if (
      notification.eventType !== "CANCELLED" &&
      payload.validUntil &&
      new Date(payload.validUntil).getTime() <= Date.now()
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
      payload.sendOnlyOnWeekday !== undefined &&
      weekdayInTimezone(new Date(), config.timezone) !==
        payload.sendOnlyOnWeekday
    ) {
      await notification.update({
        status: "SUPPRESSED",
        processingStartedAt: null,
        workerId: null,
        lastError: "Notification expired outside its permitted weekday"
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

    if (await deferForRecipientCooldown(config, notification, payload.phone)) {
      return;
    }

    const sentMessage = await SendQuarkWhatsAppMessage(
      config,
      payload.phone,
      payload.patientName,
      payload.body
    );
    await notification.update({
      status: "SENT",
      sentAt: new Date(),
      processingStartedAt: null,
      workerId: null,
      lastError: null,
      messageId: sentMessage.messageId,
      ticketId: sentMessage.ticketId
    });
    const familyKey = quarkNotificationFamilyKey(notification.notificationKey);
    await QuarkAppointmentNotification.update(
      {
        status: "SUPPRESSED",
        processingStartedAt: null,
        workerId: null,
        lastError: "Same appointment notification sent to another phone"
      },
      {
        where: {
          appointmentId: notification.appointmentId,
          id: { [Op.ne]: notification.id },
          notificationKey: { [Op.like]: `${familyKey}:to:%` },
          status: { [Op.in]: ["PENDING", "FAILED_RETRY"] }
        }
      }
    );
    if (payload.requestsConfirmation) {
      await QuarkAppointment.update(
        {
          awaitingConfirmation: true,
          confirmationRequestedAt: new Date()
        },
        { where: { appointmentId: notification.appointmentId } }
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
    if (lastError === DISCONNECTED_ERROR) {
      lastWhatsAppConnected = false;
      await notification.update({
        status: "PENDING",
        attempts: notification.attempts,
        nextAttemptAt: new Date(Date.now() + DISCONNECTED_POLL_INTERVAL_MS),
        processingStartedAt: null,
        workerId: null,
        lastError
      });
      if (!connectionPauseLogged) {
        logger.error({
          info: "QuarkClinic notification queue paused because WhatsApp is disconnected",
          whatsappId: config.whatsappId || "default"
        });
        connectionPauseLogged = true;
      }
      emitQuarkDashboardUpdate("notification", notification.id);
      return;
    }

    const attempts = notification.attempts + 1;
    const deadLetter =
      isPermanentError(lastError) || attempts >= config.maxRetryAttempts;
    await notification.update({
      status: deadLetter ? "DEAD_LETTER" : "FAILED_RETRY",
      attempts,
      nextAttemptAt: deadLetter
        ? notification.nextAttemptAt
        : new Date(Date.now() + retryDelayMs(attempts)),
      processingStartedAt: null,
      workerId: null,
      lastError
    });
    logger[deadLetter ? "error" : "warn"]({
      info: deadLetter
        ? "QuarkClinic notification moved to dead letter"
        : "QuarkClinic notification scheduled for retry",
      notificationId: notification.id,
      appointmentId: notification.appointmentId,
      attempts,
      errorCode: lastError
    });
    emitQuarkDashboardUpdate("notification", notification.id);
  }
};

export const runQuarkNotificationWorkerCycle = async (
  config: QuarkConfig
): Promise<number> => {
  let nextDelay = config.workerPollIntervalMs;

  const connected = await quarkWhatsAppIsConnected(config);
  if (!connected) {
    lastWhatsAppConnected = false;
    if (!connectionPauseLogged) {
      logger.error({
        info: "QuarkClinic notification queue paused because WhatsApp is disconnected",
        whatsappId: config.whatsappId || "default"
      });
      connectionPauseLogged = true;
    }
    return DISCONNECTED_POLL_INTERVAL_MS;
  }

  if (lastWhatsAppConnected !== true) {
    const recovered = await recoverDisconnectedNotifications();
    logger.warn({
      info: "QuarkClinic notification queue resumed after WhatsApp reconnection",
      whatsappId: config.whatsappId || "default",
      disconnectedDeadLettersRequeued: recovered
    });
  }
  lastWhatsAppConnected = true;
  connectionPauseLogged = false;

  const quietDelay = quietHoursDelayMs(config);
  if (quietDelay > 0) {
    return Math.min(quietDelay, 15 * 60 * 1000);
  }
  if (await hourlyLimitReached(config)) {
    return 60 * 1000;
  }

  const recoveryQuotaReached = await recoveryHourlyLimitReached(config);
  const notification = await claimNextNotification(recoveryQuotaReached);
  if (notification) {
    await processNotification(config, notification);
    nextDelay = randomSendIntervalMs(config);
  } else if (recoveryQuotaReached) {
    nextDelay = 60 * 1000;
  }

  return nextDelay;
};

const runWorker = async (config: QuarkConfig): Promise<void> => {
  if (workerStopped) return;
  let nextDelay = config.workerPollIntervalMs;

  try {
    nextDelay = await runQuarkNotificationWorkerCycle(config);
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
  lastWhatsAppConnected = undefined;
  connectionPauseLogged = false;
  await recoverStuckNotifications(config);
  triggerWorker(config, 1000);
};

export const StopQuarkNotificationWorker = async (): Promise<void> => {
  workerStopped = true;
  if (workerTimer) clearTimeout(workerTimer);
  workerTimer = undefined;
  if (activeWorkerRun) await activeWorkerRun;
};
