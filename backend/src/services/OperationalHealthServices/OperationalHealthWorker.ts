import { logger } from "../../utils/logger";
import {
  collectOperationalHealth,
  synchronizeOperationalAlerts
} from "./OperationalHealthService";

let timer: NodeJS.Timeout | undefined;
let running = false;
let started = false;

const intervalMs = (): number => {
  const value = Number(process.env.OPERATIONAL_HEALTH_INTERVAL_SECONDS);
  return (Number.isFinite(value) && value >= 30 ? value : 60) * 1000;
};

export const RunOperationalHealthCycle = async (): Promise<void> => {
  if (running) return;
  running = true;
  try {
    const snapshot = await collectOperationalHealth();
    await synchronizeOperationalAlerts(snapshot);
  } catch (error) {
    logger.error({ info: "Operational health cycle failed", err: error });
  } finally {
    running = false;
  }
};

const schedule = (): void => {
  if (!started) return;
  timer = setTimeout(async () => {
    await RunOperationalHealthCycle();
    schedule();
  }, intervalMs());
  timer.unref();
};

export const StartOperationalHealthWorker = (): void => {
  if (started) return;
  started = true;
  timer = setTimeout(async () => {
    await RunOperationalHealthCycle();
    schedule();
  }, 15000);
  timer.unref();
};

export const StopOperationalHealthWorker = async (): Promise<void> => {
  started = false;
  if (timer) clearTimeout(timer);
  timer = undefined;
  while (running) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
};
