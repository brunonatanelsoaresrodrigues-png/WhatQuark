import DailyReportDelivery from "../../models/DailyReportDelivery";
import { Op } from "sequelize";
import { logger } from "../../utils/logger";
import GenerateDailyReportService from "./GenerateDailyReportService";
import SendDailyReportDeliveryService, {
  recoverDailyReportDeliveries
} from "./SendDailyReportDeliveryService";
import { DailyReportConfig, getDailyReportConfig } from "./config";

let workerTimer: NodeJS.Timeout | undefined;
let workerStopped = true;
let activeRun: Promise<void> | undefined;

export const RunDailyManagementReportWorker = async (
  config = getDailyReportConfig(),
  now = new Date()
): Promise<{ generated: boolean; delivered: boolean }> => {
  await recoverDailyReportDeliveries();
  const report = await GenerateDailyReportService({ config, now });
  const delivered = config.testMode
    ? false
    : await SendDailyReportDeliveryService(config);
  return { generated: Boolean(report), delivered };
};

const schedule = (config: DailyReportConfig, delaySeconds: number): void => {
  workerTimer = setTimeout(() => {
    activeRun = RunDailyManagementReportWorker(config)
      .catch(error =>
        logger.error({
          info: "Daily management report worker failed",
          err: error
        })
      )
      .then(() => undefined)
      .finally(async () => {
        activeRun = undefined;
        if (workerStopped) return;
        const dueDelivery = await DailyReportDelivery.count({
          where: { status: { [Op.in]: ["PENDING", "FAILED_RETRY"] } }
        }).catch(() => 0);
        schedule(
          config,
          dueDelivery && !config.testMode
            ? config.sendIntervalSeconds
            : config.pollIntervalSeconds
        );
      });
  }, delaySeconds * 1000);
  workerTimer.unref();
};

export const StartDailyManagementReportWorker = (): void => {
  const config = getDailyReportConfig();
  if (!config.enabled || !workerStopped) return;
  workerStopped = false;
  logger.info({
    info: "Daily management report scheduled",
    reportTime: config.reportTime,
    timezone: config.timezone,
    whatsappId: config.whatsappId,
    testMode: config.testMode,
    sendIntervalSeconds: config.sendIntervalSeconds
  });
  schedule(config, 5);
};

export const StopDailyManagementReportWorker = async (): Promise<void> => {
  workerStopped = true;
  if (workerTimer) clearTimeout(workerTimer);
  workerTimer = undefined;
  if (activeRun) await activeRun;
};
