import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import { getIO, emitTicketEvent } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";
import ShowUserService from "../UserServices/ShowUserService";
import { canAccessTicket } from "../../helpers/TicketAccessPolicy";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import ShowTicketService from "./ShowTicketService";
import RecordTicketEventService from "./RecordTicketEventService";
import { withLease } from "../MessagingServices/state";
import CancelPendingServiceRatingsService from "../ServiceRatingServices/CancelPendingServiceRatingsService";

interface TicketData {
  status?: string;
  userId?: number;
  queueId?: number;
  whatsappId?: number;
}

interface Request {
  ticketData: TicketData;
  ticketId: string | number;
  actorUserId?: number | null;
}

interface Response {
  ticket: Ticket;
  oldStatus: string;
  oldUserId: number | undefined;
}

const updateTicket = async ({
  ticketData,
  ticketId,
  actorUserId = null
}: Request): Promise<Response> => {
  const { status, userId, queueId, whatsappId } = ticketData;

  const ticket = await ShowTicketService(ticketId);
  if (actorUserId) {
    const actor = await ShowUserService(actorUserId);
    if (
      !canAccessTicket(actor, ticket) ||
      (actor.profile !== "admin" && ticket.userId && ticket.userId !== actor.id)
    )
      throw new AppError("ERR_NO_PERMISSION", 403);
    if (status && !["open", "pending", "closed"].includes(status))
      throw new AppError("ERR_INVALID_TICKET_STATUS", 400);
    if (
      actor.profile !== "admin" &&
      queueId &&
      !actor.queues.some(queue => queue.id === queueId)
    )
      throw new AppError("ERR_NO_PERMISSION", 403);
    if (userId) {
      const assignee = await ShowUserService(userId);
      const targetQueue = queueId === undefined ? ticket.queueId : queueId;
      if (
        targetQueue &&
        assignee.profile !== "admin" &&
        !assignee.queues.some(queue => queue.id === targetQueue)
      )
        throw new AppError("ERR_INVALID_TICKET_ASSIGNEE", 400);
    }
  }
  await SetTicketMessagesAsRead(ticket);

  if (whatsappId && ticket.whatsappId !== whatsappId) {
    await CheckContactOpenTickets(ticket.contactId, whatsappId);
  }

  const oldStatus = ticket.status;
  const oldUserId = ticket.userId || ticket.user?.id;
  const oldQueueId = ticket.queueId;

  if (oldStatus === "closed") {
    await CheckContactOpenTickets(ticket.contact.id, ticket.whatsappId);
  }

  await ticket.update({
    status,
    queueId,
    userId,
    ...(status && status !== oldStatus
      ? {
          awaitingPatientSince: null,
          inactivityClosingAt: null,
          inactivityNoticeSentAt: null,
          inactivityNoticeMessageId: null,
          closedByInactivity: false,
          inactivityPreviousUserId: null
        }
      : {})
  });

  if (whatsappId) {
    await ticket.update({
      whatsappId
    });
  }

  await ticket.reload();

  const newUserId = ticket.userId || null;
  const newQueueId = ticket.queueId || null;
  let eventType:
    | "ACCEPTED"
    | "TRANSFERRED"
    | "CLOSED_BY_USER"
    | "REOPENED"
    | "RETURNED_TO_QUEUE"
    | undefined;

  if (oldStatus !== "closed" && ticket.status === "closed") {
    eventType = "CLOSED_BY_USER";
  } else if (oldStatus === "closed" && ticket.status !== "closed") {
    eventType = "REOPENED";
  } else if (oldUserId && !newUserId) {
    eventType = "RETURNED_TO_QUEUE";
  } else if (!oldUserId && newUserId) {
    eventType = "ACCEPTED";
  } else if (oldUserId !== newUserId || (oldQueueId || null) !== newQueueId) {
    eventType = "TRANSFERRED";
  }

  if (eventType) {
    await RecordTicketEventService({
      ticketId: ticket.id,
      eventType,
      performedByUserId: actorUserId,
      previousUserId: oldUserId || null,
      newUserId,
      previousQueueId: oldQueueId || null,
      newQueueId,
      metadata: { previousStatus: oldStatus, newStatus: ticket.status }
    });
  }

  if (oldStatus === "closed" && ticket.status !== "closed") {
    await CancelPendingServiceRatingsService(
      ticket.contactId,
      ticket.whatsappId
    );
  }

  const io = getIO();

  if (ticket.status !== oldStatus || ticket.user?.id !== oldUserId) {
    io.to(oldStatus).emit("ticket", {
      action: "delete",
      ticketId: ticket.id
    });
  }

  await emitTicketEvent(ticket, "ticket", {
    action: "update",
    ticket
  });

  return { ticket, oldStatus, oldUserId };
};

const UpdateTicketService = (request: Request): Promise<Response> =>
  withLease(`ticket-update:${request.ticketId}`, () => updateTicket(request));
export default UpdateTicketService;
