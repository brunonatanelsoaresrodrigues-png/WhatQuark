import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import ResolveMessageHistoryTicketIdsService from "./ResolveMessageHistoryTicketIdsService";

const include = [
  "contact",
  {
    model: Message,
    as: "quotedMsg",
    include: ["contact"]
  }
];

const ShowMessageContextService = async ({
  ticketId,
  messageId,
  userId
}: {
  ticketId: string;
  messageId: string;
  userId: string;
}) => {
  const { ticketIds } = await ResolveMessageHistoryTicketIdsService(
    ticketId,
    userId
  );
  const target = await Message.findOne({
    where: { id: messageId, ticketId: { [Op.in]: ticketIds } },
    include
  });
  if (!target) throw new AppError("ERR_NO_MESSAGE_FOUND", 404);

  const olderWhere = {
    ticketId: { [Op.in]: ticketIds },
    [Op.or]: [
      { createdAt: { [Op.lt]: target.createdAt } },
      { createdAt: target.createdAt, id: { [Op.lt]: target.id } }
    ]
  };
  const newerWhere = {
    ticketId: { [Op.in]: ticketIds },
    [Op.or]: [
      { createdAt: { [Op.gt]: target.createdAt } },
      { createdAt: target.createdAt, id: { [Op.gt]: target.id } }
    ]
  };
  const [olderRows, newerRows] = await Promise.all([
    Message.findAll({
      where: olderWhere,
      include,
      limit: 11,
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"]
      ]
    }),
    Message.findAll({
      where: newerWhere,
      include,
      limit: 11,
      order: [
        ["createdAt", "ASC"],
        ["id", "ASC"]
      ]
    })
  ]);
  const hasOlder = olderRows.length > 10;
  const hasNewer = newerRows.length > 10;
  const older = olderRows.slice(0, 10).reverse();
  const newer = newerRows.slice(0, 10);

  return {
    messages: [...older, target, ...newer],
    targetMessageId: target.id,
    hasOlder,
    hasNewer
  };
};

export default ShowMessageContextService;
