import { logger } from "../../utils/logger";
import ReconcileContactIdentitiesService from "./ReconcileContactIdentitiesService";
import {
  identityReconciliationEnabled,
  identityReconciliationHour
} from "./config";

let timer: NodeJS.Timeout | undefined;
let started = false;

const nextDelay = (): number => {
  const now = new Date();
  const next = new Date(now);
  next.setHours(identityReconciliationHour(), 30, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
};

const schedule = () => {
  if (!started) return;
  timer = setTimeout(async () => {
    try {
      await ReconcileContactIdentitiesService();
    } catch (err) {
      logger.error({ info: "Identity reconciliation failed", err });
    } finally {
      schedule();
    }
  }, nextDelay());
  timer.unref();
};

export const StartIdentityReconciliationWorker = (): void => {
  if (started || !identityReconciliationEnabled()) return;
  started = true;
  const initial = setTimeout(() => {
    ReconcileContactIdentitiesService().catch(err =>
      logger.error({ info: "Initial identity reconciliation failed", err })
    );
  }, 60_000);
  initial.unref();
  schedule();
};

export const StopIdentityReconciliationWorker = async (): Promise<void> => {
  started = false;
  if (timer) clearTimeout(timer);
  timer = undefined;
};
