import sequelize from "../../../database";
import {
  getQuarkDashboardSummary,
  getQuarkDashboardTimeseries,
  listQuarkDashboardAppointments
} from "../../../services/QuarkClinicServices/QuarkDashboardService";

jest.mock("../../../database", () => ({
  __esModule: true,
  default: { query: jest.fn() }
}));

describe("QuarkDashboardService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calculates operational totals and response rate", async () => {
    (sequelize.query as jest.Mock)
      .mockResolvedValueOnce([
        {
          generated: "20",
          sent: "10",
          delivered: "9",
          read: "8",
          queued: "3",
          retrying: "1",
          failed: "2",
          suppressed: "5",
          confirmationRequests: "10"
        }
      ])
      .mockResolvedValueOnce([
        {
          responses: "8",
          successfulResponses: "7",
          confirmedViaWhatsapp: "6",
          cancelledViaWhatsapp: "1",
          responseFailures: "1",
          averageResponseSeconds: "360"
        }
      ])
      .mockResolvedValueOnce([
        {
          monitoredAppointments: "30",
          confirmedInQuark: "12",
          cancelledInQuark: "2",
          scheduled: "16",
          awaitingResponse: "3"
        }
      ])
      .mockResolvedValueOnce([
        {
          status: "ACTIVE",
          baselineCompletedAt: new Date(),
          lastSuccessfulSyncAt: new Date()
        }
      ]);

    const result = await getQuarkDashboardSummary({
      from: "2026-08-01",
      to: "2026-08-31"
    });

    expect(result.notifications).toEqual(
      expect.objectContaining({ sent: 10, delivered: 9, read: 8, failed: 2 })
    );
    expect(result.responses).toEqual(
      expect.objectContaining({
        confirmed: 6,
        cancelled: 1,
        responseRate: 70,
        averageResponseSeconds: 360
      })
    );
    expect(result.appointments.awaitingResponse).toBe(3);
  });

  it("merges notification and response series by day", async () => {
    (sequelize.query as jest.Mock)
      .mockResolvedValueOnce([
        {
          day: "2026-08-20",
          sent: "4",
          delivered: "3",
          read: "2",
          failed: "1"
        }
      ])
      .mockResolvedValueOnce([
        { day: "2026-08-20", confirmed: "2", cancelled: "1" },
        { day: "2026-08-21", confirmed: "1", cancelled: "0" }
      ]);

    const result = await getQuarkDashboardTimeseries({
      from: "2026-08-20",
      to: "2026-08-21"
    });

    expect(result).toEqual([
      {
        day: "2026-08-20",
        sent: 4,
        delivered: 3,
        read: 2,
        failed: 1,
        confirmed: 2,
        cancelled: 1
      },
      {
        day: "2026-08-21",
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        confirmed: 1,
        cancelled: 0
      }
    ]);
  });

  it("returns complete admin patient data and the linked conversation", async () => {
    (sequelize.query as jest.Mock)
      .mockResolvedValueOnce([
        {
          patient: "PACIENTE COMPLETO",
          phone: "5585999990000",
          ticketId: 77
        }
      ])
      .mockResolvedValueOnce([{ total: "1" }]);

    const result = await listQuarkDashboardAppointments({
      from: "2026-08-20",
      to: "2026-08-21"
    });
    const sql = (sequelize.query as jest.Mock).mock.calls[0][0] as string;

    expect(sql).toContain("a.patientName AS patient");
    expect(sql).toContain("a.phone");
    expect(sql).toContain("n.ticketId IS NOT NULL");
    expect(sql).not.toContain("CONCAT(LEFT(TRIM(a.patientName)");
    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        patient: "PACIENTE COMPLETO",
        phone: "5585999990000",
        ticketId: 77
      })
    );
  });
});
