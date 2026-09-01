import AppError from "../../errors/AppError";
import QuickAnswer from "../../models/QuickAnswer";
import { Op } from "sequelize";

interface Request {
  shortcut: string;
  message: string;
  userId: number;
}

const CreateQuickAnswerService = async ({
  shortcut,
  message,
  userId
}: Request): Promise<QuickAnswer> => {
  const nameExists = await QuickAnswer.findOne({
    where: { shortcut, [Op.or]: [{ userId }, { userId: null }] }
  });

  if (nameExists) {
    throw new AppError("ERR__SHORTCUT_DUPLICATED");
  }

  const quickAnswer = await QuickAnswer.create({ shortcut, message, userId });

  return quickAnswer;
};

export default CreateQuickAnswerService;
