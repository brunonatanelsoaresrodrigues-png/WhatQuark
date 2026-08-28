import fs from "fs";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import { whatsappProvider, ProviderMessage } from "../../providers/WhatsApp";

import formatBody from "../../helpers/Mustache";
import { MessageOrigin } from "../../models/MessageAttribution";
import { registerMessageAttribution } from "../MessageServices/MessageAttributionService";
import { logger } from "../../utils/logger";
import { SendPolicy } from "../MessagingServices/policy";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  body?: string;
  sentByUserId?: number | null;
  origin?: MessageOrigin;
  policy?: SendPolicy;
  sendAsSticker?: boolean;
  removeFileAfterSend?: boolean;
}

const SendWhatsAppMedia = async ({
  media,
  ticket,
  body,
  sentByUserId = null,
  origin = "SYSTEM",
  policy = {},
  sendAsSticker = false,
  removeFileAfterSend = true
}: Request): Promise<ProviderMessage> => {
  try {
    if (!ticket.whatsappId) {
      throw new AppError("ERR_TICKET_NO_WHATSAPP");
    }

    const chatId = `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`;

    const hasBody = body
      ? formatBody(body as string, ticket.contact)
      : undefined;

    const mediaInput = {
      filename: media.filename,
      mimetype: media.mimetype,
      path: media.path
    };

    const mediaOptions = {
      policy: {
        origin,
        sentByUserId,
        ticketId: ticket.id,
        cleanupMediaPath:
          removeFileAfterSend && process.env.WHATSAPP_PROVIDER !== "cloud",
        ...policy
      },
      caption: hasBody,
      sendAudioAsVoice: true,
      sendAsSticker,
      sendMediaAsDocument:
        !sendAsSticker &&
        media.mimetype.startsWith("image/") &&
        !/^.*\.(jpe?g|png|gif)?$/i.exec(media.filename)
    };

    const sentMessage = await whatsappProvider.sendMedia(
      ticket.whatsappId,
      chatId,
      mediaInput,
      mediaOptions
    );

    await registerMessageAttribution(sentMessage.id, {
      sentByUserId,
      origin
    }).catch(error =>
      logger.error({
        info: "WhatsApp media sent but attribution could not be persisted",
        messageId: sentMessage.id,
        err: error
      })
    );

    await ticket.update({ lastMessage: body || media.filename }).catch(() =>
      logger.error({
        info: "Sent media could not update ticket",
        ticketId: ticket.id,
        messageId: sentMessage.id
      })
    );

    if (removeFileAfterSend && process.env.WHATSAPP_PROVIDER !== "cloud")
      await fs.promises.unlink(media.path).catch(() => undefined);

    return sentMessage;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMedia;
