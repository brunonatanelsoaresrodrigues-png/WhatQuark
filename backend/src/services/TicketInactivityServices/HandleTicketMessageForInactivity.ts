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

  // O início é deliberadamente manual pelo botão "Aguardar paciente".
  // Mensagens da clínica, inclusive perguntas, nunca iniciam o cronômetro.
};

export default HandleTicketMessageForInactivity;
