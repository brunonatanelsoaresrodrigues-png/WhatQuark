import AppError from "../../../errors/AppError";
import Message from "../../../models/Message";
import ResolveMessageHistoryTicketIdsService from "../../../services/MessageServices/ResolveMessageHistoryTicketIdsService";
import SearchMessagesService from "../../../services/MessageServices/SearchMessagesService";

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { findAndCountAll: jest.fn() }
}));
jest.mock(
  "../../../services/MessageServices/ResolveMessageHistoryTicketIdsService",
  () => jest.fn()
);

describe("SearchMessagesService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ResolveMessageHistoryTicketIdsService as jest.Mock).mockResolvedValue({
      ticket: { id: 11 },
      ticketIds: [10, 11]
    });
    (Message.findAndCountAll as jest.Mock).mockResolvedValue({
      count: 1,
      rows: [
        {
          id: "message-1",
          ticketId: 10,
          body: "A consulta foi confirmada para amanhã às oito horas.",
          fromMe: true,
          mediaType: "chat",
          createdAt: new Date("2026-08-31T12:00:00.000Z"),
          contact: null
        }
      ]
    });
  });

  it("rejects terms that are too short", async () => {
    await expect(
      SearchMessagesService({
        ticketId: "11",
        userId: "7",
        query: "a"
      })
    ).rejects.toEqual(expect.any(AppError));
    expect(Message.findAndCountAll).not.toHaveBeenCalled();
  });

  it("searches all authorized ticket history and returns a short excerpt", async () => {
    const result = await SearchMessagesService({
      ticketId: "11",
      userId: "7",
      query: "consulta"
    });

    expect(ResolveMessageHistoryTicketIdsService).toHaveBeenCalledWith(
      "11",
      "7"
    );
    const query = (Message.findAndCountAll as jest.Mock).mock.calls[0][0];
    expect(query.limit).toBe(20);
    expect(query.offset).toBe(0);
    expect(result.count).toBe(1);
    expect(result.results[0]).toEqual(
      expect.objectContaining({
        id: "message-1",
        ticketId: 10,
        excerpt: expect.stringContaining("consulta")
      })
    );
  });
});
