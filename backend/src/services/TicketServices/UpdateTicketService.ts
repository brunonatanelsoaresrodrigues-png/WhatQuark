import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import { getIO } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import ShowTicketService from "./ShowTicketService";
import RecordTicketEventService from "./RecordTicketEventService";

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

const UpdateTicketService = async ({
  ticketData,
  ticketId,
  actorUserId = null
}: Request): Promise<Response> => {
  const { status, userId, queueId, whatsappId } = ticketData;

  const ticket = await ShowTicketService(ticketId);
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

  const io = getIO();

  if (ticket.status !== oldStatus || ticket.user?.id !== oldUserId) {
    io.to(oldStatus).emit("ticket", {
      action: "delete",
      ticketId: ticket.id
    });
  }

  io.to(ticket.status)
    .to("notification")
    .to(ticketId.toString())
    .emit("ticket", {
      action: "update",
      ticket
    });

  return { ticket, oldStatus, oldUserId };
};

export default UpdateTicketService;
