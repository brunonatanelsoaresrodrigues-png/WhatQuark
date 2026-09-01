import DailyReportDelivery from "../../../models/DailyReportDelivery";
import DailyReportRecipient from "../../../models/DailyReportRecipient";
import DailyReportRun from "../../../models/DailyReportRun";
import QuarkSyncState from "../../../models/QuarkSyncState";
import DailyReportMetricsService from "../../../services/DailyReportServices/DailyReportMetricsService";
import GenerateDailyReportService from "../../../services/DailyReportServices/GenerateDailyReportService";
import RenderDailyReportService from "../../../services/DailyReportServices/RenderDailyReportService";

jest.mock("../../../models/DailyReportDelivery", () => ({
  __esModule: true,
  default: { findOrCreate: jest.fn() }
}));
jest.mock("../../../models/DailyReportRecipient", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));
jest.mock("../../../models/DailyReportRun", () => ({
  __esModule: true,
  default: { findOrCreate: jest.fn(), update: jest.fn(), findByPk: jest.fn() }
}));
jest.mock("../../../models/QuarkSyncState", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));
jest.mock(
  "../../../services/DailyReportServices/DailyReportMetricsService",
  () => jest.fn()
);
jest.mock(
  "../../../services/DailyReportServices/RenderDailyReportService",
  () => jest.fn()
);

const config = {
  enabled: true,
  testMode: true,
  reportTime: "17:00",
  timezone: "America/Sao_Paulo",
  whatsappId: 1,
  pollIntervalSeconds: 30,
  sendIntervalSeconds: 20,
  maxRetryAttempts: 5,
  allowWeekends: true
};

const makeRun = (status = "GENERATING") => ({
  id: 9,
  reportDate: "2026-08-20",
  status,
  update: jest.fn().mockResolvedValue(undefined),
  reload: jest.fn().mockResolvedValue({ id: 9, status: "GENERATED" })
});

describe("GenerateDailyReportService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (DailyReportRun.update as jest.Mock).mockResolvedValue([1]);
    (DailyReportMetricsService as jest.Mock).mockResolvedValue({
      generatedAt: "2026-08-20T20:00:00.000Z"
    });
    (RenderDailyReportService as jest.Mock).mockReturnValue("report body");
    (QuarkSyncState.findByPk as jest.Mock).mockResolvedValue({
      lastSuccessfulSyncAt: new Date("2026-08-20T19:57:00.000Z")
    });
    (DailyReportRecipient.findAll as jest.Mock).mockResolvedValue([
      { id: 1 },
      { id: 2 }
    ]);
    (DailyReportDelivery.findOrCreate as jest.Mock).mockResolvedValue([
      {},
      true
    ]);
  });

  it("persists one suppressed delivery per verified manager in test mode", async () => {
    const run = makeRun();
    (DailyReportRun.findOrCreate as jest.Mock).mockResolvedValue([run, true]);

    await GenerateDailyReportService({
      config,
      now: new Date("2026-08-20T20:02:00.000Z")
    });

    expect(run.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "GENERATED",
        renderedBody: "report body"
      })
    );
    expect(DailyReportDelivery.findOrCreate).toHaveBeenCalledTimes(2);
    expect(DailyReportDelivery.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reportRunId: 9, recipientId: 1 },
        defaults: expect.objectContaining({ status: "SUPPRESSED" })
      })
    );
  });

  it("returns the existing generated run without recalculating or duplicating", async () => {
    const run = makeRun("GENERATED");
    (DailyReportRun.findOrCreate as jest.Mock).mockResolvedValue([run, false]);

    await expect(
      GenerateDailyReportService({
        config,
        now: new Date("2026-08-20T20:05:00.000Z")
      })
    ).resolves.toBe(run);

    expect(DailyReportMetricsService).not.toHaveBeenCalled();
    expect(DailyReportDelivery.findOrCreate).not.toHaveBeenCalled();
  });
});
