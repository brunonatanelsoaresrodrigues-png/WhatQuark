import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import SetTicketWaitingForPatientService from "./SetTicketWaitingForPatientService";

interface Request {
  ticket: Ticket;
  message: Message;
}

const HandleTicketMessageForInactivity = async ({
  ticket,
  message
}: Request): Promise<void> => {
  if (ticket.isGroup) return;

  if (!message.fromMe) {
    if (ticket.awaitingPatientSince || ticket.inactivityClosingAt) {
      await SetTicketWaitingForPatientService({
        ticketId: ticket.id,
        waiting: false,
        messageId: message.id
      });
    }
    return;
  }

  if (ticket.status === "open" && /\?/.test(message.body || "")) {
    await SetTicketWaitingForPatientService({
      ticketId: ticket.id,
      waiting: true,
      messageId: message.id,
      automatic: true
    });
  }
};

export default HandleTicketMessageForInactivity;
