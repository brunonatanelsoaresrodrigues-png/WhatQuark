import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { whatsappProvider, ProviderMessage } from "../../providers/WhatsApp";

import formatBody from "../../helpers/Mustache";
import { MessageOrigin } from "../../models/MessageAttribution";
import { registerMessageAttribution } from "../MessageServices/MessageAttributionService";
import { logger } from "../../utils/logger";
import { SendPolicy } from "../MessagingServices/policy";
import contactJid from "../../helpers/ContactJid";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
  sentByUserId?: number | null;
  origin?: MessageOrigin;
  policy?: SendPolicy;
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg,
  sentByUserId = null,
  origin = "SYSTEM",
  policy = {}
}: Request): Promise<ProviderMessage> => {
  if (!ticket.whatsappId) {
    throw new AppError("ERR_TICKET_NO_WHATSAPP");
  }

  const chatId = contactJid(ticket.contact, ticket.isGroup);

  try {
    const sentMessage = await whatsappProvider.sendMessage(
      ticket.whatsappId,
      chatId,
      formatBody(body, ticket.contact),
      {
        quotedMessageId: quotedMsg?.id,
        quotedMessageFromMe: quotedMsg?.fromMe,
        linkPreview: false,
        policy: {
          origin,
          sentByUserId,
          ticketId: ticket.id,
          bot: origin === "BOT",
          proactive: origin === "DAILY_REPORT",
          ...policy
        }
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

    await ticket.update({ lastMessage: body }).catch(() =>
      logger.error({
        info: "Sent message could not update ticket",
        ticketId: ticket.id,
        messageId: sentMessage.id
      })
    );
    return sentMessage;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
