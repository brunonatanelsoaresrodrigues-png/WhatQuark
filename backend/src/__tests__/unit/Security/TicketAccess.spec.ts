import {
  canAccessTicket,
  canManageTicket,
  ticketAccessWhere
} from "../../../helpers/TicketAccessPolicy";
import { Op } from "sequelize";

const user = { id: 5, profile: "user", queues: [{ id: 2 }] };
const ticket = {
  id: 10,
  status: "open",
  userId: 5,
  queueId: 2,
  ticketType: "PATIENT"
};

describe("ticket access", () => {
  it("does not turn cross-agent viewing into permission to mutate", () => {
    const supervisor = { ...user, canViewOtherAgentsTickets: true };
    expect(canManageTicket(supervisor, { ...ticket, userId: 6 })).toBe(false);
    expect(canManageTicket(supervisor, ticket)).toBe(true);
    expect(
      canManageTicket(user, { ...ticket, userId: null, status: "pending" })
    ).toBe(true);
    expect(
      canManageTicket(supervisor, { ...ticket, userId: null, status: "open" })
    ).toBe(false);
    expect(
      canManageTicket({ ...user, profile: "admin" }, { ...ticket, userId: 6 })
    ).toBe(true);
  });
  it("preserves explicitly permitted cross-agent viewing but enforces queues and internal privacy", () => {
    const supervisor = { ...user, canViewOtherAgentsTickets: true };
    expect(canAccessTicket(supervisor, { ...ticket, userId: 6 })).toBe(true);
    expect(
      canAccessTicket(supervisor, { ...ticket, userId: 6, queueId: 3 })
    ).toBe(false);
    expect(
      canAccessTicket(supervisor, { ...ticket, ticketType: "INTERNAL_REPORT" })
    ).toBe(false);
  });
  it("allows assigned tickets in permitted queues", () => {
    expect(canAccessTicket(user, ticket)).toBe(true);
  });
  it("allows pending tickets in permitted queues", () => {
    expect(
      canAccessTicket(user, { ...ticket, status: "pending", userId: null })
    ).toBe(true);
  });
  it("rejects other attendants and queues", () => {
    expect(canAccessTicket(user, { ...ticket, userId: 6 })).toBe(false);
    expect(canAccessTicket(user, { ...ticket, queueId: 3 })).toBe(false);
    expect(
      canAccessTicket(user, { ...ticket, status: "pending", queueId: 3 })
    ).toBe(false);
  });
  it("keeps internal reports restricted to admins", () => {
    expect(
      canAccessTicket(user, { ...ticket, ticketType: "INTERNAL_REPORT" })
    ).toBe(false);
    expect(
      canAccessTicket(
        { ...user, profile: "admin" },
        { ...ticket, ticketType: "INTERNAL_REPORT" }
      )
    ).toBe(true);
  });
  it("allows unqueued pending tickets but not another attendant's open ticket", () => {
    expect(
      canAccessTicket(user, {
        ...ticket,
        queueId: null,
        status: "pending",
        userId: null
      })
    ).toBe(true);
    expect(canAccessTicket(user, { ...ticket, queueId: null, userId: 6 })).toBe(
      false
    );
  });
  it("builds a server-owned scope independent of client filters", () => {
    const scope: any = ticketAccessWhere(user);
    expect(scope.ticketType).toBe("PATIENT");
    expect(scope[Op.and]).toHaveLength(2);
    expect(ticketAccessWhere({ ...user, profile: "unknown" })).toEqual({
      id: -1
    });
  });
});
