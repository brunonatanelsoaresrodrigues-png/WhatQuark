import path from "path";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { ProviderMessage } from "../../providers/WhatsApp/types";
import { SendPolicy } from "./policy";
import Ticket from "../../models/Ticket";
import HandleTicketMessageForInactivity from "../TicketInactivityServices/HandleTicketMessageForInactivity";

export default async function persistCloudOutbound(
  message: ProviderMessage,
  payload: {
    body?: string;
    media?: { path?: string; filename: string };
    options: { policy?: SendPolicy; quotedMessageId?: string };
  }
) {
  const policy = payload.options.policy;
  if (!policy?.ticketId) throw new Error("ERR_CLOUD_TICKET_REQUIRED");
  const stored = await CreateMessageService({
    messageData: {
      id: message.id,
      ticketId: policy.ticketId,
      body: message.body,
      fromMe: true,
      read: true,
      mediaType: message.type,
      mediaUrl: payload.media?.path
        ? path.basename(payload.media.path)
        : undefined,
      ack: 1,
      quotedMsgId: payload.options.quotedMessageId,
      sentByUserId: policy.sentByUserId,
      origin: (policy.origin || "SYSTEM") as any
    }
  });
  const ticket = await Ticket.findByPk(policy.ticketId);
  if (ticket) {
    await ticket.update({ lastMessage: message.body });
    await HandleTicketMessageForInactivity({ ticket, message: stored });
  }
}
