import { Op } from "sequelize";
import {
  StartQuarkNotificationWorker,
  StopQuarkNotificationWorker
} from "../../../services/QuarkClinicServices/QuarkNotificationWorker";
import Notification from "../../../models/QuarkAppointmentNotification";
import { QuarkConfig } from "../../../services/QuarkClinicServices/config";

jest.mock("../../../database", () => ({
  transaction: (callback: any) => callback({ LOCK: { UPDATE: "UPDATE" } })
}));
jest.mock("../../../models/QuarkAppointmentNotification", () => ({
  update: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn()
}));
jest.mock("../../../models/QuarkAppointment", () => ({ update: jest.fn() }));
jest.mock(
  "../../../services/QuarkClinicServices/SendQuarkWhatsAppMessage",
  () => jest.fn()
);
jest.mock("../../../services/QuarkClinicServices/dashboardEvents", () => ({
  emitQuarkDashboardUpdate: jest.fn()
}));
jest.mock("../../../services/QuarkClinicServices/workerTiming", () => ({
  quietHoursDelayMs: () => 0,
  randomSendIntervalMs: () => 1
}));
jest.mock("../../../utils/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn() }
}));

describe("Quark notification recovery", () => {
  afterEach(async () => {
    await StopQuarkNotificationWorker();
    jest.restoreAllMocks();
  });
  it("marks an interrupted claim unknown without retrying its transport", async () => {
    const callbacks: (() => void)[] = [];
    const startedAt = Date.now();
    let now = startedAt + 1000;
    let status = "PROCESSING";
    jest.spyOn(Date, "now").mockImplementation(() => now);
    jest.spyOn(global, "setTimeout").mockImplementation(((
      callback: () => void
    ) => {
      callbacks.push(callback);
      return { unref: jest.fn() };
    }) as any);
    jest.spyOn(global, "clearTimeout").mockImplementation(() => undefined);
    (Notification.update as jest.Mock).mockImplementation(
      async (values, options) => {
        if (startedAt < options.where.processingStartedAt[Op.lt].getTime())
          status = values.status;
        return [status === "UNKNOWN" ? 1 : 0];
      }
    );
    (Notification.findOne as jest.Mock).mockResolvedValue(null);
    (Notification.count as jest.Mock).mockResolvedValue(0);
    const config = {
      dryRun: false,
      processingTimeoutMs: 600000,
      workerPollIntervalMs: 1000,
      maxMessagesPerHour: 100
    } as QuarkConfig;
    await StartQuarkNotificationWorker(config);
    callbacks[0]();
    await new Promise(resolve => setImmediate(resolve));
    expect(status).toBe("PROCESSING");
    now = startedAt + 601000;
    callbacks[1]();
    await new Promise(resolve => setImmediate(resolve));
    expect(status).toBe("UNKNOWN");
    expect(Notification.update).toHaveBeenCalledTimes(2);
  });
});
