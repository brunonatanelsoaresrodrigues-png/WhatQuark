import * as Yup from "yup";
import { literal } from "sequelize";

import AppError from "../../errors/AppError";
import { SerializeUser } from "../../helpers/SerializeUser";
import ShowUserService from "./ShowUserService";

interface UserData {
  email?: string;
  password?: string;
  name?: string;
  profile?: string;
  queueIds?: number[];
  whatsappId?: number;
  canAccessQuarkClinic?: boolean;
  canViewOtherAgentsTickets?: boolean;
}

interface Request {
  userData: UserData;
  userId: string | number;
}

interface Response {
  id: number;
  name: string;
  email: string;
  profile: string;
  canAccessQuarkClinic: boolean;
  canViewOtherAgentsTickets: boolean;
}

const UpdateUserService = async ({
  userData,
  userId
}: Request): Promise<Response | undefined> => {
  const user = await ShowUserService(userId);

  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    email: Yup.string().email(),
    profile: Yup.string().oneOf(["admin", "user"]),
    password: Yup.string(),
    canAccessQuarkClinic: Yup.boolean().strict(),
    canViewOtherAgentsTickets: Yup.boolean().strict()
  });

  const {
    email,
    password,
    profile,
    name,
    queueIds,
    whatsappId,
    canAccessQuarkClinic,
    canViewOtherAgentsTickets
  } = userData;

  try {
    await schema.validate({
      email,
      password,
      profile,
      name,
      canAccessQuarkClinic,
      canViewOtherAgentsTickets
    });
  } catch (err) {
    throw new AppError(err.message);
  }

  await user.update({
    email,
    password,
    profile,
    name,
    canAccessQuarkClinic,
    canViewOtherAgentsTickets,
    ...(whatsappId !== undefined ? { whatsappId: whatsappId || null } : {}),
    tokenVersion: literal("tokenVersion + 1")
  });

  if (queueIds !== undefined) await user.$set("queues", queueIds);

  await user.reload();

  return SerializeUser(user);
};

export default UpdateUserService;
