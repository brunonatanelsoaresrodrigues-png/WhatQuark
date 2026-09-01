import { promises as fs } from "fs";
import SavedSticker from "../../../models/SavedSticker";
import AssertTicketAccess from "../../../services/TicketServices/AssertTicketAccess";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import {
  deleteSavedSticker,
  sendSavedSticker
} from "../../../services/StickerServices/SavedStickerService";

jest.mock("../../../models/SavedSticker", () => ({
  findByPk: jest.fn()
}));
jest.mock("../../../services/TicketServices/AssertTicketAccess", () => jest.fn());
jest.mock("../../../services/WbotServices/SendWhatsAppMedia", () => jest.fn());

describe("saved sticker service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(fs, "realpath").mockImplementation(async value => String(value));
    jest.spyOn(fs, "stat").mockResolvedValue({ size: 512 } as any);
    jest.spyOn(fs, "unlink").mockResolvedValue(undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  const sticker = {
    id: 4,
    name: "Saudação",
    storageKey: "stickers/sticker.webp",
    mimeType: "image/webp",
    createdByUserId: 7,
    destroy: jest.fn()
  } as any;

  it("sends a persistent library file as a real sticker", async () => {
    (SavedSticker.findByPk as jest.Mock).mockResolvedValue(sticker);
    (AssertTicketAccess as jest.Mock).mockResolvedValue({
      id: 9,
      whatsappId: 1,
      contact: { number: "5511999999999" }
    });
    await sendSavedSticker({
      stickerId: 4,
      ticketId: "9",
      userId: 7,
      idempotencyKey: "sticker-request-1234"
    });
    expect(SendWhatsAppMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        sendAsSticker: true,
        removeFileAfterSend: false,
        sentByUserId: 7,
        origin: "HUMAN"
      })
    );
  });

  it("does not allow another regular user to delete a shared sticker", async () => {
    (SavedSticker.findByPk as jest.Mock).mockResolvedValue(sticker);
    await expect(deleteSavedSticker(4, 8, "user")).rejects.toMatchObject({
      message: "ERR_NO_PERMISSION",
      statusCode: 403
    });
    expect(sticker.destroy).not.toHaveBeenCalled();
  });
});
