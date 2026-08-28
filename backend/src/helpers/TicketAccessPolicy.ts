import { Op, WhereOptions } from "sequelize";

export interface TicketViewer {
  id: number | string;
  profile: string;
  queues: { id: number }[];
  canViewOtherAgentsTickets?: boolean;
}

export interface AccessibleTicket {
  id: number;
  userId?: number | null;
  queueId?: number | null;
  status: string;
  ticketType?: string;
}

export const canAccessTicket = (
  user: TicketViewer,
  ticket: AccessibleTicket
): boolean => {
  if (user.profile === "admin") return true;
  if (user.profile !== "user" || ticket.ticketType === "INTERNAL_REPORT")
    return false;
  const inQueue =
    ticket.queueId == null ||
    user.queues.some(queue => queue.id === ticket.queueId);
  return (
    inQueue &&
    (user.canViewOtherAgentsTickets === true ||
      Number(ticket.userId) === Number(user.id) ||
      ticket.status === "pending")
  );
};

export const canManageTicket = (
  user: TicketViewer,
  ticket: AccessibleTicket
): boolean =>
  canAccessTicket(user, ticket) &&
  (user.profile === "admin" ||
    Number(ticket.userId) === Number(user.id) ||
    (!ticket.userId && ticket.status === "pending"));

export const ticketAccessWhere = (user: TicketViewer): WhereOptions => {
  if (user.profile === "admin") return {};
  if (user.profile !== "user") return { id: -1 };
  return {
    ticketType: "PATIENT",
    [Op.and]: [
      ...(user.canViewOtherAgentsTickets === true
        ? []
        : [{ [Op.or]: [{ userId: user.id }, { status: "pending" }] }]),
      {
        [Op.or]: [
          { queueId: { [Op.in]: user.queues.map(queue => queue.id) } },
          { queueId: null }
        ]
      }
    ]
  };
};
