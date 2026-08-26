import AppError from "../../errors/AppError";
import { Op } from "sequelize";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";

interface Request {
  ticketId: string;
  pageNumber?: string;
  beforeMessageId?: string;
}

interface Response {
  messages: Message[];
  ticket: Ticket;
  count: number;
  hasMore: boolean;
}

const ListMessagesService = async ({
  pageNumber = "1",
  beforeMessageId,
  ticketId
}: Request): Promise<Response> => {
  const ticket = await ShowTicketService(ticketId);

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  // await setMessagesAsRead(ticket);
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const relatedTickets = await Ticket.findAll({
    attributes: ["id"],
    where: {
      contactId: ticket.contactId,
      whatsappId: ticket.whatsappId,
      ticketType: ticket.ticketType
    }
  });
  const relatedTicketIds = relatedTickets.map(
    relatedTicket => relatedTicket.id
  );
  const historyWhere: any = {
    ticketId: { [Op.in]: relatedTicketIds }
  };

  if (beforeMessageId) {
    const cursorMessage = await Message.findOne({
      attributes: ["id", "createdAt"],
      where: {
        id: beforeMessageId,
        ticketId: { [Op.in]: relatedTicketIds }
      }
    });
    if (cursorMessage) {
      historyWhere[Op.or] = [
        { createdAt: { [Op.lt]: cursorMessage.createdAt } },
        {
          createdAt: cursorMessage.createdAt,
          id: { [Op.lt]: cursorMessage.id }
        }
      ];
    }
  }

  const [count, rows] = await Promise.all([
    Message.count({
      where: { ticketId: { [Op.in]: relatedTicketIds } }
    }),
    Message.findAll({
      where: historyWhere,
      limit: beforeMessageId ? limit + 1 : limit,
      include: [
        "contact",
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"]
        }
      ],
      offset: beforeMessageId ? 0 : offset,
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"]
      ]
    })
  ]);

  const hasMore = beforeMessageId
    ? rows.length > limit
    : count > offset + rows.length;
  const messages = rows.slice(0, limit);

  return {
    messages: messages.reverse(),
    ticket,
    count,
    hasMore
  };
};

export default ListMessagesService;
