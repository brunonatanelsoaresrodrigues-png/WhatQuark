import Ticket from "../../../models/Ticket";
import TicketInactivityEvent from "../../../models/TicketInactivityEvent";
import FindOrCreateTicketService from "../../../services/TicketServices/FindOrCreateTicketService";
import { writeState } from "../../../services/MessagingServices/state";

jest.mock("../../../services/MessagingServices/state", () => ({
  withLease: jest.fn((_id: string, action: () => Promise<any>) => action()),
  writeState: jest.fn()
}));
import RecordTicketEventService from "../../../services/TicketServices/RecordTicketEventService";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";

jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), create: jest.fn() }
}));
jest.mock("../../../models/TicketInactivityEvent", () => ({
  __esModule: true,
  default: { create: jest.fn() }
}));
jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));
jest.mock("../../../models/UserQueue", () => ({
  __esModule: true,
  default: { count: jest.fn() }
}));
jest.mock("../../../services/TicketInactivityServices/ticketEvents", () => ({
  emitTicketInactivityUpdate: jest.fn()
}));
jest.mock("../../../services/TicketServices/ShowTicketService", () =>
  jest.fn()
);
jest.mock("../../../services/TicketServices/RecordTicketEventService", () =>
  jest.fn()
);

const contact: any = { id: 20, isInternal: false };

describe("FindOrCreateTicketService intake lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (RecordTicketEventService as jest.Mock).mockResolvedValue({});
    (TicketInactivityEvent.create as jest.Mock).mockResolvedValue({});
  });

  it("restarts intake only when a patient returns after manual resolution", async () => {
    const closedTicket: any = {
      id: 10,
      queueId: 3,
      closedByInactivity: false,
      intakeStatus: "PAUSED_HUMAN",
      update: jest.fn(async (fields: Record<string, unknown>) =>
        Object.assign(closedTicket, fields)
      )
    };
    (Ticket.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(closedTicket);
    (ShowTicketService as jest.Mock).mockResolvedValue(closedTicket);

    await FindOrCreateTicketService(contact, 1, 1, undefined, undefined, true);

    expect(closedTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        queueId: null,
        intakeStatus: null,
        intakePausedAt: null
      })
    );
    expect(RecordTicketEventService).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "INTAKE_RESTARTED",
        previousQueueId: 3
      })
    );
    expect(writeState).toHaveBeenCalledWith("bot-pause:10", false);
    expect(writeState).toHaveBeenCalledWith("bot-review:10", null);
  });

  it("does not restart a human-paused intake after automatic inactivity closure", async () => {
    const closedTicket: any = {
      id: 11,
      queueId: 3,
      userId: null,
      inactivityPreviousUserId: null,
      closedByInactivity: true,
      intakeStatus: "PAUSED_HUMAN",
      update: jest.fn().mockResolvedValue(undefined)
    };
    (Ticket.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(closedTicket);
    (ShowTicketService as jest.Mock).mockResolvedValue(closedTicket);

    await FindOrCreateTicketService(contact, 1, 1, undefined, undefined, true);

    expect(closedTicket.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ intakeStatus: null })
    );
    expect(RecordTicketEventService).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "INTAKE_RESTARTED" })
    );
  });

  it("increments unread messages on an existing ticket for each live inbound", async () => {
    const activeTicket: any = {
      id: 12,
      unreadMessages: 4,
      update: jest.fn(async (fields: Record<string, unknown>) =>
        Object.assign(activeTicket, fields)
      )
    };
    (Ticket.findOne as jest.Mock).mockResolvedValueOnce(activeTicket);
    (ShowTicketService as jest.Mock).mockResolvedValue(activeTicket);

    await FindOrCreateTicketService(contact, 1, 0, undefined, undefined, true);

    expect(activeTicket.update).toHaveBeenCalledWith({ unreadMessages: 5 });
  });
});
