import { hostname } from "os";
import { Op } from "sequelize";
import sequelize from "../../database";
import QuarkAppointmentNotification from "../../models/QuarkAppointmentNotification";
import QuarkAppointment from "../../models/QuarkAppointment";
import { logger } from "../../utils/logger";
import { QuarkConfig } from "./config";
import SendQuarkWhatsAppMessage from "./SendQuarkWhatsAppMessage";
import { QuarkOutboxPayload } from "./notificationLedger";
import { quietHoursDelayMs, randomSendIntervalMs } from "./workerTiming";
import { emitQuarkDashboardUpdate } from "./dashboardEvents";

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

const claimNextNotification = async (): Promise<
  QuarkAppointmentNotification | undefined
> =>
  sequelize.transaction(async transaction => {
    const notification = await QuarkAppointmentNotification.findOne({
      where: {
        status: { [Op.in]: ["PENDING", "FAILED_RETRY"] },
        nextAttemptAt: { [Op.lte]: new Date() }
      },
      order: [["createdAt", "ASC"]],
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

const processNotification = async (
  config: QuarkConfig,
  notification: QuarkAppointmentNotification
): Promise<void> => {
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

    const payload = parsePayload(notification);
    if (!payload.phone) throw new Error("QUARK_PERMANENT_INVALID_PHONE");
    if (
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
    const attempts = notification.attempts + 1;
    const lastError = sanitizeError(error);
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

const runWorker = async (config: QuarkConfig): Promise<void> => {
  if (workerStopped) return;
  let nextDelay = config.workerPollIntervalMs;

  try {
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
  await recoverStuckNotifications(config);
  triggerWorker(config, 1000);
};

export const StopQuarkNotificationWorker = async (): Promise<void> => {
  workerStopped = true;
  if (workerTimer) clearTimeout(workerTimer);
  workerTimer = undefined;
  if (activeWorkerRun) await activeWorkerRun;
};
