import Message from "../../../models/Message";
import Ticket from "../../../models/Ticket";
import TicketInactivityEvent from "../../../models/TicketInactivityEvent";
import { getTicketInactivityConfig } from "../../../services/TicketInactivityServices/config";
import SetTicketWaitingForPatientService from "../../../services/TicketInactivityServices/SetTicketWaitingForPatientService";
import { emitTicketInactivityUpdate } from "../../../services/TicketInactivityServices/ticketEvents";
import RecordTicketEventService from "../../../services/TicketServices/RecordTicketEventService";

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { findByPk: jest.fn(), findOne: jest.fn() }
}));
jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));
jest.mock("../../../models/TicketInactivityEvent", () => ({
  __esModule: true,
  default: { create: jest.fn() }
}));
jest.mock("../../../services/TicketInactivityServices/config", () => ({
  getTicketInactivityConfig: jest.fn()
}));
jest.mock("../../../services/TicketInactivityServices/ticketEvents", () => ({
  emitTicketInactivityUpdate: jest.fn()
}));
jest.mock("../../../services/TicketServices/RecordTicketEventService", () =>
  jest.fn()
);

const outgoingMessage = {
  id: "out-1",
  fromMe: true,
  createdAt: new Date("2026-08-20T12:00:00-03:00")
};

const makeTicket = (overrides: Record<string, unknown> = {}) => ({
  id: 7,
  status: "open",
  userId: 3,
  isGroup: false,
  awaitingPatientSince: null,
  inactivityClosingAt: null,
  update: jest.fn().mockResolvedValue(undefined),
  ...overrides
});

describe("SetTicketWaitingForPatientService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getTicketInactivityConfig as jest.Mock).mockReturnValue({ enabled: true });
    (Message.findOne as jest.Mock).mockResolvedValue(outgoingMessage);
    (Message.findByPk as jest.Mock).mockResolvedValue(outgoingMessage);
    (TicketInactivityEvent.create as jest.Mock).mockResolvedValue({});
    (emitTicketInactivityUpdate as jest.Mock).mockResolvedValue({ id: 7 });
  });

  it("starts the timer only after an outgoing clinic message", async () => {
    const ticket = makeTicket();
    (Ticket.findByPk as jest.Mock).mockResolvedValue(ticket);

    await SetTicketWaitingForPatientService({
      ticketId: 7,
      waiting: true,
      userId: 3
    });

    expect(ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        awaitingPatientSince: expect.any(Date),
        inactivityClosingAt: null,
        inactivityNoticeSentAt: null
      })
    );
    expect(TicketInactivityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 7,
        eventType: "WAITING_STARTED",
        messageId: "out-1"
      })
    );
    expect(RecordTicketEventService).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 7,
        eventType: "WAITING_PATIENT",
        metadata: expect.objectContaining({ triggeredManually: true })
      })
    );
  });

  it("cancels a running timer without closing the ticket", async () => {
    const ticket = makeTicket({
      awaitingPatientSince: new Date(),
      inactivityClosingAt: new Date()
    });
    (Ticket.findByPk as jest.Mock).mockResolvedValue(ticket);

    await SetTicketWaitingForPatientService({
      ticketId: 7,
      waiting: false,
      messageId: "incoming-audio"
    });

    expect(ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        awaitingPatientSince: null,
        inactivityClosingAt: null
      })
    );
    expect(TicketInactivityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "WAITING_CANCELLED",
        messageId: "incoming-audio"
      })
    );
  });

  it("rejects a timer when the patient sent the last message", async () => {
    const ticket = makeTicket();
    (Ticket.findByPk as jest.Mock).mockResolvedValue(ticket);
    (Message.findOne as jest.Mock).mockResolvedValue({
      ...outgoingMessage,
      fromMe: false
    });

    await expect(
      SetTicketWaitingForPatientService({ ticketId: 7, waiting: true })
    ).rejects.toEqual(
      expect.objectContaining({
        message: "ERR_INACTIVITY_LAST_MESSAGE_NOT_FROM_CLINIC"
      })
    );
    expect(ticket.update).not.toHaveBeenCalled();
  });

  it("rejects manual activation while the feature is disabled", async () => {
    const ticket = makeTicket();
    (Ticket.findByPk as jest.Mock).mockResolvedValue(ticket);
    (getTicketInactivityConfig as jest.Mock).mockReturnValue({
      enabled: false
    });

    await expect(
      SetTicketWaitingForPatientService({
        ticketId: 7,
        waiting: true,
        messageId: "out-1"
      })
    ).rejects.toEqual(
      expect.objectContaining({ message: "ERR_INACTIVITY_AUTOMATION_DISABLED" })
    );
  });
});
