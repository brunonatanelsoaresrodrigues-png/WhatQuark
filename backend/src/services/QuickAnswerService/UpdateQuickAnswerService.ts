import QuickAnswer from "../../models/QuickAnswer";
import ShowQuickAnswerService from "./ShowQuickAnswerService";

interface QuickAnswerData {
  shortcut?: string;
  message?: string;
}

interface Request {
  quickAnswerData: QuickAnswerData;
  quickAnswerId: string;
  requester: { id: number | string; profile: string };
}

const UpdateQuickAnswerService = async ({
  quickAnswerData,
  quickAnswerId,
  requester
}: Request): Promise<QuickAnswer> => {
  const { shortcut, message } = quickAnswerData;

  const quickAnswer = await ShowQuickAnswerService(
    quickAnswerId,
    requester,
    true
  );
  await quickAnswer.update({
    shortcut,
    message
  });

  await quickAnswer.reload({
    attributes: ["id", "shortcut", "message", "userId"]
  });

  return quickAnswer;
};

export default UpdateQuickAnswerService;
