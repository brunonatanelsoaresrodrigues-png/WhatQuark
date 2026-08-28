import { Op } from "sequelize";
import Message from "../../../models/Message";
import Ticket from "../../../models/Ticket";
import ListMessagesService from "../../../services/MessageServices/ListMessagesService";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import ShowUserService from "../../../services/UserServices/ShowUserService";

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    count: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn()
  }
}));
jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));
jest.mock("../../../services/TicketServices/ShowTicketService");
jest.mock("../../../services/UserServices/ShowUserService");

describe("ListMessagesService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ShowUserService as jest.Mock).mockResolvedValue({
      id: 1,
      profile: "admin",
      queues: []
    });
    (ShowTicketService as jest.Mock).mockResolvedValue({
      id: 11,
      contactId: 5,
      whatsappId: 1,
      ticketType: "PATIENT"
    });
    (Ticket.findAll as jest.Mock).mockResolvedValue([{ id: 10 }, { id: 11 }]);
    (Message.count as jest.Mock).mockResolvedValue(42);
    (Message.findAll as jest.Mock).mockResolvedValue([
      { id: "newer" },
      { id: "older" }
    ]);
  });

  it("loads the conversation across every ticket for the same contact", async () => {
    const result = await ListMessagesService({ ticketId: "11", userId: "1" });

    expect(Ticket.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          contactId: 5,
          whatsappId: 1,
          ticketType: "PATIENT",
          [Op.and]: [{}]
        }
      })
    );
    const query = (Message.findAll as jest.Mock).mock.calls[0][0];
    expect(query.where.ticketId[Op.in]).toEqual([10, 11]);
    expect(result.messages.map(message => message.id)).toEqual([
      "older",
      "newer"
    ]);
    expect(result.hasMore).toBe(true);
  });

  it("restricts related history to the current user's allowed tickets", async () => {
    (ShowUserService as jest.Mock).mockResolvedValue({
      id: 8,
      profile: "user",
      queues: [{ id: 2 }]
    });
    await ListMessagesService({ ticketId: "11", userId: "8" });
    const related = (Ticket.findAll as jest.Mock).mock.calls[0][0].where[
      Op.and
    ][0];
    expect(related.ticketType).toBe("PATIENT");
    expect(related[Op.and][0][Op.or]).toEqual([
      { userId: 8 },
      { status: "pending" }
    ]);
  });

  it("uses the oldest visible message as a stable pagination cursor", async () => {
    (Message.findOne as jest.Mock).mockResolvedValue({
      id: "cursor",
      createdAt: new Date("2026-08-23T12:00:00.000Z")
    });

    await ListMessagesService({
      ticketId: "11",
      pageNumber: "2",
      beforeMessageId: "cursor"
    });

    const query = (Message.findAll as jest.Mock).mock.calls[0][0];
    expect(query.where[Op.or]).toHaveLength(2);
    expect(query.offset).toBe(0);
    expect(query.limit).toBe(21);
    expect(query.order).toEqual([
      ["createdAt", "DESC"],
      ["id", "DESC"]
    ]);
  });
});
