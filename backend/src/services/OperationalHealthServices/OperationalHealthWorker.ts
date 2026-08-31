import { logger } from "../../utils/logger";
import GetOperationalHealthService from "./GetOperationalHealthService";

let timer: NodeJS.Timeout | null = null;

const run = () =>
  GetOperationalHealthService(true).catch(err =>
    logger.error({ info: "Operational health check failed", err })
  );

export const startOperationalHealthWorker = (): void => {
  if (timer || process.env.OPERATIONAL_HEALTH_ENABLED === "false") return;
  const initial = setTimeout(run, 15000);
  initial.unref();
  timer = setInterval(run, 60000);
  timer.unref();
};

export const stopOperationalHealthWorker = (): void => {
  if (timer) clearInterval(timer);
  timer = null;
};
