import Message from "../../../models/Message";
import { buildHistoryCursors } from "../../../services/WhatsappService/SyncWhatsAppHistoryService";

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({ emit: jest.fn() }))
}));
jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));
jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: {}
}));
jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: {}
}));
jest.mock("../../../providers/WhatsApp", () => ({
  whatsappProvider: { syncHistory: jest.fn() }
}));

describe("SyncWhatsAppHistoryService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("starts each chat at its newest local message and prefers its LID", async () => {
    (Message.findAll as jest.Mock).mockResolvedValue([
      {
        id: "newest-a",
        fromMe: false,
        createdAt: new Date("2026-08-24T12:00:00.000Z"),
        ticket: {
          contact: {
            number: "5511999999999",
            lid: "123456@lid",
            isGroup: false
          }
        }
      },
      {
        id: "older-a",
        fromMe: true,
        createdAt: new Date("2026-08-23T12:00:00.000Z"),
        ticket: {
          contact: {
            number: "5511999999999",
            lid: "123456@lid",
            isGroup: false
          }
        }
      },
      {
        id: "newest-group",
        fromMe: true,
        createdAt: new Date("2026-08-24T11:00:00.000Z"),
        ticket: {
          contact: {
            number: "120363000000000000",
            lid: null,
            isGroup: true
          }
        }
      }
    ]);

    const cursors = await buildHistoryCursors(1);

    expect(cursors).toEqual([
      {
        chatId: "123456@lid",
        alternateChatIds: ["5511999999999@s.whatsapp.net"],
        oldestMessageId: "newest-a",
        oldestMessageFromMe: false,
        oldestMessageTimestampMs: new Date("2026-08-24T12:00:00.000Z").getTime()
      },
      {
        chatId: "120363000000000000@g.us",
        oldestMessageId: "newest-group",
        oldestMessageFromMe: true,
        oldestMessageTimestampMs: new Date("2026-08-24T11:00:00.000Z").getTime()
      }
    ]);
  });
});
