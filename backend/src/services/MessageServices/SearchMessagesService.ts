import { fn, col, Op, where as sequelizeWhere } from "sequelize";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import ResolveMessageHistoryTicketIdsService from "./ResolveMessageHistoryTicketIdsService";

interface Request {
  ticketId: string;
  userId: string;
  query: string;
  pageNumber?: string;
}

const literalLikeTerm = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");

const excerptFor = (body: string, query: string): string => {
  const compact = String(body || "").replace(/\s+/g, " ").trim();
  if (compact.length <= 220) return compact;
  const index = compact.toLocaleLowerCase("pt-BR").indexOf(
    query.toLocaleLowerCase("pt-BR")
  );
  const start = Math.max(0, (index < 0 ? 0 : index) - 80);
  const end = Math.min(compact.length, start + 220);
  return `${start > 0 ? "…" : ""}${compact.slice(start, end)}${
    end < compact.length ? "…" : ""
  }`;
};

const SearchMessagesService = async ({
  ticketId,
  userId,
  query,
  pageNumber = "1"
}: Request) => {
  const normalizedQuery = String(query || "").trim().replace(/\s+/g, " ");
  if (normalizedQuery.length < 2)
    throw new AppError("ERR_MESSAGE_SEARCH_TOO_SHORT", 400);
  if (normalizedQuery.length > 100)
    throw new AppError("ERR_MESSAGE_SEARCH_TOO_LONG", 400);

  const page = Math.max(1, Number(pageNumber) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;
  const { ticketIds } = await ResolveMessageHistoryTicketIdsService(
    ticketId,
    userId
  );
  const textCondition = sequelizeWhere(fn("LOWER", col("body")), {
    [Op.like]: `%${literalLikeTerm(normalizedQuery.toLowerCase())}%`
  });
  const where = {
    ticketId: { [Op.in]: ticketIds },
    body: { [Op.ne]: null },
    [Op.and]: [textCondition]
  };

  const { rows, count } = await Message.findAndCountAll({
    where,
    attributes: [
      "id",
      "ticketId",
      "body",
      "fromMe",
      "mediaType",
      "createdAt"
    ],
    include: [{ association: "contact", attributes: ["id", "name"] }],
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"]
    ],
    limit,
    offset
  });

  return {
    results: rows.map(message => ({
      id: message.id,
      ticketId: message.ticketId,
      excerpt: excerptFor(message.body, normalizedQuery),
      fromMe: message.fromMe,
      mediaType: message.mediaType,
      createdAt: message.createdAt,
      contact: message.contact
        ? { id: message.contact.id, name: message.contact.name }
        : null
    })),
    count,
    pageNumber: page,
    hasMore: count > offset + rows.length
  };
};

export default SearchMessagesService;
