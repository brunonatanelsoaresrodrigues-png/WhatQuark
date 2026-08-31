import ShowQuickAnswerService from "./ShowQuickAnswerService";

const DeleteQuickAnswerService = async (
  id: string,
  requester: { id: number | string; profile: string }
): Promise<void> => {
  const quickAnswer = await ShowQuickAnswerService(id, requester, true);

  await quickAnswer.destroy();
};

export default DeleteQuickAnswerService;
