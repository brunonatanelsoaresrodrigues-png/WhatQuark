import { handleMessage } from "../../../handlers/handleWhatsappEvents";
import Message from "../../../models/Message";
import Ticket from "../../../models/Ticket";
import CreateMessageService from "../../../services/MessageServices/CreateMessageService";
import CreateOrUpdateContactService from "../../../services/ContactServices/CreateOrUpdateContactService";
import ShowWhatsAppService from "../../../services/WhatsappService/ShowWhatsAppService";
import { HandleInboundAutomation } from "../../../services/MessagingServices/HandleInboundAutomation";
import { recordInbound } from "../../../services/MessagingServices/preferences";
import HandleQuarkConfirmationReply from "../../../services/QuarkClinicServices/HandleQuarkConfirmationReply";
import HandleTicketMessageForInactivity from "../../../services/TicketInactivityServices/HandleTicketMessageForInactivity";

jest.mock("../../../database", () => ({ __esModule: true, default: {} }));
jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));
jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), create: jest.fn() }
}));
jest.mock("../../../models/ServiceRating", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock("../../../providers/WhatsApp/whatsappProvider", () => ({
  whatsappProvider: {}
}));
jest.mock("../../../libs/socket", () => ({
  emitTicketEvent: jest.fn(),
  getIO: jest.fn()
}));
jest.mock("../../../services/MessageServices/CreateMessageService", () =>
  jest.fn()
);
jest.mock(
  "../../../services/ContactServices/CreateOrUpdateContactService",
  () => jest.fn()
);
jest.mock("../../../services/WhatsappService/ShowWhatsAppService", () =>
  jest.fn()
);
jest.mock(
  "../../../services/MessagingServices/HandleInboundAutomation",
  () => ({ HandleInboundAutomation: jest.fn() })
);
jest.mock("../../../services/MessagingServices/preferences", () => ({
  recordInbound: jest.fn()
}));
jest.mock(
  "../../../services/QuarkClinicServices/HandleQuarkConfirmationReply",
  () => jest.fn()
);
jest.mock(
  "../../../services/TicketInactivityServices/HandleTicketMessageForInactivity",
  () => jest.fn()
);

const contact = {
  id: 8,
  number: "5511999999999",
  name: "Paciente",
  isGroup: false
};
const ticket = { id: 42, status: "closed", update: jest.fn() };
const message = {
  id: "history-id",
  body: "CONFIRMAR ABCD1234",
  fromMe: false,
  hasMedia: false,
  type: "chat" as const,
  timestamp: Date.now(),
  from: contact.number,
  to: "channel"
};
const context = { whatsappId: 1, unreadMessages: 0 };

beforeEach(() => {
  jest.resetAllMocks();
  (Ticket.findOne as jest.Mock).mockResolvedValue(ticket);
  (Ticket.create as jest.Mock).mockResolvedValue(ticket);
  (CreateOrUpdateContactService as jest.Mock).mockResolvedValue(contact);
  (ShowWhatsAppService as jest.Mock).mockResolvedValue({});
});

it("imports history without reopening tickets, changing unread counters or executing a confirmation/bot", async () => {
  await expect(
    handleMessage(message, contact, context, undefined, { historySync: true })
  ).resolves.toBe("created");
  expect(CreateMessageService).toHaveBeenCalledWith(
    expect.objectContaining({
      emitEvent: false,
      messageData: expect.objectContaining({
        id: message.id,
        ticketId: 42,
        body: message.body
      })
    })
  );
  expect(ticket.update).not.toHaveBeenCalled();
  expect(Ticket.create).not.toHaveBeenCalled();
  expect(recordInbound).not.toHaveBeenCalled();
  expect(HandleInboundAutomation).not.toHaveBeenCalled();
  expect(HandleQuarkConfirmationReply).not.toHaveBeenCalled();
  expect(HandleTicketMessageForInactivity).not.toHaveBeenCalled();
});

it("preserves an existing message instead of overwriting or triggering its text again", async () => {
  (Message.findByPk as jest.Mock).mockResolvedValue({
    id: message.id,
    ticketId: 42
  });
  await expect(
    handleMessage(message, contact, context, undefined, { historySync: true })
  ).resolves.toBe("duplicate");
  expect(CreateMessageService).not.toHaveBeenCalled();
  expect(CreateOrUpdateContactService).not.toHaveBeenCalled();
  expect(HandleInboundAutomation).not.toHaveBeenCalled();
});

it("creates only a closed historical ticket when no ticket exists", async () => {
  (Ticket.findOne as jest.Mock).mockResolvedValue(null);
  await handleMessage(message, contact, context, undefined, {
    historySync: true
  });
  expect(Ticket.create).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "closed",
      unreadMessages: 0,
      contactId: 8
    })
  );
  expect(ticket.update).not.toHaveBeenCalled();
  expect(HandleInboundAutomation).not.toHaveBeenCalled();
});
