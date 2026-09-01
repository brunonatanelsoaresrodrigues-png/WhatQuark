import AppError from "../../errors/AppError";
import User from "../../models/User";

const EnsureTicketDeletionPermissionService = async (
  userId: string | number
): Promise<void> => {
  const user = await User.findByPk(userId, {
    attributes: ["profile"]
  });

  if (!user || user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
};

export default EnsureTicketDeletionPermissionService;
