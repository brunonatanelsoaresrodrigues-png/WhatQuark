import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import ShowTicketService from "./ShowTicketService";
import { withLease } from "../MessagingServices/state";

// Outbound notices belong in history. Only an inbound message opens an attendance.
export default async function FindNotificationTicket(
  contact: Contact,
  whatsappId: number
): Promise<Ticket> {
  return withLease(
    `notification-ticket:${whatsappId}:${contact.id}`,
    async () => {
      let ticket = await Ticket.findOne({
        where: { contactId: contact.id, whatsappId, ticketType: "PATIENT" },
        order: [["updatedAt", "DESC"]]
      });
      if (!ticket)
        ticket = await Ticket.create({
          contactId: contact.id,
          whatsappId,
          ticketType: "PATIENT",
          status: "closed",
          unreadMessages: 0,
          isGroup: false
        });
      return ShowTicketService(ticket.id);
    }
  );
}
