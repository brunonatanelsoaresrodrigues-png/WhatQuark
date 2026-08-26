import { getIO } from "../../libs/socket";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { MessageOrigin } from "../../models/MessageAttribution";
import { resolveMessageAttribution } from "./MessageAttributionService";

interface MessageData {
  id: string;
  ticketId: number;
  body: string;
  contactId?: number;
  fromMe?: boolean;
  read?: boolean;
  mediaType?: string;
  mediaUrl?: string;
  ack?: number;
  quotedMsgId?: string | null;
  sentByUserId?: number | null;
  origin?: MessageOrigin;
}
interface Request {
  messageData: MessageData;
  emitEvent?: boolean;
}

const CreateMessageService = async ({
  messageData,
  emitEvent = true
}: Request): Promise<Message> => {
  if (!messageData.origin) {
    const attribution = await resolveMessageAttribution(
      messageData.id,
      Boolean(messageData.fromMe)
    );
    messageData.sentByUserId = attribution.sentByUserId;
    messageData.origin = attribution.origin;
  }

  // O WhatsApp pode entregar uma resposta cujo item citado não faz parte do
  // histórico local (por exemplo, uma mensagem anterior à conexão atual).
  // A citação é opcional; a mensagem recebida não é. Evite que a FK da
  // quotedMsgId rejeite e descarte a mensagem inteira nesse cenário.
  if (messageData.quotedMsgId) {
    const quotedMessage = await Message.findByPk(messageData.quotedMsgId, {
      attributes: ["id"]
    });
    if (!quotedMessage) {
      messageData.quotedMsgId = null;
    }
  }

  await Message.upsert(messageData);

  const message = await Message.findByPk(messageData.id, {
    include: [
      "contact",
      {
        model: Ticket,
        as: "ticket",
        include: [
          "contact",
          "queue",
          {
            model: Whatsapp,
            as: "whatsapp",
            attributes: ["name"]
          }
        ]
      },
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ]
  });

  if (!message) {
    throw new Error("ERR_CREATING_MESSAGE");
  }

  if (emitEvent) {
    const io = getIO();
    io.to(message.ticketId.toString())
      .to(message.ticket.status)
      .to("notification")
      .emit("appMessage", {
        action: "create",
        message,
        ticket: message.ticket,
        contact: message.ticket.contact
      });
  }

  return message;
};

export default CreateMessageService;
