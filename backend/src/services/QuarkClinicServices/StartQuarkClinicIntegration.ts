import { logger } from "../../utils/logger";
import {
  getQuarkConfig,
  isQuarkIntegrationEnabled,
  QuarkConfig
} from "./config";
import { SyncQuarkAppointmentsService } from "./SyncQuarkAppointmentsService";
import {
  StartQuarkNotificationWorker,
  StopQuarkNotificationWorker
} from "./QuarkNotificationWorker";

let timer: NodeJS.Timeout | undefined;
let running = false;
let started = false;

const scheduleNext = (config: QuarkConfig): void => {
  if (!started) return;
  timer = setTimeout(() => runSync(config), config.pollIntervalMs);
  timer.unref();
};

const runSync = async (config: QuarkConfig): Promise<void> => {
  if (running) return;
  running = true;
  try {
    await SyncQuarkAppointmentsService(config);
  } catch (error) {
    logger.error({ info: "QuarkClinic synchronization failed", err: error });
  } finally {
    running = false;
    scheduleNext(config);
  }
};

const StartQuarkClinicIntegration = (): void => {
  if (!isQuarkIntegrationEnabled()) {
    logger.info("QuarkClinic integration is disabled");
    return;
  }

  try {
    const config = getQuarkConfig();
    started = true;
    logger.info({
      info: "QuarkClinic integration scheduled",
      pollIntervalSeconds: config.pollIntervalMs / 1000,
      sendIntervalMinSeconds: config.sendIntervalMinMs / 1000,
      sendIntervalMaxSeconds: config.sendIntervalMaxMs / 1000
    });
    StartQuarkNotificationWorker(config).catch(error =>
      logger.error({
        info: "QuarkClinic notification worker was not started",
        err: error
      })
    );
    timer = setTimeout(() => runSync(config), config.startupDelayMs);
    timer.unref();
  } catch (error) {
    logger.error({
      info: "QuarkClinic integration was not started",
      err: error
    });
  }
};

export const StopQuarkClinicIntegration = (): void => {
  started = false;
  if (timer) clearTimeout(timer);
  timer = undefined;
  StopQuarkNotificationWorker();
};

export default StartQuarkClinicIntegration;
