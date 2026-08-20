import { getIO } from "../../libs/socket";

export type QuarkDashboardEvent =
  | "notification"
  | "delivery"
  | "response"
  | "sync";

export const emitQuarkDashboardUpdate = (
  event: QuarkDashboardEvent,
  id?: number | string
): void => {
  try {
    getIO().emit("quarkDashboard", {
      event,
      id: id === undefined ? null : id,
      occurredAt: new Date().toISOString()
    });
  } catch {
    // Metrics must never interrupt appointment synchronization or messaging.
  }
};
