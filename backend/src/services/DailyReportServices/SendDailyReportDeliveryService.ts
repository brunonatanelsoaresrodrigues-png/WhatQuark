import { hostname } from "os";
import { Op } from "sequelize";
import sequelize from "../../database";
import DailyReportDelivery from "../../models/DailyReportDelivery";
import DailyReportRecipient from "../../models/DailyReportRecipient";
import DailyReportRun from "../../models/DailyReportRun";
import Whatsapp from "../../models/Whatsapp";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import { whatsappProvider } from "../../providers/WhatsApp";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import { DailyReportConfig } from "./config";

const workerId = `${hostname()}-${process.pid}`.slice(0, 64);

const safeError = (error: unknown): string =>
  (error instanceof Error ? error.message : "Unknown error")
    .replace(/\+?\d{10,15}/g, "[telefone mascarado]")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 500);

const retryDelayMinutes = (attempts: number): number =>
  [5, 15, 30, 60, 120][Math.min(attempts, 4)];

const claimDelivery = async (
  deliveryId?: number
): Promise<DailyReportDelivery | null> =>
  sequelize.transaction(async transaction => {
    const delivery = await DailyReportDelivery.findOne({
      where: {
        ...(deliveryId ? { id: deliveryId } : {}),
        status: { [Op.in]: ["PENDING", "FAILED_RETRY"] },
        nextAttemptAt: { [Op.lte]: new Date() }
      },
      order: [["nextAttemptAt", "ASC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true
    } as any);
    if (!delivery) return null;
    await delivery.update(
      {
        status: "PROCESSING",
        processingStartedAt: new Date(),
        workerId,
        attempts: delivery.attempts + 1
      },
      { transaction }
    );
    return delivery;
  });

const updateRunCompletion = async (reportRunId: number): Promise<void> => {
  const remaining = await DailyReportDelivery.count({
    where: {
      reportRunId,
      status: { [Op.in]: ["PENDING", "PROCESSING", "FAILED_RETRY"] }
    }
  });
  if (remaining === 0) {
    await DailyReportRun.update(
      { status: "COMPLETED", completedAt: new Date() },
      { where: { id: reportRunId } }
    );
  } else {
    await DailyReportRun.update(
      { status: "SENDING" },
      { where: { id: reportRunId, status: "GENERATED" } }
    );
  }
};

export const recoverDailyReportDeliveries = async (): Promise<void> => {
  const stale = new Date(Date.now() - 10 * 60 * 1000);
  const deliveries = await DailyReportDelivery.findAll({
    where: { status: "PROCESSING", processingStartedAt: { [Op.lt]: stale } }
  });

  for (const delivery of deliveries) {
    const run = await DailyReportRun.findByPk(delivery.reportRunId);
    const recoveredMessage =
      delivery.ticketId && run?.renderedBody && delivery.processingStartedAt
        ? await Message.findOne({
            where: {
              ticketId: delivery.ticketId,
              fromMe: true,
              body: run.renderedBody,
              createdAt: { [Op.gte]: delivery.processingStartedAt }
            },
            order: [["createdAt", "DESC"]]
          })
        : null;

    // Se o WhatsApp enviou antes de uma reinicialização, recuperamos o eco
    // persistido e evitamos duplicar o fechamento para o gestor.
    // eslint-disable-next-line no-await-in-loop
    await delivery.update(
      recoveredMessage
        ? {
            status: "SENT",
            messageId: recoveredMessage.id,
            sentAt: recoveredMessage.createdAt,
            processingStartedAt: null,
            workerId: null,
            lastError: null
          }
        : {
            status: "FAILED_RETRY",
            processingStartedAt: null,
            workerId: null,
            nextAttemptAt: new Date(),
            lastError: "Recovered stale delivery claim"
          }
    );
    // eslint-disable-next-line no-await-in-loop
    await updateRunCompletion(delivery.reportRunId);
  }
};

const SendDailyReportDeliveryService = async (
  config: DailyReportConfig,
  deliveryId?: number,
  allowInactiveRecipient = false
): Promise<boolean> => {
  const delivery = await claimDelivery(deliveryId);
  if (!delivery) return false;

  try {
    const [recipient, run, whatsapp] = await Promise.all([
      DailyReportRecipient.findByPk(delivery.recipientId),
      DailyReportRun.findByPk(delivery.reportRunId),
      Whatsapp.findByPk(delivery.whatsappId)
    ]);
    if (
      !recipient ||
      (!allowInactiveRecipient && !recipient.active) ||
      !recipient.verifiedAt
    ) {
      await delivery.update({
        status: "SUPPRESSED",
        lastError: "Recipient inactive or unverified",
        processingStartedAt: null,
        workerId: null
      });
      await updateRunCompletion(delivery.reportRunId);
      return true;
    }
    if (!run?.renderedBody) throw new Error("DAILY_REPORT_BODY_NOT_AVAILABLE");
    if (!whatsapp || whatsapp.status !== "CONNECTED") {
      throw new Error("DAILY_REPORT_WHATSAPP_NOT_CONNECTED");
    }
    if (!/^55\d{10,11}$/.test(recipient.phone)) {
      throw new Error("DAILY_REPORT_INVALID_RECIPIENT_PHONE");
    }

    const checked = await whatsappProvider.checkNumber(
      whatsapp.id,
      recipient.phone
    );
    const normalized = checked.replace(/\D/g, "");
    if (!normalized) throw new Error("DAILY_REPORT_NUMBER_NOT_ON_WHATSAPP");

    const contact = await CreateOrUpdateContactService({
      name: recipient.name,
      number: normalized,
      isGroup: false,
      isInternal: true
    });
    const activePatientTicket = await Ticket.findOne({
      where: {
        contactId: contact.id,
        whatsappId: whatsapp.id,
        status: { [Op.in]: ["open", "pending"] },
        ticketType: "PATIENT"
      }
    });
    if (activePatientTicket) {
      throw new Error("DAILY_REPORT_RECIPIENT_HAS_ACTIVE_PATIENT_TICKET");
    }
    const ticket = await FindOrCreateTicketService(
      contact,
      whatsapp.id,
      0,
      undefined,
      "INTERNAL_REPORT"
    );
    await delivery.update({ ticketId: ticket.id });
    const message = await SendWhatsAppMessage({
      body: run.renderedBody,
      ticket,
      origin: "DAILY_REPORT",
      policy: { proactive: true, idempotencyKey: `daily-report:${delivery.id}` }
    });
    await delivery.update({
      status: "SENT",
      ticketId: ticket.id,
      messageId: message.id,
      sentAt: new Date(),
      processingStartedAt: null,
      workerId: null,
      lastError: null
    });
    await updateRunCompletion(delivery.reportRunId);
    return true;
  } catch (error) {
    const deadLetter = delivery.attempts >= config.maxRetryAttempts;
    const delayMinutes = retryDelayMinutes(delivery.attempts - 1);
    await delivery.update({
      status: deadLetter ? "DEAD_LETTER" : "FAILED_RETRY",
      nextAttemptAt: new Date(Date.now() + delayMinutes * 60 * 1000),
      processingStartedAt: null,
      workerId: null,
      lastError: safeError(error)
    });
    await updateRunCompletion(delivery.reportRunId);
    return true;
  }
};

export default SendDailyReportDeliveryService;
