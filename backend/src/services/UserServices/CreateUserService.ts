import * as Yup from "yup";

import AppError from "../../errors/AppError";
import { SerializeUser } from "../../helpers/SerializeUser";
import User from "../../models/User";

interface Request {
  email: string;
  password: string;
  name: string;
  queueIds?: number[];
  profile?: string;
  whatsappId?: number;
  canAccessQuarkClinic?: boolean;
  canViewOtherAgentsTickets?: boolean;
}

interface Response {
  email: string;
  name: string;
  id: number;
  profile: string;
  canAccessQuarkClinic: boolean;
  canViewOtherAgentsTickets: boolean;
}

const CreateUserService = async ({
  email,
  password,
  name,
  queueIds = [],
  profile = "admin",
  whatsappId,
  canAccessQuarkClinic = false,
  canViewOtherAgentsTickets = false
}: Request): Promise<Response> => {
  const schema = Yup.object().shape({
    name: Yup.string().required().min(2),
    email: Yup.string()
      .email()
      .required()
      .test(
        "Check-email",
        "An user with this email already exists.",
        async value => {
          if (!value) return false;
          const emailExists = await User.findOne({
            where: { email: value }
          });
          return !emailExists;
        }
      ),
    password: Yup.string().required().min(5),
    canAccessQuarkClinic: Yup.boolean().strict(),
    canViewOtherAgentsTickets: Yup.boolean().strict()
  });

  try {
    await schema.validate({
      email,
      password,
      name,
      canAccessQuarkClinic,
      canViewOtherAgentsTickets
    });
  } catch (err) {
    throw new AppError(err.message);
  }

  const user = await User.create(
    {
      email,
      password,
      name,
      profile,
      canAccessQuarkClinic,
      canViewOtherAgentsTickets,
      whatsappId: whatsappId ? whatsappId : null
    },
    { include: ["queues", "whatsapp"] }
  );

  await user.$set("queues", queueIds);

  await user.reload();

  return SerializeUser(user);
};

export default CreateUserService;
