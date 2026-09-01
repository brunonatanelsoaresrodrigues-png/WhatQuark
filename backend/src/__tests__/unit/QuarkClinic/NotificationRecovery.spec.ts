import { Op } from "sequelize";
import {
  claimNextNotification,
  recoverStuckNotifications,
  StartQuarkNotificationWorker,
  StopQuarkNotificationWorker
} from "../../../services/QuarkClinicServices/QuarkNotificationWorker";
import Notification from "../../../models/QuarkAppointmentNotification";
import Appointment from "../../../models/QuarkAppointment";
import OutboundMessage from "../../../models/OutboundMessage";
import { QuarkConfig } from "../../../services/QuarkClinicServices/config";

jest.mock("../../../database", () => ({
  transaction: (callback: any) => callback({ LOCK: { UPDATE: "UPDATE" } })
}));
jest.mock("../../../models/QuarkAppointmentNotification", () => ({
  update: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn()
}));
jest.mock("../../../models/QuarkAppointment", () => ({ update: jest.fn() }));
jest.mock("../../../models/OutboundMessage", () => ({ findAll: jest.fn() }));
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
  beforeEach(() => {
    jest.clearAllMocks();
  });
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

  it("reconciles an uncertain send through normalized phone variants", async () => {
    const notice = {
      id: 77,
      appointmentId: "42",
      recipientPhone: "551187654321",
      payload: JSON.stringify({
        requestsConfirmation: true,
        scheduleFingerprint: "schedule-1"
      }),
      update: jest.fn()
    };
    (Notification.findAll as jest.Mock).mockResolvedValue([notice]);
    (Notification.update as jest.Mock).mockResolvedValue([0]);
    (OutboundMessage.findAll as jest.Mock).mockResolvedValue([
      {
        status: "SENT",
        messageId: "provider-1",
        finishedAt: new Date("2026-09-01T12:00:00Z")
      }
    ]);

    await recoverStuckNotifications({
      whatsappId: 1,
      defaultCountryCode: "55",
      processingTimeoutMs: 600000
    } as QuarkConfig);

    expect(OutboundMessage.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { [Op.in]: expect.any(Array) } }
      })
    );
    expect(notice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "SENT",
        messageId: "provider-1",
        lastError: null
      })
    );
    expect(Appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({ awaitingConfirmation: true }),
      expect.anything()
    );
  });

  it("keeps the closest appointment first while respecting retry time", async () => {
    (Notification.findOne as jest.Mock).mockResolvedValue(null);

    await claimNextNotification();

    expect(Notification.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        order: [
          ["priorityAt", "ASC"],
          ["nextAttemptAt", "ASC"],
          ["createdAt", "ASC"]
        ]
      })
    );
  });

  it("follows the central queue due time without blocking later notices", async () => {
    const dueAt = new Date("2026-09-01T18:30:00.000Z");
    const notice = {
      id: 78,
      appointmentId: "43",
      recipientPhone: "5511999990000",
      payload: "{}",
      update: jest.fn()
    };
    jest
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2026-09-01T18:00:00.000Z").getTime());
    (Notification.findAll as jest.Mock).mockResolvedValue([notice]);
    (Notification.update as jest.Mock).mockResolvedValue([0]);
    (OutboundMessage.findAll as jest.Mock).mockResolvedValue([
      { status: "PENDING", dueAt, updatedAt: new Date() }
    ]);

    await recoverStuckNotifications({
      whatsappId: 1,
      defaultCountryCode: "55",
      processingTimeoutMs: 600000,
      sendIntervalMaxMs: 180000
    } as QuarkConfig);

    expect(notice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "FAILED_RETRY",
        nextAttemptAt: dueAt,
        lastError: "ERR_MESSAGE_QUEUED"
      })
    );
  });

  it("requeues an uncertain notice when no central send was created", async () => {
    const notice = {
      id: 79,
      status: "UNKNOWN",
      appointmentId: "44",
      recipientPhone: "5511999990000",
      payload: "{}",
      update: jest.fn()
    };
    (Notification.findAll as jest.Mock).mockResolvedValue([notice]);
    (Notification.update as jest.Mock).mockResolvedValue([0]);
    (OutboundMessage.findAll as jest.Mock).mockResolvedValue([]);

    await recoverStuckNotifications({
      whatsappId: 1,
      defaultCountryCode: "55",
      processingTimeoutMs: 600000
    } as QuarkConfig);

    expect(notice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "PENDING",
        nextAttemptAt: expect.any(Date),
        lastError: null
      })
    );
  });
});
