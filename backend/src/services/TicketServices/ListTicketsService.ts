import {
  Op,
  fn,
  where,
  col,
  literal,
  Includeable,
  WhereOptions
} from "sequelize";
import { startOfDay, endOfDay, parseISO } from "date-fns";

import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import ShowUserService from "../UserServices/ShowUserService";
import Whatsapp from "../../models/Whatsapp";
import { ticketAccessWhere } from "../../helpers/TicketAccessPolicy";
import ResolveTicketAssigneeFilterService, {
  TicketAssigneeFilter
} from "./ResolveTicketAssigneeFilterService";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  status?: string;
  date?: string;
  showAll?: string;
  assignee?: string;
  userId: string;
  withUnreadMessages?: string;
  queueIds: number[];
}

interface Response {
  tickets: Ticket[];
  count: number;
  hasMore: boolean;
}

export const buildTicketAssigneeCondition = (
  filter: TicketAssigneeFilter,
  requesterUserId: string | number
): WhereOptions | undefined => {
  if (filter.mode === "all") return undefined;
  if (filter.mode === "unassigned") return { userId: null };
  if (filter.mode === "user") return { userId: filter.userId };
  return {
    [Op.or]: [{ userId: requesterUserId }, { status: "pending" }]
  };
};

const latestMessageActivitySql = `COALESCE(
  (SELECT MAX(activityMessage.createdAt)
   FROM Messages AS activityMessage
   WHERE activityMessage.ticketId = Ticket.id),
  Ticket.updatedAt,
  Ticket.createdAt
)`;

const oldestUnreadActivitySql = `COALESCE(
  (SELECT MIN(queueMessage.createdAt)
   FROM Messages AS queueMessage
   WHERE queueMessage.ticketId = Ticket.id
     AND queueMessage.fromMe = 0
     AND queueMessage.read = 0),
  Ticket.updatedAt,
  Ticket.createdAt
)`;

export const ticketSortDirection = (status?: string): "ASC" | "DESC" =>
  status === "pending" ? "ASC" : "DESC";

export const ticketSortAtSql = (status?: string): string => {
  if (status === "pending") return oldestUnreadActivitySql;
  if (status === "closed") return "Ticket.updatedAt";
  return latestMessageActivitySql;
};

const ListTicketsService = async ({
  searchParam = "",
  pageNumber = "1",
  queueIds,
  status,
  date,
  showAll,
  assignee,
  userId,
  withUnreadMessages
}: Request): Promise<Response> => {
  const viewer = await ShowUserService(userId);
  const assigneeFilter = await ResolveTicketAssigneeFilterService({
    requesterUserId: userId,
    requestedAssignee: assignee,
    legacyShowAll: showAll
  });

  const andConditions: WhereOptions[] = [
    { queueId: { [Op.or]: [queueIds, null] } }
  ];
  const assigneeCondition = buildTicketAssigneeCondition(
    assigneeFilter,
    userId
  );
  if (assigneeCondition) andConditions.push(assigneeCondition);

  let whereCondition: WhereOptions = {
    [Op.and]: andConditions
  };
  let includeCondition: Includeable[];

  includeCondition = [
    {
      model: Contact,
      as: "contact",
      attributes: ["id", "name", "number", "profilePicUrl"]
    },
    {
      model: Queue,
      as: "queue",
      attributes: ["id", "name", "color"]
    },
    {
      model: Whatsapp,
      as: "whatsapp",
      attributes: ["name"]
    }
  ];

  if (status) {
    whereCondition = {
      ...whereCondition,
      status
    };
  }

  if (searchParam) {
    const sanitizedSearchParam = searchParam.toLocaleLowerCase().trim();

    includeCondition = [
      ...includeCondition,
      {
        model: Message,
        as: "messages",
        attributes: ["id", "body"],
        where: {
          body: where(
            fn("LOWER", col("body")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        required: false,
        duplicating: false
      }
    ];

    whereCondition = {
      ...whereCondition,
      [Op.and]: [
        ...andConditions,
        {
          [Op.or]: [
            {
              "$contact.name$": where(
                fn("LOWER", col("contact.name")),
                "LIKE",
                `%${sanitizedSearchParam}%`
              )
            },
            {
              "$contact.number$": { [Op.like]: `%${sanitizedSearchParam}%` }
            },
            {
              "$message.body$": where(
                fn("LOWER", col("body")),
                "LIKE",
                `%${sanitizedSearchParam}%`
              )
            }
          ]
        }
      ]
    };
  }

  if (date) {
    whereCondition = {
      ...whereCondition,
      createdAt: {
        [Op.between]: [+startOfDay(parseISO(date)), +endOfDay(parseISO(date))]
      }
    };
  }

  if (withUnreadMessages === "true") {
    const user = await ShowUserService(userId);
    const userQueueIds = user.queues.map(queue => queue.id);

    whereCondition = {
      ...whereCondition,
      queueId: { [Op.or]: [userQueueIds, null] },
      unreadMessages: { [Op.gt]: 0 }
    };
  }

  const limit = 40;
  const offset = limit * (+pageNumber - 1);
  const sortAtSql = ticketSortAtSql(status);
  const sortDirection = ticketSortDirection(status);

  const { count, rows: tickets } = await Ticket.findAndCountAll({
    where: { [Op.and]: [ticketAccessWhere(viewer), whereCondition] },
    include: includeCondition,
    attributes: {
      include: [[literal(sortAtSql), "sortAt"]]
    },
    distinct: true,
    limit,
    offset,
    order: [[literal(sortAtSql), sortDirection], ["id", sortDirection]]
  });

  const hasMore = count > offset + tickets.length;

  return {
    tickets,
    count,
    hasMore
  };
};

export default ListTicketsService;
