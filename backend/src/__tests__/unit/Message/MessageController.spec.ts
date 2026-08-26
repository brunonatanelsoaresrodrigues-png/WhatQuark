import { index, store } from "../../../controllers/MessageController";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import ListMessagesService from "../../../services/MessageServices/ListMessagesService";
import PausePatientIntakeService from "../../../services/PatientIntakeServices/PausePatientIntakeService";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../../../services/WbotServices/SendWhatsAppMessage";

jest.mock("../../../helpers/SetTicketMessagesAsRead", () => jest.fn());
jest.mock("../../../libs/socket", () => ({ getIO: jest.fn() }));
jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {}
}));
jest.mock("../../../services/MessageServices/ListMessagesService", () =>
  jest.fn()
);
jest.mock(
  "../../../services/PatientIntakeServices/PausePatientIntakeService",
  () => jest.fn()
);
jest.mock("../../../services/TicketServices/ShowTicketService", () =>
  jest.fn()
);
jest.mock("../../../services/WbotServices/DeleteWhatsAppMessage", () =>
  jest.fn()
);
jest.mock("../../../services/WbotServices/SendWhatsAppMedia", () => jest.fn());
jest.mock("../../../services/WbotServices/SendWhatsAppMessage", () =>
  jest.fn()
);

describe("MessageController.store", () => {
  const ticket = { id: 42 } as any;
  const response = { send: jest.fn() } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (ShowTicketService as jest.Mock).mockResolvedValue(ticket);
    (PausePatientIntakeService as jest.Mock).mockResolvedValue(true);
    (SendWhatsAppMessage as jest.Mock).mockResolvedValue({});
    (SendWhatsAppMedia as jest.Mock).mockResolvedValue({});
  });

  it("pauses intake before sending a human text message", async () => {
    const request = {
      params: { ticketId: "42" },
      body: { body: "Olá, aqui é a atendente" },
      files: undefined,
      user: { id: "7" }
    } as any;

    await store(request, response);

    expect(PausePatientIntakeService).toHaveBeenCalledWith(ticket, 7);
    expect(SendWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        ticket,
        sentByUserId: 7,
        origin: "HUMAN"
      })
    );
    expect(
      (PausePatientIntakeService as jest.Mock).mock.invocationCallOrder[0]
    ).toBeLessThan(
      (SendWhatsAppMessage as jest.Mock).mock.invocationCallOrder[0]
    );
  });

  it("also pauses intake before sending human media", async () => {
    const media = { originalname: "foto.jpg" } as any;
    const request = {
      params: { ticketId: "42" },
      body: {},
      files: [media],
      user: { id: "8" }
    } as any;

    await store(request, response);

    expect(PausePatientIntakeService).toHaveBeenCalledWith(ticket, 8);
    expect(SendWhatsAppMedia).toHaveBeenCalledWith({
      media,
      ticket,
      sentByUserId: 8,
      origin: "HUMAN"
    });
  });
});

describe("MessageController.index", () => {
  const response = { json: jest.fn() } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    response.json.mockReturnValue(response);
  });

  it("keeps a pending ticket unread while it is only being previewed", async () => {
    const ticket = { id: 42, status: "pending" } as any;
    (ListMessagesService as jest.Mock).mockResolvedValue({
      count: 1,
      messages: [{ id: "message-1" }],
      ticket,
      hasMore: false
    });

    await index(
      {
        params: { ticketId: "42" },
        query: { pageNumber: "1" }
      } as any,
      response
    );

    expect(SetTicketMessagesAsRead).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ ticket, count: 1 })
    );
  });

  it("marks messages as read after the ticket has been accepted", async () => {
    const ticket = { id: 42, status: "open" } as any;
    (ListMessagesService as jest.Mock).mockResolvedValue({
      count: 1,
      messages: [{ id: "message-1" }],
      ticket,
      hasMore: false
    });

    await index(
      {
        params: { ticketId: "42" },
        query: { pageNumber: "1" }
      } as any,
      response
    );

    expect(SetTicketMessagesAsRead).toHaveBeenCalledWith(ticket);
  });
});
