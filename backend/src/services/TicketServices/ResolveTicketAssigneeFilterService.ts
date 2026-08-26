import AppError from "../../errors/AppError";
import User from "../../models/User";

export type TicketAssigneeFilter =
  | { mode: "default" }
  | { mode: "all" }
  | { mode: "unassigned" }
  | { mode: "user"; userId: number };

interface Request {
  requesterUserId: string | number;
  requestedAssignee?: string;
  legacyShowAll?: string;
}

const ResolveTicketAssigneeFilterService = async ({
  requesterUserId,
  requestedAssignee,
  legacyShowAll
}: Request): Promise<TicketAssigneeFilter> => {
  const requester = await User.findByPk(requesterUserId, {
    attributes: ["id", "profile", "canViewOtherAgentsTickets"]
  });

  if (!requester) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  const requesterId = Number(requester.id);
  const canViewOthers =
    requester.profile === "admin" || requester.canViewOtherAgentsTickets;

  // Compatibilidade com telas antigas: nunca transforma um showAll legado em
  // acesso indevido, mas também não quebra chamadas já existentes.
  if (!requestedAssignee) {
    if (legacyShowAll === "true" && canViewOthers) {
      return { mode: "all" };
    }

    return { mode: "default" };
  }

  if (requestedAssignee === "me") {
    return { mode: "user", userId: requesterId };
  }

  if (requestedAssignee === "unassigned") {
    return { mode: "unassigned" };
  }

  if (requestedAssignee === "all") {
    if (!canViewOthers) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }

    return { mode: "all" };
  }

  const match = /^user:(\d+)$/.exec(requestedAssignee);
  if (!match) {
    throw new AppError("ERR_INVALID_TICKET_ASSIGNEE_FILTER", 400);
  }

  const selectedUserId = Number(match[1]);
  if (selectedUserId !== requesterId && !canViewOthers) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  return { mode: "user", userId: selectedUserId };
};

export default ResolveTicketAssigneeFilterService;
