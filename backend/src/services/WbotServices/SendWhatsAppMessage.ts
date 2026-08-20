import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { whatsappProvider, ProviderMessage } from "../../providers/WhatsApp";

import formatBody from "../../helpers/Mustache";
import { MessageOrigin } from "../../models/MessageAttribution";
import { registerMessageAttribution } from "../MessageServices/MessageAttributionService";
import { logger } from "../../utils/logger";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
  sentByUserId?: number | null;
  origin?: MessageOrigin;
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg,
  sentByUserId = null,
  origin = "SYSTEM"
}: Request): Promise<ProviderMessage> => {
  if (!ticket.whatsappId) {
    throw new AppError("ERR_TICKET_NO_WHATSAPP");
  }

  const chatId = `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`;

  try {
    const sentMessage = await whatsappProvider.sendMessage(
      ticket.whatsappId,
      chatId,
      formatBody(body, ticket.contact),
      {
        quotedMessageId: quotedMsg?.id,
        quotedMessageFromMe: quotedMsg?.fromMe,
        linkPreview: false
      }
    );

    await registerMessageAttribution(sentMessage.id, {
      sentByUserId,
      origin
    }).catch(error =>
      logger.error({
        info: "WhatsApp message sent but attribution could not be persisted",
        messageId: sentMessage.id,
        err: error
      })
    );

    await ticket.update({ lastMessage: body });
    return sentMessage;
  } catch (err) {
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
