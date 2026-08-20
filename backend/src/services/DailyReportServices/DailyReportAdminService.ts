import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import DailyReportDelivery from "../../models/DailyReportDelivery";
import DailyReportRecipient from "../../models/DailyReportRecipient";
import DailyReportRun from "../../models/DailyReportRun";
import DailyReportRecipientEvent from "../../models/DailyReportRecipientEvent";
import Whatsapp from "../../models/Whatsapp";
import { whatsappProvider } from "../../providers/WhatsApp";
import SendDailyReportDeliveryService from "./SendDailyReportDeliveryService";
import DailyReportMetricsService from "./DailyReportMetricsService";
import RenderDailyReportService from "./RenderDailyReportService";
import { getDailyReportConfig } from "./config";
import { reportWindowFor } from "./time";
import { buildDailyReportCsv, maskManagerPhone } from "./privacy";

const digitsOnly = (value: string): string => value.replace(/\D/g, "");

const recipientView = (recipient: DailyReportRecipient) => ({
  id: recipient.id,
  name: recipient.name,
  phone: maskManagerPhone(recipient.phone),
  active: recipient.active,
  verifiedAt: recipient.verifiedAt,
  createdAt: recipient.createdAt,
  updatedAt: recipient.updatedAt
});

const recordRecipientEvent = async (
  recipient: DailyReportRecipient,
  eventType: string,
  actorUserId: number,
  metadata: Record<string, unknown> = {}
): Promise<void> => {
  await DailyReportRecipientEvent.create({
    recipientId: recipient.id,
    performedByUserId: actorUserId,
    eventType,
    metadata: JSON.stringify({
      ...metadata,
      name: recipient.name,
      phone: maskManagerPhone(recipient.phone),
      active: recipient.active,
      verified: Boolean(recipient.verifiedAt)
    }),
    occurredAt: new Date()
  });
};

export const dailyReportOverview = async () => {
  const config = getDailyReportConfig();
  const window = reportWindowFor(
    new Date(),
    config.timezone,
    config.reportTime
  );
  const [whatsapp, recipients, runs] = await Promise.all([
    config.whatsappId ? Whatsapp.findByPk(config.whatsappId) : null,
    DailyReportRecipient.findAll({ order: [["name", "ASC"]] }),
    DailyReportRun.findAll({
      limit: 31,
      order: [["reportDate", "DESC"]],
      include: [
        {
          model: DailyReportDelivery,
          as: "deliveries",
          include: [{ model: DailyReportRecipient, as: "recipient" }]
        }
      ]
    })
  ]);

  return {
    config: {
      enabled: config.enabled,
      testMode: config.testMode,
      reportTime: config.reportTime,
      timezone: config.timezone,
      allowWeekends: config.allowWeekends,
      sendIntervalSeconds: config.sendIntervalSeconds,
      whatsapp: whatsapp
        ? { id: whatsapp.id, name: whatsapp.name, status: whatsapp.status }
        : null,
      reportDate: window.reportDate,
      dueToday: window.due
    },
    recipients: recipients.map(recipientView),
    runs: runs.map(run => ({
      id: run.id,
      reportDate: run.reportDate,
      runType: run.runType,
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
      status: run.status,
      dataFreshness: run.dataFreshness,
      generatedAt: run.generatedAt,
      completedAt: run.completedAt,
      lastError: run.lastError,
      deliveries: (run.deliveries || []).map(delivery => ({
        id: delivery.id,
        recipientId: delivery.recipientId,
        recipientName: delivery.recipient?.name || "Gestor",
        recipientPhone: delivery.recipient
          ? maskManagerPhone(delivery.recipient.phone)
          : "****",
        status: delivery.status,
        attempts: delivery.attempts,
        sentAt: delivery.sentAt,
        deliveredAt: delivery.deliveredAt,
        readAt: delivery.readAt,
        lastError: delivery.lastError
      }))
    }))
  };
};

export const createDailyReportRecipient = async (
  data: {
    name: string;
    phone: string;
  },
  actorUserId: number
) => {
  const name = data.name.trim();
  const phone = digitsOnly(data.phone);
  if (name.length < 2 || name.length > 120) {
    throw new AppError("Nome do gestor inválido.", 400);
  }
  if (!/^55\d{10,11}$/.test(phone)) {
    throw new AppError("Informe o telefone com DDI 55, DDD e número.", 400);
  }
  const existing = await DailyReportRecipient.findOne({ where: { phone } });
  if (existing) throw new AppError("Este telefone já está cadastrado.", 409);
  const recipient = await DailyReportRecipient.create({
    name,
    phone,
    active: false,
    verifiedAt: null
  });
  await recordRecipientEvent(recipient, "CREATED", actorUserId);
  return recipientView(recipient);
};

export const updateDailyReportRecipient = async (
  id: number,
  data: { name?: string; active?: boolean },
  actorUserId: number
) => {
  const recipient = await DailyReportRecipient.findByPk(id);
  if (!recipient) throw new AppError("Destinatário não encontrado.", 404);
  const values: Record<string, unknown> = {};
  if (data.name !== undefined) {
    const name = data.name.trim();
    if (name.length < 2 || name.length > 120) {
      throw new AppError("Nome do gestor inválido.", 400);
    }
    values.name = name;
  }
  if (data.active !== undefined) {
    if (data.active && !recipient.verifiedAt) {
      throw new AppError(
        "Valide o WhatsApp antes de ativar o destinatário.",
        409
      );
    }
    values.active = data.active;
  }
  const previous = { name: recipient.name, active: recipient.active };
  await recipient.update(values);
  await recordRecipientEvent(recipient, "UPDATED", actorUserId, { previous });
  return recipientView(recipient);
};

export const verifyDailyReportRecipient = async (
  id: number,
  actorUserId: number
) => {
  const config = getDailyReportConfig();
  if (!config.whatsappId) {
    throw new AppError(
      "Configure o canal do relatório antes da validação.",
      409
    );
  }
  const [recipient, whatsapp] = await Promise.all([
    DailyReportRecipient.findByPk(id),
    Whatsapp.findByPk(config.whatsappId)
  ]);
  if (!recipient) throw new AppError("Destinatário não encontrado.", 404);
  if (!whatsapp || whatsapp.status !== "CONNECTED") {
    throw new AppError("O canal configurado não está conectado.", 409);
  }
  const checked = await whatsappProvider.checkNumber(
    whatsapp.id,
    recipient.phone
  );
  if (!checked.replace(/\D/g, "")) {
    throw new AppError("O telefone não foi localizado no WhatsApp.", 409);
  }
  await recipient.update({ verifiedAt: new Date() });
  await recordRecipientEvent(recipient, "VERIFIED", actorUserId);
  return recipientView(recipient);
};

export const generateDailyReportPreview = async () => {
  const config = getDailyReportConfig();
  const now = new Date();
  const window = reportWindowFor(now, config.timezone, config.reportTime);
  const periodEnd =
    window.periodEnd.getTime() > now.getTime() ? now : window.periodEnd;
  const snapshot = await DailyReportMetricsService({
    periodStart: window.periodStart,
    periodEnd,
    tomorrowStart: window.tomorrowStart,
    tomorrowEnd: window.tomorrowEnd
  });
  return {
    id: null,
    reportDate: window.reportDate,
    status: "PREVIEW",
    body: RenderDailyReportService(snapshot, config.timezone),
    snapshot
  };
};

export const enqueueDailyReportTest = async (
  recipientId: number,
  actorUserId: number
) => {
  const config = getDailyReportConfig();
  if (!config.whatsappId) {
    throw new AppError("Configure o canal conectado para o relatório.", 409);
  }
  const recipient = await DailyReportRecipient.findByPk(recipientId);
  if (!recipient || !recipient.verifiedAt) {
    throw new AppError("Destinatário não encontrado ou não validado.", 409);
  }
  const now = new Date();
  const window = reportWindowFor(now, config.timezone, config.reportTime);
  const periodEnd =
    window.periodEnd.getTime() > now.getTime() ? now : window.periodEnd;
  const snapshot = await DailyReportMetricsService({
    periodStart: window.periodStart,
    periodEnd,
    tomorrowStart: window.tomorrowStart,
    tomorrowEnd: window.tomorrowEnd
  });
  const body = RenderDailyReportService(snapshot, config.timezone);
  const [run] = await DailyReportRun.findOrCreate({
    where: {
      reportDate: window.reportDate,
      timezone: config.timezone,
      runType: "TEST"
    },
    defaults: {
      reportDate: window.reportDate,
      runType: "TEST",
      periodStart: window.periodStart,
      periodEnd,
      timezone: config.timezone,
      status: "GENERATED",
      snapshot: JSON.stringify(snapshot),
      renderedBody: body,
      dataFreshness: snapshot.alerts.quarkLastSuccessfulSyncAt
        ? new Date(String(snapshot.alerts.quarkLastSuccessfulSyncAt))
        : null,
      generatedAt: now,
      completedAt: null,
      lastError: null
    }
  });
  await run.update({
    periodStart: window.periodStart,
    periodEnd,
    status: "GENERATED",
    snapshot: JSON.stringify(snapshot),
    renderedBody: body,
    generatedAt: now,
    completedAt: null,
    lastError: null
  });
  const [delivery] = await DailyReportDelivery.findOrCreate({
    where: { reportRunId: run.id, recipientId },
    defaults: {
      reportRunId: run.id,
      recipientId,
      whatsappId: config.whatsappId,
      ticketId: null,
      status: "PENDING",
      attempts: 0,
      nextAttemptAt: new Date(),
      processingStartedAt: null,
      workerId: null,
      messageId: null,
      sentAt: null,
      deliveredAt: null,
      readAt: null,
      lastError: null
    }
  });
  await delivery.update({
    status: "PENDING",
    whatsappId: config.whatsappId,
    nextAttemptAt: new Date(),
    processingStartedAt: null,
    workerId: null,
    lastError: null
  });
  await SendDailyReportDeliveryService(
    { ...config, testMode: false },
    delivery.id,
    true
  );
  const processedDelivery = await delivery.reload();
  await recordRecipientEvent(recipient, "TEST_ATTEMPTED", actorUserId, {
    reportRunId: run.id,
    deliveryId: delivery.id,
    status: processedDelivery.status
  });
  return processedDelivery;
};

export const retryDailyReportDelivery = async (deliveryId: number) => {
  const delivery = await DailyReportDelivery.findOne({
    where: {
      id: deliveryId,
      status: { [Op.in]: ["FAILED_RETRY", "DEAD_LETTER"] }
    }
  });
  if (!delivery) throw new AppError("Entrega com falha não encontrada.", 404);
  await delivery.update({
    status: "PENDING",
    attempts: 0,
    nextAttemptAt: new Date(),
    processingStartedAt: null,
    workerId: null,
    lastError: null
  });
  return delivery;
};

export const exportDailyReportCsv = async (
  runId: number
): Promise<{ filename: string; content: string }> => {
  const run = await DailyReportRun.findByPk(runId);
  if (!run?.snapshot) throw new AppError("Relatório sem snapshot.", 404);
  const snapshot = JSON.parse(run.snapshot) as Record<string, any>;
  return {
    filename: `fechamento-${run.reportDate}-${run.runType.toLowerCase()}.csv`,
    content: buildDailyReportCsv(snapshot)
  };
};
