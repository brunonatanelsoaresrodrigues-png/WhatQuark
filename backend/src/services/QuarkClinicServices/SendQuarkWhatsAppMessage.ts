import AppError from "../../errors/AppError";
import { SendPolicy, assertExecution } from "../MessagingServices/policy";
import Whatsapp from "../../models/Whatsapp";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindNotificationTicket from "../TicketServices/FindNotificationTicket";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import { whatsappProvider } from "../../providers/WhatsApp";
import { QuarkConfig } from "./config";
import { quarkPhoneVariants } from "./appointmentUtils";

const getWhatsapp = async (config: QuarkConfig): Promise<Whatsapp> => {
  if (!config.whatsappId) throw new AppError("ERR_QUARK_CHANNEL_REQUIRED", 409);

  const whatsapp = await Whatsapp.findByPk(config.whatsappId);
  if (!whatsapp) {
    throw new Error(`Configured WhatsApp #${config.whatsappId} was not found`);
  }
  return whatsapp;
};

const SendQuarkWhatsAppMessage = async (
  config: QuarkConfig,
  phone: string,
  patientName: string,
  body: string,
  policy: SendPolicy
): Promise<{ messageId: string; ticketId: number }> => {
  if (!/^\d{10,15}$/.test(phone)) {
    throw new Error("QUARK_PERMANENT_INVALID_PHONE");
  }

  await assertExecution(phone, true);
  const whatsapp = await getWhatsapp(config);
  if (whatsapp.status !== "CONNECTED") {
    throw new Error("QUARK_TEMPORARY_WHATSAPP_DISCONNECTED");
  }

  let validatedNumber = "";
  let numberError: unknown;
  for (const candidate of quarkPhoneVariants(
    phone,
    config.defaultCountryCode
  )) {
    try {
      validatedNumber = await whatsappProvider.checkNumber(
        whatsapp.id,
        candidate
      );
      break;
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.includes("ERR_NUMBER_NOT_ON_WHATSAPP")
      )
        throw error;
      numberError = error;
    }
  }
  if (!validatedNumber) throw numberError || new Error("ERR_NUMBER_NOT_ON_WHATSAPP");
  const normalizedNumber = validatedNumber.replace(/\D/g, "");
  if (!normalizedNumber) {
    throw new Error("QUARK_PERMANENT_INVALID_PHONE");
  }

  const contact = await CreateOrUpdateContactService({
    name: patientName,
    number: normalizedNumber,
    isGroup: false
  });
  const ticket = await FindNotificationTicket(contact, whatsapp.id);
  const message = await SendWhatsAppMessage({
    body,
    ticket,
    origin: "QUARK",
    policy: { ...policy, proactive: true }
  });
  return { messageId: message.id, ticketId: ticket.id };
};

export default SendQuarkWhatsAppMessage;
