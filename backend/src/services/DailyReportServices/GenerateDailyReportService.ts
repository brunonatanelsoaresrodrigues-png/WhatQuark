import { Op } from "sequelize";
import DailyReportDelivery from "../../models/DailyReportDelivery";
import DailyReportRecipient from "../../models/DailyReportRecipient";
import DailyReportRun from "../../models/DailyReportRun";
import QuarkSyncState from "../../models/QuarkSyncState";
import DailyReportMetricsService from "./DailyReportMetricsService";
import RenderDailyReportService from "./RenderDailyReportService";
import { DailyReportConfig } from "./config";
import { reportWindowFor } from "./time";

interface Request {
  config: DailyReportConfig;
  now?: Date;
  force?: boolean;
}

const GenerateDailyReportService = async ({
  config,
  now = new Date(),
  force = false
}: Request): Promise<DailyReportRun | null> => {
  const window = reportWindowFor(now, config.timezone, config.reportTime);
  if (!force && (!window.due || (!config.allowWeekends && window.weekend))) {
    return null;
  }

  const [run, created] = await DailyReportRun.findOrCreate({
    where: {
      reportDate: window.reportDate,
      timezone: config.timezone,
      runType: "DAILY"
    },
    defaults: {
      reportDate: window.reportDate,
      runType: "DAILY",
      periodStart: window.periodStart,
      periodEnd: window.periodEnd,
      timezone: config.timezone,
      status: "GENERATING",
      snapshot: null,
      renderedBody: null,
      dataFreshness: null,
      generatedAt: null,
      completedAt: null,
      lastError: null
    }
  });
  if (
    !created &&
    (run.completedAt || ["GENERATED", "SENDING", "COMPLETED"].includes(run.status))
  ) {
    return run;
  }

  const [claimed] = await DailyReportRun.update(
    { status: "GENERATING", lastError: null },
    {
      where: {
        id: run.id,
        status: { [Op.in]: ["GENERATING", "FAILED"] }
      }
    }
  );
  if (!claimed) return DailyReportRun.findByPk(run.id);

  try {
    const snapshot = await DailyReportMetricsService({
      periodStart: window.periodStart,
      periodEnd: window.periodEnd,
      tomorrowStart: window.tomorrowStart,
      tomorrowEnd: window.tomorrowEnd
    });
    const body = RenderDailyReportService(snapshot, config.timezone);
    const sync = await QuarkSyncState.findByPk("appointments");
    await run.update({
      periodStart: window.periodStart,
      periodEnd: window.periodEnd,
      status: "GENERATED",
      snapshot: JSON.stringify(snapshot),
      renderedBody: body,
      dataFreshness: sync?.lastSuccessfulSyncAt || null,
      generatedAt: new Date(),
      lastError: null
    });

    if (config.whatsappId) {
      const recipients = await DailyReportRecipient.findAll({
        where: { active: true, verifiedAt: { [Op.ne]: null } as any }
      });
      for (const recipient of recipients) {
        // Idempotência por relatório/destinatário é garantida pelo índice único.
        // eslint-disable-next-line no-await-in-loop
        await DailyReportDelivery.findOrCreate({
          where: { reportRunId: run.id, recipientId: recipient.id },
          defaults: {
            reportRunId: run.id,
            recipientId: recipient.id,
            whatsappId: config.whatsappId,
            ticketId: null,
            status: config.testMode ? "SUPPRESSED" : "PENDING",
            attempts: 0,
            nextAttemptAt: new Date(),
            processingStartedAt: null,
            workerId: null,
            messageId: null,
            sentAt: null,
            deliveredAt: null,
            readAt: null,
            lastError: config.testMode ? "DAILY_REPORT_TEST_MODE" : null
          }
        });
      }
    }

    return run.reload();
  } catch (error) {
    await run.update({
      status: "FAILED",
      lastError: (error instanceof Error ? error.message : "Unknown error")
        .replace(/[\r\n]+/g, " ")
        .slice(0, 500)
    });
    throw error;
  }
};

export default GenerateDailyReportService;
