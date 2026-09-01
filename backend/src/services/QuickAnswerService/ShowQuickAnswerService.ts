import QuickAnswer from "../../models/QuickAnswer";
import AppError from "../../errors/AppError";

interface Requester {
  id: number | string;
  profile: string;
}

const ShowQuickAnswerService = async (
  id: string,
  requester?: Requester,
  requireWrite = false
): Promise<QuickAnswer> => {
  const quickAnswer = await QuickAnswer.findByPk(id);

  if (!quickAnswer) {
    throw new AppError("ERR_NO_QUICK_ANSWERS_FOUND", 404);
  }

  if (
    requester &&
    requester.profile !== "admin" &&
    (requireWrite
      ? Number(quickAnswer.userId) !== Number(requester.id)
      : quickAnswer.userId !== null &&
        Number(quickAnswer.userId) !== Number(requester.id))
  ) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  return quickAnswer;
};

export default ShowQuickAnswerService;
