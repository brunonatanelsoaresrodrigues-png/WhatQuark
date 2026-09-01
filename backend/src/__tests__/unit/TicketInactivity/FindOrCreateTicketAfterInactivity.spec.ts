import Ticket from "../../../models/Ticket";
import TicketInactivityEvent from "../../../models/TicketInactivityEvent";
import User from "../../../models/User";
import UserQueue from "../../../models/UserQueue";
import FindOrCreateTicketService from "../../../services/TicketServices/FindOrCreateTicketService";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { emitTicketInactivityUpdate } from "../../../services/TicketInactivityServices/ticketEvents";
import RecordTicketEventService from "../../../services/TicketServices/RecordTicketEventService";

jest.mock("../../../services/MessagingServices/state", () => ({
  withLease: jest.fn((_id: string, action: () => Promise<any>) => action())
}));

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
jest.mock("../../../services/TicketServices/ShowTicketService", () =>
  jest.fn()
);
jest.mock("../../../services/TicketInactivityServices/ticketEvents", () => ({
  emitTicketInactivityUpdate: jest.fn()
}));
jest.mock("../../../services/TicketServices/RecordTicketEventService", () =>
  jest.fn()
);

const makeClosedTicket = () => {
  const ticket: any = {
    id: 31,
    status: "closed",
    userId: 8,
    queueId: 2,
    inactivityPreviousUserId: 8
  };
  ticket.update = jest.fn().mockImplementation(async values => {
    Object.assign(ticket, values);
  });
  return ticket;
};

describe("FindOrCreateTicketService inactivity reopening", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (TicketInactivityEvent.create as jest.Mock).mockResolvedValue({});
    (emitTicketInactivityUpdate as jest.Mock).mockResolvedValue({});
  });

  it("reopens the same history for the previous queue-eligible attendant", async () => {
    const closedTicket = makeClosedTicket();
    (Ticket.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(closedTicket);
    (User.findByPk as jest.Mock).mockResolvedValue({ id: 8 });
    (UserQueue.count as jest.Mock).mockResolvedValue(1);
    (ShowTicketService as jest.Mock).mockImplementation(
      async () => closedTicket
    );

    const result = await FindOrCreateTicketService({ id: 50 } as any, 1, 1);

    expect(result.id).toBe(31);
    expect(closedTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "open",
        userId: 8,
        closedByInactivity: false
      })
    );
    expect(TicketInactivityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "REOPENED",
        reason: expect.stringContaining("atendente anterior")
      })
    );
    expect(emitTicketInactivityUpdate).toHaveBeenCalledWith(31, "closed");
    expect(RecordTicketEventService).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 31,
        eventType: "REOPENED",
        newUserId: 8
      })
    );
  });

  it("returns the same ticket to its queue when the previous user is unavailable", async () => {
    const closedTicket = makeClosedTicket();
    (Ticket.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(closedTicket);
    (User.findByPk as jest.Mock).mockResolvedValue(null);
    (ShowTicketService as jest.Mock).mockImplementation(
      async () => closedTicket
    );

    await FindOrCreateTicketService({ id: 50 } as any, 1, 1);

    expect(closedTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        userId: null,
        closedByInactivity: false
      })
    );
    expect(TicketInactivityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringContaining("fila") })
    );
  });
});
