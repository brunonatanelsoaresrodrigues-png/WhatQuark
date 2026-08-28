import User from "../../../models/User";
import ResolveTicketAssigneeFilterService from "../../../services/TicketServices/ResolveTicketAssigneeFilterService";

jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

describe("ResolveTicketAssigneeFilterService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("allows an administrator to list all attendants", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      id: 1,
      profile: "admin",
      canViewOtherAgentsTickets: false
    });

    await expect(
      ResolveTicketAssigneeFilterService({
        requesterUserId: 1,
        requestedAssignee: "all"
      })
    ).resolves.toEqual({ mode: "all" });
  });

  it("allows a regular user with permission to filter another attendant", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      id: 2,
      profile: "user",
      canViewOtherAgentsTickets: true
    });

    await expect(
      ResolveTicketAssigneeFilterService({
        requesterUserId: 2,
        requestedAssignee: "user:9"
      })
    ).resolves.toEqual({ mode: "user", userId: 9 });
  });

  it("allows a regular user to filter their own tickets", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      id: 3,
      profile: "user",
      canViewOtherAgentsTickets: false
    });

    await expect(
      ResolveTicketAssigneeFilterService({
        requesterUserId: 3,
        requestedAssignee: "me"
      })
    ).resolves.toEqual({ mode: "user", userId: 3 });
  });

  it("denies an explicit request for another attendant without permission", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      id: 4,
      profile: "user",
      canViewOtherAgentsTickets: false
    });

    await expect(
      ResolveTicketAssigneeFilterService({
        requesterUserId: 4,
        requestedAssignee: "user:8"
      })
    ).rejects.toEqual(
      expect.objectContaining({ message: "ERR_NO_PERMISSION", statusCode: 403 })
    );
  });

  it("safely ignores legacy showAll for a regular user", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      id: 5,
      profile: "user",
      canViewOtherAgentsTickets: false
    });

    await expect(
      ResolveTicketAssigneeFilterService({
        requesterUserId: 5,
        legacyShowAll: "true"
      })
    ).resolves.toEqual({ mode: "default" });
  });

  it("rejects malformed filters", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      id: 6,
      profile: "admin",
      canViewOtherAgentsTickets: true
    });

    await expect(
      ResolveTicketAssigneeFilterService({
        requesterUserId: 6,
        requestedAssignee: "someone"
      })
    ).rejects.toEqual(
      expect.objectContaining({
        message: "ERR_INVALID_TICKET_ASSIGNEE_FILTER",
        statusCode: 400
      })
    );
  });
});
