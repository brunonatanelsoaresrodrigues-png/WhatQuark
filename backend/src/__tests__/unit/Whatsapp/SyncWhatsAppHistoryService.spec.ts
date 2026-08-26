import Message from "../../../models/Message";
import WhatsappHistorySyncJob from "../../../models/WhatsappHistorySyncJob";
import {
  buildHistoryCursors,
  GetWhatsAppHistorySyncStatusService
} from "../../../services/WhatsappService/SyncWhatsAppHistoryService";

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
jest.mock("../../../models/WhatsappHistorySyncJob", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), upsert: jest.fn() }
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

  it("persists an interrupted job as failed so it can be restarted safely", async () => {
    (WhatsappHistorySyncJob.findOne as jest.Mock).mockResolvedValue({
      status: "running",
      totalChats: 10,
      processedChats: 4,
      importedMessages: 30,
      duplicateMessages: 2,
      failedMessages: 0,
      failedChats: 0,
      limitedChats: 0,
      startedAt: new Date("2026-08-24T10:00:00.000Z"),
      finishedAt: null,
      error: null
    });
    (WhatsappHistorySyncJob.upsert as jest.Mock).mockResolvedValue(undefined);

    const result = await GetWhatsAppHistorySyncStatusService(999);

    expect(result).toEqual(
      expect.objectContaining({
        status: "failed",
        processedChats: 4,
        error: "ERR_HISTORY_SYNC_INTERRUPTED_RESTART_REQUIRED"
      })
    );
    expect(WhatsappHistorySyncJob.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ whatsappId: 999, status: "failed" })
    );
  });
});
