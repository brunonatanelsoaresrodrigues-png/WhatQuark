import { join } from "path";
import { safeMediaFilename } from "../helpers/SafeMediaFilename";
import { promisify } from "util";
import { writeFile } from "fs";
import * as Sentry from "@sentry/node";

import { emitTicketEvent } from "../libs/socket";
import { logger } from "../utils/logger";
import { storedMediaType } from "../helpers/StoredMediaType";
import { HandleInboundAutomation } from "../services/MessagingServices/HandleInboundAutomation";
import { recordInbound } from "../services/MessagingServices/preferences";
import PausePatientIntakeService from "../services/PatientIntakeServices/PausePatientIntakeService";
import formatBody from "../helpers/Mustache";

import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import Message from "../models/Message";

import CreateMessageService from "../services/MessageServices/CreateMessageService";
import QuarkAppointmentNotification from "../models/QuarkAppointmentNotification";
import { emitQuarkDashboardUpdate } from "../services/QuarkClinicServices/dashboardEvents";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import FindNotificationTicket from "../services/TicketServices/FindNotificationTicket";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import CreateContactService from "../services/ContactServices/CreateContactService";
import HandleQuarkConfirmationReply from "../services/QuarkClinicServices/HandleQuarkConfirmationReply";
import HandleTicketMessageForInactivity from "../services/TicketInactivityServices/HandleTicketMessageForInactivity";
import DailyReportDelivery from "../models/DailyReportDelivery";
import { registerMessageAttribution } from "../services/MessageServices/MessageAttributionService";

import { whatsappProvider } from "../providers/WhatsApp/whatsappProvider";
import { MessageType, MessageAck } from "../providers/WhatsApp/types";

const writeFileAsync = promisify(writeFile);

export interface ContactPayload {
  name: string;
  number: string;
  lid?: string;
  profilePicUrl?: string;
  isGroup: boolean;
}

export interface MessagePayload {
  id: string;
  body: string;
  fromMe: boolean;
  hasMedia: boolean;
  type: MessageType;
  timestamp: number;
  from: string;
  to: string;
  hasQuotedMsg?: boolean;
  quotedMsgId?: string;
  mediaUrl?: string;
  mediaType?: string;
  ack?: MessageAck;
}

export interface MediaPayload {
  filename: string;
  mimetype: string;
  data: string;
}

export interface WhatsappContextPayload {
  whatsappId: number;
  unreadMessages: number;
  groupContact?: ContactPayload;
}

export interface HandleMessageOptions {
  historySync?: boolean;
  throwOnFailure?: boolean;
}
export type HandleMessageResult = "created" | "duplicate" | "ignored";

const processLocationMessage = (
  messagePayload: MessagePayload
): MessagePayload => {
  if (messagePayload.type !== "location") return messagePayload;

  return messagePayload;
};

const saveMediaFile = async (mediaPayload: MediaPayload): Promise<string> => {
  const originalName =
    mediaPayload.filename ||
    `media.${mediaPayload.mimetype.split("/")[1]?.split(";")[0] || "bin"}`;
  const filename = safeMediaFilename(originalName);

  try {
    await writeFileAsync(
      join(__dirname, "..", "..", "public", filename),
      mediaPayload.data,
      "base64"
    );
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
    throw new Error("ERR_INCOMING_MEDIA_STORAGE");
  }

  return filename;
};

const processVcardMessage = async (
  messagePayload: MessagePayload
): Promise<void> => {
  if (messagePayload.type !== "vcard") return;

  try {
    const array = messagePayload.body.split("\n");
    const phoneNumbers: Array<{ number: string }> = [];
    let contactName = "";

    array.forEach(line => {
      const values = line.split(":");
      values.forEach((value, index) => {
        if (value.indexOf("+") !== -1) {
          phoneNumbers.push({ number: value });
        }
        if (value.indexOf("FN") !== -1 && values[index + 1]) {
          contactName = values[index + 1];
        }
      });
    });

    await Promise.all(
      phoneNumbers.map(({ number }) =>
        CreateContactService({
          name: contactName,
          number: number.replace(/\D/g, "")
        })
      )
    );
  } catch (error) {
    logger.error("Error processing vcard message:", error);
  }
};

export const handleMessage = async (
  messagePayload: MessagePayload,
  contactPayload: ContactPayload,
  contextPayload: WhatsappContextPayload,
  mediaPayload?: MediaPayload,
  inputOptions: HandleMessageOptions | boolean = {}
): Promise<HandleMessageResult> => {
  const options =
    typeof inputOptions === "boolean"
      ? { throwOnFailure: inputOptions }
      : inputOptions;
  try {
    const timestampMs =
      messagePayload.timestamp > 10_000_000_000
        ? messagePayload.timestamp
        : messagePayload.timestamp * 1000;
    const receivedAt = new Date(timestampMs);
    const eligibleForAutomation =
      !options.historySync &&
      !messagePayload.fromMe &&
      !contextPayload.groupContact &&
      timestampMs <= Date.now() + 60000 &&
      timestampMs >= Date.now() - 5 * 60000;
    const existing = await Message.findByPk(messagePayload.id);
    if (existing) {
      if (eligibleForAutomation) {
        await recordInbound(
          contactPayload.number,
          contextPayload.whatsappId,
          messagePayload.timestamp
        );
        await HandleInboundAutomation({
          ticketId: existing.ticketId,
          whatsappId: contextPayload.whatsappId,
          phone: contactPayload.number,
          body: messagePayload.body,
          messageId: messagePayload.id
        });
      }
      return "duplicate";
    }
    const processedMessage = processLocationMessage(messagePayload);

    const contact = await CreateOrUpdateContactService({
      name: contactPayload.name,
      number: contactPayload.number,
      lid: contactPayload.lid,
      profilePicUrl: contactPayload.profilePicUrl,
      isGroup: contactPayload.isGroup,
      emitEvent: !options.historySync
    });

    let groupContact: Contact | undefined;
    if (contextPayload.groupContact) {
      groupContact = await CreateOrUpdateContactService({
        name: contextPayload.groupContact.name,
        number: contextPayload.groupContact.number,
        lid: contextPayload.groupContact.lid,
        profilePicUrl: contextPayload.groupContact.profilePicUrl,
        isGroup: contextPayload.groupContact.isGroup,
        emitEvent: !options.historySync
      });
    }

    const whatsapp = await ShowWhatsAppService(contextPayload.whatsappId);
    if (
      !options.historySync &&
      processedMessage.fromMe &&
      contextPayload.unreadMessages === 0 &&
      whatsapp.farewellMessage &&
      formatBody(whatsapp.farewellMessage, contact) === processedMessage.body
    ) {
      return "ignored";
    }

    let ticket: Ticket;
    if (options.historySync) {
      ticket = (await Ticket.findOne({
        where: {
          contactId: groupContact ? groupContact.id : contact.id,
          whatsappId: contextPayload.whatsappId,
          ticketType: "PATIENT"
        },
        order: [["updatedAt", "DESC"]]
      })) as Ticket;
      if (!ticket)
        ticket = await Ticket.create({
          contactId: groupContact ? groupContact.id : contact.id,
          whatsappId: contextPayload.whatsappId,
          status: "closed",
          isGroup: Boolean(groupContact),
          unreadMessages: 0,
          ticketType: "PATIENT"
        });
    } else
      ticket =
        processedMessage.fromMe && !groupContact && !contact.isInternal
          ? await FindNotificationTicket(contact, contextPayload.whatsappId)
          : await FindOrCreateTicketService(
              contact,
              contextPayload.whatsappId,
              contextPayload.unreadMessages,
              groupContact,
              undefined,
              !processedMessage.fromMe
            );

    const messageData: any = {
      id: processedMessage.id,
      ticketId: ticket.id,
      contactId: processedMessage.fromMe ? undefined : contact.id,
      body: processedMessage.body,
      fromMe: processedMessage.fromMe,
      read: processedMessage.fromMe,
      mediaType: processedMessage.type,
      quotedMsgId: processedMessage.quotedMsgId,
      ack: processedMessage.ack !== undefined ? processedMessage.ack : 0,
      ...(Number.isFinite(timestampMs) && timestampMs <= Date.now() + 60000
        ? { createdAt: receivedAt }
        : {}),
      ...(options.historySync
        ? {
            sentByUserId: null,
            origin: processedMessage.fromMe ? "UNKNOWN" : "PATIENT"
          }
        : {})
    };

    if (mediaPayload && processedMessage.hasMedia) {
      const filename = await saveMediaFile(mediaPayload);
      messageData.mediaUrl = filename;
      messageData.body =
        processedMessage.body ||
        (processedMessage.type === "sticker" ? "Figurinha" : filename);
      messageData.mediaType = storedMediaType(
        processedMessage.type,
        mediaPayload.mimetype
      );
    }

    if (options.historySync) {
      await CreateMessageService({ messageData, emitEvent: false });
      return "created";
    }

    let lastMessageText = "";
    if (processedMessage.type === "location") {
      lastMessageText = processedMessage.body.includes("Localization")
        ? processedMessage.body
        : "Localization";
    } else {
      lastMessageText = processedMessage.body || mediaPayload?.filename || "";
    }

    await ticket.update({ lastMessage: lastMessageText });

    const createdMessage = await CreateMessageService({ messageData });

    if (!processedMessage.fromMe && !contextPayload.groupContact)
      await recordInbound(
        contact.number,
        contextPayload.whatsappId,
        processedMessage.timestamp
      );

    // Respostas dos gestores aos fechamentos permanecem na conversa interna e
    // não entram no bot, no QuarkClinic nem na automação de inatividade.
    if (ticket.ticketType === "INTERNAL_REPORT") return "created";

    await HandleTicketMessageForInactivity({
      ticket,
      message: createdMessage
    }).catch(error =>
      logger.error({
        info: "Could not update ticket patient-waiting state",
        ticketId: ticket.id,
        err: error
      })
    );

    if (processedMessage.fromMe && createdMessage.origin === "HUMAN") {
      await PausePatientIntakeService(ticket, createdMessage.sentByUserId);
      return "created";
    }
    await processVcardMessage(processedMessage);

    if (eligibleForAutomation) {
      await HandleInboundAutomation({
        ticketId: ticket.id,
        whatsappId: contextPayload.whatsappId,
        phone: contact.number,
        body: processedMessage.body,
        messageId: processedMessage.id
      });
    }
    return "created";
  } catch (err) {
    Sentry.captureException(err);
    logger.error({
      info: "Error handling message",
      err,
      messageId: messagePayload.id,
      whatsappId: contextPayload.whatsappId
    });
    if (options.throwOnFailure || options.historySync)
      throw new Error("ERR_INCOMING_MESSAGE_PROCESSING");
    return "ignored";
  }
};

export const handleMessageAck = async (
  messageId: string,
  ack: MessageAck
): Promise<void> => {
  await new Promise(r => setTimeout(r, 500));

  try {
    const messageToUpdate = await Message.findByPk(messageId, {
      include: [
        "contact",
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"]
        }
      ]
    });

    if (!messageToUpdate) {
      return;
    }

    if (Number(messageToUpdate.ack) > ack) return;
    await messageToUpdate.update({ ack });

    const deliveryUpdate =
      ack >= 3
        ? { deliveredAt: new Date(), readAt: new Date() }
        : ack >= 2
        ? { deliveredAt: new Date() }
        : undefined;
    if (deliveryUpdate) {
      const [updated] = await QuarkAppointmentNotification.update(
        deliveryUpdate,
        { where: { messageId } }
      );
      if (updated > 0) emitQuarkDashboardUpdate("delivery", messageId);
      await DailyReportDelivery.update(deliveryUpdate, {
        where: { messageId }
      });
    }

    const ticket = await ShowTicketService(messageToUpdate.ticketId);
    await emitTicketEvent(ticket, "appMessage", {
      action: "update",
      message: messageToUpdate
    });
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Error handling message ack: ${err}`);
  }
};
