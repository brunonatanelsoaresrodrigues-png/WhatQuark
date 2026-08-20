import sequelize from "../../../database";
import Message from "../../../models/Message";
import Ticket from "../../../models/Ticket";
import TicketInactivityEvent from "../../../models/TicketInactivityEvent";
import { INACTIVITY_CLOSE_REASON } from "../../../services/TicketInactivityServices/config";
import { finalizeClosure } from "../../../services/TicketInactivityServices/TicketInactivityWorker";

jest.mock("../../../database", () => ({
  __esModule: true,
  default: {
    transaction: jest.fn()
  }
}));
jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), findByPk: jest.fn() }
}));
jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { findByPk: jest.fn(), findOne: jest.fn(), update: jest.fn() }
}));
jest.mock("../../../models/TicketInactivityEvent", () => ({
  __esModule: true,
  default: { create: jest.fn() }
}));
jest.mock("../../../models/QuarkAppointment", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));
jest.mock("../../../models/QuarkAppointmentResponse", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));
jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));
jest.mock("../../../services/WbotServices/SendWhatsAppMessage", () =>
  jest.fn()
);
jest.mock("../../../services/TicketServices/ShowTicketService", () =>
  jest.fn()
);
jest.mock("../../../services/TicketInactivityServices/ticketEvents", () => ({
  emitTicketInactivityUpdate: jest.fn()
}));

const transaction = { LOCK: { UPDATE: "UPDATE" } };
const makeTicket = () => ({
  id: 20,
  status: "open",
  userId: 4,
  awaitingPatientSince: new Date("2026-08-20T12:00:00-03:00"),
  inactivityClosingAt: new Date("2026-08-20T12:15:00-03:00"),
  update: jest.fn().mockResolvedValue(undefined)
});

describe("TicketInactivityWorker finalization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (sequelize.transaction as jest.Mock).mockImplementation(callback =>
      callback(transaction)
    );
    (TicketInactivityEvent.create as jest.Mock).mockResolvedValue({});
  });

  it("cancels the closure if an incoming message won the race", async () => {
    const ticket = makeTicket();
    (Ticket.findByPk as jest.Mock).mockResolvedValue(ticket);
    (Message.findOne as jest.Mock).mockResolvedValue({ id: "patient-audio" });

    await expect(finalizeClosure(20, "notice-1")).resolves.toBe(false);

    expect(ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        awaitingPatientSince: null,
        inactivityClosingAt: null
      }),
      { transaction }
    );
    expect(TicketInactivityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "WAITING_CANCELLED",
        messageId: "patient-audio"
      }),
      { transaction }
    );
  });

  it("closes without deleting and records the required reason", async () => {
    const ticket = makeTicket();
    (Ticket.findByPk as jest.Mock).mockResolvedValue(ticket);
    (Message.findOne as jest.Mock).mockResolvedValue(null);

    await expect(finalizeClosure(20, "notice-1")).resolves.toBe(true);

    expect(ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "closed",
        closedByInactivity: true,
        inactivityPreviousUserId: 4
      }),
      { transaction }
    );
    expect(TicketInactivityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "CLOSED",
        reason: INACTIVITY_CLOSE_REASON,
        messageId: "notice-1"
      }),
      { transaction }
    );
  });
});
