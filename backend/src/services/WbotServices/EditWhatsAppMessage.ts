import AppError from "../../errors/AppError";
import contactJid from "../../helpers/ContactJid";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { whatsappProvider } from "../../providers/WhatsApp";

export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;
export const MESSAGE_EDIT_MAX_LENGTH = 4096;

const isHumanMessage = (message: Message): boolean =>
  message.origin === "HUMAN" ||
  (message.origin === "UNKNOWN" && Boolean(message.sentByUserId));

const EditWhatsAppMessage = async (
  messageId: string,
  rawBody: unknown,
  userId: number
): Promise<Message> => {
  const body = typeof rawBody === "string" ? rawBody.trim() : "";
  if (!body || body.length > MESSAGE_EDIT_MAX_LENGTH)
    throw new AppError("ERR_INVALID_MESSAGE_BODY", 400);

  const message = await Message.findByPk(messageId, {
    include: [
      {
        model: Ticket,
        as: "ticket",
        include: ["contact"]
      }
    ]
  });

  if (!message) throw new AppError("ERR_NO_MESSAGE_FOUND", 404);

  const createdAt = new Date(message.createdAt).getTime();
  const editAge = Date.now() - createdAt;
  const isText = !message.mediaType || message.mediaType === "chat";

  if (
    !message.fromMe ||
    message.isDeleted ||
    !isText ||
    !isHumanMessage(message)
  )
    throw new AppError("ERR_MESSAGE_EDIT_NOT_ALLOWED", 409);

  if (
    !Number.isFinite(createdAt) ||
    editAge < 0 ||
    editAge > MESSAGE_EDIT_WINDOW_MS
  )
    throw new AppError("ERR_MESSAGE_EDIT_WINDOW_EXPIRED", 409);

  if (message.body === body) return message;

  const { ticket } = message;
  const chatId = contactJid(ticket.contact, ticket.isGroup);

  try {
    await whatsappProvider.editMessage(
      ticket.whatsappId,
      chatId,
      message.id,
      body
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("ERR_EDITING_WAPP_MSG", 502);
  }

  await message.update({
    body,
    editedAt: new Date(),
    editedByUserId: userId
  });

  const latestMessage = await Message.findOne({
    where: { ticketId: message.ticketId },
    attributes: ["id"],
    order: [["createdAt", "DESC"]]
  });
  if (latestMessage?.id === message.id)
    await ticket.update({ lastMessage: body });

  return message;
};

export default EditWhatsAppMessage;
