import AppError from "../../errors/AppError";
import User from "../../models/User";

interface Request {
  userId: string | number;
  profile: string;
}

const EnsureQuarkAutomationAccessService = async ({
  userId,
  profile
}: Request): Promise<void> => {
  if (profile === "admin") return;

  const user = await User.findByPk(userId, {
    attributes: ["canAccessQuarkAutomation"]
  });

  if (!user?.canAccessQuarkAutomation) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
};

export default EnsureQuarkAutomationAccessService;
