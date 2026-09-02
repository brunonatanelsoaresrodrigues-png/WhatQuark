import { edit } from "../../../controllers/MessageController";
import Message from "../../../models/Message";
import { emitTicketEvent } from "../../../libs/socket";
import AssertTicketAccess from "../../../services/TicketServices/AssertTicketAccess";
import EditWhatsAppMessage from "../../../services/WbotServices/EditWhatsAppMessage";

jest.mock("../../../helpers/SetTicketMessagesAsRead", () => jest.fn());
jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));
jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(),
  emitTicketEvent: jest.fn()
}));
jest.mock("../../../services/TicketServices/AssertTicketAccess", () => jest.fn());
jest.mock("../../../services/WbotServices/EditWhatsAppMessage", () => jest.fn());
jest.mock("../../../services/MessageServices/ListMessagesService", () => jest.fn());
jest.mock("../../../services/MessageServices/SearchMessagesService", () => jest.fn());
jest.mock("../../../services/MessageServices/ShowMessageContextService", () => jest.fn());
jest.mock("../../../services/PatientIntakeServices/PausePatientIntakeService", () => jest.fn());
jest.mock("../../../services/WbotServices/DeleteWhatsAppMessage", () => jest.fn());
jest.mock("../../../services/WbotServices/SendWhatsAppMedia", () => jest.fn());
jest.mock("../../../services/WbotServices/SendWhatsAppMessage", () => jest.fn());

describe("MessageController.edit", () => {
  const ticket = { id: 42 } as any;
  const editedMessage = { id: "message-1", body: "Texto novo" } as any;
  const response = { json: jest.fn() } as any;
  const request = {
    params: { messageId: "message-1" },
    body: { body: "Texto novo" },
    user: { id: "9" }
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (Message.findByPk as jest.Mock).mockResolvedValue({ ticketId: 42 });
    (AssertTicketAccess as jest.Mock).mockResolvedValue(ticket);
    (EditWhatsAppMessage as jest.Mock).mockResolvedValue(editedMessage);
  });

  it("checks management access before editing and publishes the update", async () => {
    await edit(request, response);

    expect(AssertTicketAccess).toHaveBeenCalledWith(42, "9", true);
    expect(EditWhatsAppMessage).toHaveBeenCalledWith(
      "message-1",
      "Texto novo",
      9
    );
    expect(emitTicketEvent).toHaveBeenCalledWith(ticket, "appMessage", {
      action: "update",
      message: editedMessage
    });
    expect(response.json).toHaveBeenCalledWith(editedMessage);
  });

  it("does not edit when the attendant cannot manage the ticket", async () => {
    (AssertTicketAccess as jest.Mock).mockRejectedValueOnce(
      new Error("ERR_NO_PERMISSION")
    );

    await expect(edit(request, response)).rejects.toThrow("ERR_NO_PERMISSION");
    expect(EditWhatsAppMessage).not.toHaveBeenCalled();
    expect(emitTicketEvent).not.toHaveBeenCalled();
  });
});
