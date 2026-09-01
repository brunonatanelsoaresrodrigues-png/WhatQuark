import { getIO, emitTicketEvent } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";

export const emitTicketInactivityUpdate = async (
  ticketId: number,
  oldStatus?: string
): Promise<Ticket> => {
  const ticket = await ShowTicketService(ticketId);
  const io = getIO();

  if (oldStatus && oldStatus !== ticket.status) {
    io.to(oldStatus).emit("ticket", {
      action: "delete",
      ticketId
    });
  }

  await emitTicketEvent(ticket, "ticket", {
    action: "update",
    ticket
  });

  return ticket;
};
