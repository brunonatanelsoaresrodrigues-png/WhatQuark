import AppError from "../../errors/AppError";
import { Op } from "sequelize";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import ResolveMessageHistoryTicketIdsService from "./ResolveMessageHistoryTicketIdsService";

interface Request {
  ticketId: string;
  pageNumber?: string;
  beforeMessageId?: string;
  userId?: string;
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
  ticketId,
  userId
}: Request): Promise<Response> => {
  const { ticket, ticketIds: relatedTicketIds } =
    await ResolveMessageHistoryTicketIdsService(ticketId, userId);

  // await setMessagesAsRead(ticket);
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

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
    } else {
      throw new AppError("ERR_MESSAGE_CURSOR_NOT_FOUND", 404);
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
