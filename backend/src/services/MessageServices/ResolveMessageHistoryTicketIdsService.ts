import { Op } from "sequelize";
import { ticketAccessWhere } from "../../helpers/TicketAccessPolicy";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";
import ShowUserService from "../UserServices/ShowUserService";

const ResolveMessageHistoryTicketIdsService = async (
  ticketId: string | number,
  userId?: string
): Promise<{ ticket: Ticket; ticketIds: number[] }> => {
  const ticket = await ShowTicketService(ticketId);
  const viewer = userId ? await ShowUserService(userId) : null;
  const relatedTickets = await Ticket.findAll({
    attributes: ["id"],
    where: {
      contactId: ticket.contactId,
      whatsappId: ticket.whatsappId,
      ticketType: ticket.ticketType,
      [Op.and]: [viewer ? ticketAccessWhere(viewer) : { id: ticket.id }]
    }
  });

  return {
    ticket,
    ticketIds: relatedTickets.map(relatedTicket => relatedTicket.id)
  };
};

export default ResolveMessageHistoryTicketIdsService;
