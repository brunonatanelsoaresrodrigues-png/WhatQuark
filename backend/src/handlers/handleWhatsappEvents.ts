import { join } from "path";
import { promisify } from "util";
import { writeFile } from "fs";
import * as Sentry from "@sentry/node";

import { getIO } from "../libs/socket";
import { logger } from "../utils/logger";
import { debounce } from "../helpers/Debounce";
import formatBody from "../helpers/Mustache";

import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Message from "../models/Message";

import CreateMessageService from "../services/MessageServices/CreateMessageService";
import QuarkAppointmentNotification from "../models/QuarkAppointmentNotification";
import { emitQuarkDashboardUpdate } from "../services/QuarkClinicServices/dashboardEvents";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import CreateContactService from "../services/ContactServices/CreateContactService";
import HandleQuarkConfirmationReply from "../services/QuarkClinicServices/HandleQuarkConfirmationReply";
import HandleTicketMessageForInactivity from "../services/TicketInactivityServices/HandleTicketMessageForInactivity";
import DailyReportDelivery from "../models/DailyReportDelivery";
import { registerMessageAttribution } from "../services/MessageServices/MessageAttributionService";
import PatientIntakeService, {
  patientIntakeOwnsNumericInput
} from "../services/PatientIntakeServices/PatientIntakeService";
import PausePatientIntakeService from "../services/PatientIntakeServices/PausePatientIntakeService";

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

const makeRandomId = (length: number): string => {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
};

const processLocationMessage = (
  messagePayload: MessagePayload
): MessagePayload => {
  if (messagePayload.type !== "location") return messagePayload;

  return messagePayload;
};

const saveMediaFile = async (mediaPayload: MediaPayload): Promise<string> => {
  const randomId = makeRandomId(5);
  const { filename: originalFilename } = mediaPayload;

  let filename: string;
  if (!originalFilename) {
    const [extension] = mediaPayload.mimetype.split("/")[1].split(";");
    filename = `${randomId}-${new Date().getTime()}.${extension}`;
  } else {
    const baseName = originalFilename.split(".").slice(0, -1).join(".");
    const extension = originalFilename.split(".").slice(-1)[0];
    filename = `${baseName}.${randomId}.${extension}`;
  }

  try {
    await writeFileAsync(
      join(__dirname, "..", "..", "public", filename),
      mediaPayload.data,
      "base64"
    );
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
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

const handleQueueLogic = async (
  whatsappId: number,
  messageBody: string,
  ticket: Ticket,
  contactPayload: ContactPayload
): Promise<void> => {
  const { queues, greetingMessage } = await ShowWhatsAppService(whatsappId);

  if (queues.length === 1) {
    await UpdateTicketService({
      ticketData: { queueId: queues[0].id },
      ticketId: ticket.id
    });
    return;
  }

  const selectedOption = messageBody;
  const choosenQueue = queues[+selectedOption - 1];

  if (choosenQueue) {
    await UpdateTicketService({
      ticketData: { queueId: choosenQueue.id },
      ticketId: ticket.id
    });

    const body = formatBody(
      `\u200e${choosenQueue.greetingMessage}`,
      contactPayload as any
    );

    try {
      const sentMessage = await whatsappProvider.sendMessage(
        whatsappId,
        `${contactPayload.number}@c.us`,
        body
      );
      await registerMessageAttribution(sentMessage.id, {
        sentByUserId: null,
        origin: "BOT"
      });
    } catch (error) {
      logger.error("Error sending queue greeting message:", error);
    }
  } else {
    let options = "";
    queues.forEach((queue, index) => {
      options += `*${index + 1}* - ${queue.name}\n`;
    });

    const body = formatBody(
      `\u200e${greetingMessage}\n${options}`,
      contactPayload as any
    );

    const debouncedSentMessage = debounce(
      async () => {
        try {
          const sentMessage = await whatsappProvider.sendMessage(
            whatsappId,
            `${contactPayload.number}@c.us`,
            body
          );
          await registerMessageAttribution(sentMessage.id, {
            sentByUserId: null,
            origin: "BOT"
          });
        } catch (error) {
          logger.error("Error sending queue options message:", error);
        }
      },
      3000,
      ticket.id
    );

    debouncedSentMessage();
  }
};

export const handleMessage = async (
  messagePayload: MessagePayload,
  contactPayload: ContactPayload,
  contextPayload: WhatsappContextPayload,
  mediaPayload?: MediaPayload
): Promise<void> => {
  try {
    const processedMessage = processLocationMessage(messagePayload);

    const contact = await CreateOrUpdateContactService({
      name: contactPayload.name,
      number: contactPayload.number,
      lid: contactPayload.lid,
      profilePicUrl: contactPayload.profilePicUrl,
      isGroup: contactPayload.isGroup
    });

    let groupContact: Contact | undefined;
    if (contextPayload.groupContact) {
      groupContact = await CreateOrUpdateContactService({
        name: contextPayload.groupContact.name,
        number: contextPayload.groupContact.number,
        lid: contextPayload.groupContact.lid,
        profilePicUrl: contextPayload.groupContact.profilePicUrl,
        isGroup: contextPayload.groupContact.isGroup
      });
    }

    const whatsapp = await ShowWhatsAppService(contextPayload.whatsappId);
    if (
      contextPayload.unreadMessages === 0 &&
      whatsapp.farewellMessage &&
      formatBody(whatsapp.farewellMessage, contact) === processedMessage.body
    ) {
      return;
    }

    const ticket = await FindOrCreateTicketService(
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
      ack: processedMessage.ack !== undefined ? processedMessage.ack : 0
    };

    if (mediaPayload && processedMessage.hasMedia) {
      const filename = await saveMediaFile(mediaPayload);
      messageData.mediaUrl = filename;
      messageData.body = processedMessage.body || filename;
      const [mediaType] = mediaPayload.mimetype.split("/");
      messageData.mediaType = mediaType;
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

    // Respostas dos gestores aos fechamentos permanecem na conversa interna e
    // não entram no bot, no QuarkClinic nem na automação de inatividade.
    if (ticket.ticketType === "INTERNAL_REPORT") return;

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
      await PausePatientIntakeService(
        ticket,
        createdMessage.sentByUserId
      ).catch(error =>
        logger.error({
          info: "Could not pause patient intake after a human message",
          ticketId: ticket.id,
          err: error
        })
      );
      return;
    }

    await processVcardMessage(processedMessage);

    let handledByIntake = false;
    let showQueueMenu = false;
    const patientAutomationEligible =
      !contextPayload.groupContact && !processedMessage.fromMe;
    const textualConfirmationReply = /^(sim|n[aã]o)\b/i.test(
      processedMessage.body.trim()
    );
    const intakeOwnsInput = patientIntakeOwnsNumericInput(ticket.intakeStatus);

    if (
      patientAutomationEligible &&
      intakeOwnsInput &&
      !textualConfirmationReply &&
      !ticket.queue &&
      !ticket.userId &&
      whatsapp.queues.length >= 1
    ) {
      const intakeResult = await PatientIntakeService(
        ticket,
        processedMessage.body
      );
      handledByIntake = intakeResult.handled;
      showQueueMenu = intakeResult.showQueueMenu;
    }

    const handledByQuark =
      patientAutomationEligible &&
      !handledByIntake &&
      (!intakeOwnsInput || textualConfirmationReply)
        ? await HandleQuarkConfirmationReply({
            body: processedMessage.body,
            phone: contact.number,
            ticket,
            whatsappId: contextPayload.whatsappId
          })
        : false;

    if (
      !handledByQuark &&
      !handledByIntake &&
      !ticket.queue &&
      !contextPayload.groupContact &&
      !processedMessage.fromMe &&
      !ticket.userId &&
      whatsapp.queues.length >= 1
    ) {
      const intakeResult = await PatientIntakeService(
        ticket,
        processedMessage.body
      );
      handledByIntake = intakeResult.handled;
      showQueueMenu = intakeResult.showQueueMenu;
    }

    if (showQueueMenu) {
      await handleQueueLogic(
        contextPayload.whatsappId,
        "",
        ticket,
        contactPayload
      );
    } else if (
      !handledByQuark &&
      !handledByIntake &&
      !ticket.queue &&
      patientAutomationEligible &&
      !ticket.userId &&
      whatsapp.queues.length >= 1
    ) {
      await handleQueueLogic(
        contextPayload.whatsappId,
        processedMessage.body,
        ticket,
        contactPayload
      );
    }
  } catch (err) {
    Sentry.captureException(err);
    logger.error({
      info: "Error handling message",
      err,
      messagePayload,
      contactPayload,
      contextPayload,
      mediaPayload
    });
  }
};

export const handleMessageAck = async (
  messageId: string,
  ack: MessageAck
): Promise<void> => {
  await new Promise(r => setTimeout(r, 500));

  const io = getIO();

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

    io.to(messageToUpdate.ticketId.toString()).emit("appMessage", {
      action: "update",
      message: messageToUpdate
    });
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Error handling message ack: ${err}`);
  }
};
