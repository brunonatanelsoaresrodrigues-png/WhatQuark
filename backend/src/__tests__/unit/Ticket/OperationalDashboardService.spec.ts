import AppError from "../../../errors/AppError";
import {
  buildOperationalWhere,
  summarizeWaits
} from "../../../services/TicketServices/OperationalDashboardService";

jest.mock("../../../database", () => ({
  __esModule: true,
  default: { query: jest.fn() }
}));

describe("OperationalDashboardService helpers", () => {
  const restrictedViewer = {
    id: 7,
    profile: "user",
    canViewOtherAgentsTickets: false,
    queues: [{ id: 2 }, { id: 4 }]
  };

  it("limits a restricted attendant to assigned tickets and their queues", () => {
    const result = buildOperationalWhere(restrictedViewer, {});

    expect(result.sql).toContain("t.ticketType='PATIENT'");
    expect(result.sql).toContain("t.queueId IN (:viewerQueueIds)");
    expect(result.sql).toContain("t.userId=:viewerId OR t.status='pending'");
    expect(result.replacements).toEqual({
      viewerQueueIds: [2, 4],
      viewerId: 7
    });
  });

  it("rejects filters outside the attendant access", () => {
    expect(() => buildOperationalWhere(restrictedViewer, { queueId: 9 })).toThrow(
      AppError
    );
    expect(() =>
      buildOperationalWhere(restrictedViewer, { assigneeId: 8 })
    ).toThrow(AppError);
  });

  it("allows an administrator to filter queue and attendant", () => {
    const result = buildOperationalWhere(
      { id: 1, profile: "admin", queues: [] },
      { queueId: 3, assigneeId: 5 },
      "ticket"
    );

    expect(result.sql).toContain("ticket.queueId=:dashboardQueueId");
    expect(result.sql).toContain("ticket.userId=:dashboardAssigneeId");
    expect(result.replacements).toEqual({
      dashboardQueueId: 3,
      dashboardAssigneeId: 5
    });
  });

  it("calculates maximum, average and waits above SLA", () => {
    const now = new Date("2026-08-29T15:10:00.000Z");
    const result = summarizeWaits(
      [
        {
          id: 1,
          queueId: 2,
          queueName: "Recepção",
          waitStartedAt: "2026-08-29T15:00:00.000Z"
        },
        {
          id: 2,
          queueId: 2,
          queueName: "Recepção",
          waitStartedAt: "2026-08-29T15:08:00.000Z"
        }
      ],
      now,
      300
    );

    expect(result.maximumSeconds).toBe(600);
    expect(result.averageSeconds).toBe(360);
    expect(result.aboveSla).toBe(1);
  });
});
