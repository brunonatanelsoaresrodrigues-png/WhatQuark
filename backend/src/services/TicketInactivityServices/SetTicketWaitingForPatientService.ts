import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import TicketInactivityEvent from "../../models/TicketInactivityEvent";
import { getTicketInactivityConfig } from "./config";
import { emitTicketInactivityUpdate } from "./ticketEvents";

interface Request {
  ticketId: number | string;
  waiting: boolean;
  userId?: number | null;
  messageId?: string | null;
  automatic?: boolean;
}

const SetTicketWaitingForPatientService = async ({
  ticketId,
  waiting,
  userId,
  messageId,
  automatic = false
}: Request): Promise<Ticket> => {
  const config = getTicketInactivityConfig();
  const ticket = await Ticket.findByPk(ticketId);

  if (!ticket) throw new AppError("ERR_NO_TICKET_FOUND", 404);
  if (ticket.isGroup) {
    throw new AppError("ERR_INACTIVITY_GROUP_NOT_SUPPORTED", 400);
  }

  if (waiting) {
    if (!config.enabled) {
      if (automatic) return ticket;
      throw new AppError("ERR_INACTIVITY_AUTOMATION_DISABLED", 503);
    }
    if (ticket.status !== "open") {
      throw new AppError("ERR_INACTIVITY_TICKET_MUST_BE_OPEN", 400);
    }

    const lastMessage = messageId
      ? await Message.findByPk(messageId)
      : await Message.findOne({
          where: { ticketId: ticket.id, isDeleted: false },
          order: [["createdAt", "DESC"]]
        });

    if (!lastMessage || !lastMessage.fromMe) {
      throw new AppError("ERR_INACTIVITY_LAST_MESSAGE_NOT_FROM_CLINIC", 400);
    }

    const startedAt = lastMessage.createdAt || new Date();
    await ticket.update({
      awaitingPatientSince: startedAt,
      inactivityClosingAt: null,
      inactivityNoticeSentAt: null,
      inactivityNoticeMessageId: null,
      closedByInactivity: false
    });

    await TicketInactivityEvent.create({
      ticketId: ticket.id,
      eventType: "WAITING_STARTED",
      reason: "Aguardando resposta do paciente",
      userId: userId || ticket.userId || null,
      messageId: lastMessage.id,
      occurredAt: new Date()
    });
  } else {
    if (!ticket.awaitingPatientSince && !ticket.inactivityClosingAt) {
      return ticket;
    }

    await ticket.update({
      awaitingPatientSince: null,
      inactivityClosingAt: null,
      inactivityNoticeSentAt: null,
      inactivityNoticeMessageId: null
    });

    await TicketInactivityEvent.create({
      ticketId: ticket.id,
      eventType: "WAITING_CANCELLED",
      reason: "Espera pelo paciente cancelada",
      userId: userId || ticket.userId || null,
      messageId: messageId || null,
      occurredAt: new Date()
    });
  }

  return emitTicketInactivityUpdate(ticket.id);
};

export default SetTicketWaitingForPatientService;
