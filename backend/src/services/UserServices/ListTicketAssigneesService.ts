import User from "../../models/User";
import AppError from "../../errors/AppError";

interface Assignee {
  id: number;
  name: string;
}

const ListTicketAssigneesService = async (
  requesterUserId: string | number
): Promise<Assignee[]> => {
  const requester = await User.findByPk(requesterUserId, {
    attributes: ["id", "profile", "canViewOtherAgentsTickets"]
  });

  if (!requester) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  const canViewOthers =
    requester.profile === "admin" || requester.canViewOtherAgentsTickets;

  const users = await User.findAll({
    where: canViewOthers ? undefined : { id: requester.id },
    attributes: ["id", "name"],
    order: [["name", "ASC"]]
  });

  return users.map(user => ({ id: user.id, name: user.name }));
};

export default ListTicketAssigneesService;
