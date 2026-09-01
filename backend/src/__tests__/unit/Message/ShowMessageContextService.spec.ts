import { Op } from "sequelize";
import Message from "../../../models/Message";
import ResolveMessageHistoryTicketIdsService from "../../../services/MessageServices/ResolveMessageHistoryTicketIdsService";
import ShowMessageContextService from "../../../services/MessageServices/ShowMessageContextService";

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), findAll: jest.fn() }
}));
jest.mock(
  "../../../services/MessageServices/ResolveMessageHistoryTicketIdsService",
  () => jest.fn()
);

describe("ShowMessageContextService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ResolveMessageHistoryTicketIdsService as jest.Mock).mockResolvedValue({
      ticket: { id: 11 },
      ticketIds: [10, 11]
    });
    (Message.findOne as jest.Mock).mockResolvedValue({
      id: "target",
      ticketId: 10,
      createdAt: new Date("2026-08-31T12:00:00.000Z")
    });
    (Message.findAll as jest.Mock)
      .mockResolvedValueOnce([{ id: "older" }])
      .mockResolvedValueOnce([{ id: "newer" }]);
  });

  it("loads surrounding messages without leaving the authorized history", async () => {
    const result = await ShowMessageContextService({
      ticketId: "11",
      messageId: "target",
      userId: "7"
    });

    const targetWhere = (Message.findOne as jest.Mock).mock.calls[0][0].where;
    expect(targetWhere.ticketId[Op.in]).toEqual([10, 11]);
    expect(result.messages.map(message => message.id)).toEqual([
      "older",
      "target",
      "newer"
    ]);
    expect(result.targetMessageId).toBe("target");
  });
});
