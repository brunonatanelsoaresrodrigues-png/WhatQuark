import { dailyReportRunStatus } from "../../../services/DailyReportServices/SendDailyReportDeliveryService";

jest.mock("../../../database", () => ({
  __esModule: true,
  default: { transaction: jest.fn() }
}));
jest.mock("../../../providers/WhatsApp", () => ({ whatsappProvider: {} }));

describe("dailyReportRunStatus", () => {
  it("reports complete, partial and failed delivery outcomes honestly", () => {
    expect(dailyReportRunStatus(4, 0)).toBe("COMPLETED");
    expect(dailyReportRunStatus(3, 1)).toBe("PARTIAL");
    expect(dailyReportRunStatus(0, 4)).toBe("FAILED");
  });
});
