import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import Whatsapp from "../../models/Whatsapp";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import { whatsappProvider } from "../../providers/WhatsApp";
import { QuarkConfig } from "./config";

const getWhatsapp = async (config: QuarkConfig): Promise<Whatsapp> => {
  if (!config.whatsappId) return GetDefaultWhatsApp();

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
  body: string
): Promise<{ messageId: string; ticketId: number }> => {
  if (!/^\d{10,15}$/.test(phone)) {
    throw new Error("QUARK_PERMANENT_INVALID_PHONE");
  }

  const whatsapp = await getWhatsapp(config);
  if (whatsapp.status !== "CONNECTED") {
    throw new Error("QUARK_TEMPORARY_WHATSAPP_DISCONNECTED");
  }

  const validatedNumber = await whatsappProvider.checkNumber(
    whatsapp.id,
    phone
  );
  const normalizedNumber = validatedNumber.replace(/\D/g, "");
  if (!normalizedNumber) {
    throw new Error("QUARK_PERMANENT_INVALID_PHONE");
  }

  const contact = await CreateOrUpdateContactService({
    name: patientName,
    number: normalizedNumber,
    isGroup: false
  });
  const ticket = await FindOrCreateTicketService(contact, whatsapp.id, 0);
  const message = await SendWhatsAppMessage({ body, ticket });
  return { messageId: message.id, ticketId: ticket.id };
};

export default SendQuarkWhatsAppMessage;
