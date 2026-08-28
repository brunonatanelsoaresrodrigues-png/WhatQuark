jest.mock(
  "../../../services/TicketServices/ResolveTicketAssigneeFilterService",
  () => jest.fn().mockResolvedValue({ mode: "default" })
);
import { Op } from "sequelize";
import ListTicketsService from "../../../services/TicketServices/ListTicketsService";
import Ticket from "../../../models/Ticket";
import ShowUserService from "../../../services/UserServices/ShowUserService";

jest.mock("../../../models/Ticket", () => ({ findAndCountAll: jest.fn() }));
jest.mock("../../../models/Contact", () => ({}));
jest.mock("../../../models/Message", () => ({}));
jest.mock("../../../models/Queue", () => ({}));
jest.mock("../../../models/Whatsapp", () => ({}));
jest.mock("../../../services/UserServices/ShowUserService", () => jest.fn());

describe("ticket listing scope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ShowUserService as jest.Mock).mockResolvedValue({
      id: 1,
      profile: "user",
      queues: [{ id: 2 }]
    });
    (Ticket.findAndCountAll as jest.Mock).mockResolvedValue({
      count: 0,
      rows: []
    });
  });
  it.each([
    { showAll: "true" },
    { date: "2026-08-27" },
    { searchParam: "patient" },
    { withUnreadMessages: "true" }
  ])("retains the server access scope for filter %j", async filter => {
    await ListTicketsService({ userId: "1", queueIds: [999], ...filter });
    const query = (Ticket.findAndCountAll as jest.Mock).mock.calls[0][0];
    const scope = query.where[Op.and][0];
    expect(scope.ticketType).toBe("PATIENT");
    expect(scope[Op.and][0][Op.or]).toEqual([
      { userId: 1 },
      { status: "pending" }
    ]);
    expect(scope[Op.and][1][Op.or][0].queueId[Op.in]).toEqual([2]);
  });
});
