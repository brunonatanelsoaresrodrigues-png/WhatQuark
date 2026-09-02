import Message from "../../../models/Message";
import contactJid from "../../../helpers/ContactJid";
import { whatsappProvider } from "../../../providers/WhatsApp";
import EditWhatsAppMessage, {
  MESSAGE_EDIT_WINDOW_MS
} from "../../../services/WbotServices/EditWhatsAppMessage";

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { findByPk: jest.fn(), findOne: jest.fn() }
}));
jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: {}
}));
jest.mock("../../../helpers/ContactJid", () => jest.fn(() => "5511999999999@c.us"));
jest.mock("../../../providers/WhatsApp", () => ({
  whatsappProvider: { editMessage: jest.fn() }
}));

describe("EditWhatsAppMessage", () => {
  const now = Date.parse("2026-09-02T15:00:00.000Z");
  let ticket: any;
  let message: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(now);
    ticket = {
      whatsappId: 3,
      contact: { number: "5511999999999" },
      isGroup: false,
      lastMessage: "Texto antigo",
      update: jest.fn().mockResolvedValue(undefined)
    };
    message = {
      id: "message-1",
      ticketId: 42,
      body: "Texto antigo",
      fromMe: true,
      isDeleted: false,
      mediaType: "chat",
      origin: "HUMAN",
      sentByUserId: 7,
      createdAt: new Date(now - 60_000),
      ticket,
      update: jest.fn(async values => Object.assign(message, values))
    };
    (Message.findByPk as jest.Mock).mockResolvedValue(message);
    (Message.findOne as jest.Mock).mockResolvedValue({ id: "message-1" });
    (whatsappProvider.editMessage as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it("edits at WhatsApp first and then records who edited it", async () => {
    const result = await EditWhatsAppMessage("message-1", " Texto novo ", 9);

    expect(contactJid).toHaveBeenCalledWith(ticket.contact, false);
    expect(whatsappProvider.editMessage).toHaveBeenCalledWith(
      3,
      "5511999999999@c.us",
      "message-1",
      "Texto novo"
    );
    expect(message.update).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "Texto novo",
        editedByUserId: 9,
        editedAt: expect.any(Date)
      })
    );
    expect(ticket.update).toHaveBeenCalledWith({ lastMessage: "Texto novo" });
    expect(result).toBe(message);
  });

  it("does not replace the ticket preview when an older message is edited", async () => {
    (Message.findOne as jest.Mock).mockResolvedValueOnce({ id: "message-2" });

    await EditWhatsAppMessage("message-1", "Texto novo", 9);

    expect(ticket.update).not.toHaveBeenCalled();
  });

  it("rejects messages outside the 15-minute window", async () => {
    message.createdAt = new Date(now - MESSAGE_EDIT_WINDOW_MS - 1);

    await expect(
      EditWhatsAppMessage("message-1", "Texto novo", 9)
    ).rejects.toMatchObject({ message: "ERR_MESSAGE_EDIT_WINDOW_EXPIRED" });
    expect(whatsappProvider.editMessage).not.toHaveBeenCalled();
  });

  it.each([
    ["incoming", { fromMe: false }],
    ["deleted", { isDeleted: true }],
    ["media", { mediaType: "image" }],
    ["automated", { origin: "BOT" }]
  ])("rejects an %s message", async (_label, changes) => {
    Object.assign(message, changes);

    await expect(
      EditWhatsAppMessage("message-1", "Texto novo", 9)
    ).rejects.toMatchObject({ message: "ERR_MESSAGE_EDIT_NOT_ALLOWED" });
    expect(whatsappProvider.editMessage).not.toHaveBeenCalled();
  });

  it("does not change the local record when WhatsApp rejects the edit", async () => {
    (whatsappProvider.editMessage as jest.Mock).mockRejectedValueOnce(
      new Error("provider failed")
    );

    await expect(
      EditWhatsAppMessage("message-1", "Texto novo", 9)
    ).rejects.toMatchObject({ message: "ERR_EDITING_WAPP_MSG" });
    expect(message.update).not.toHaveBeenCalled();
  });
});
