import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import Whatsapp from "../../models/Whatsapp";
import { QuarkConfig } from "./config";

export const getQuarkWhatsApp = async (
  config: QuarkConfig
): Promise<Whatsapp> => {
  if (!config.whatsappId) return GetDefaultWhatsApp();

  const whatsapp = await Whatsapp.findByPk(config.whatsappId);
  if (!whatsapp) {
    throw new Error(`Configured WhatsApp #${config.whatsappId} was not found`);
  }
  return whatsapp;
};

export const quarkWhatsAppIsConnected = async (
  config: QuarkConfig
): Promise<boolean> => (await getQuarkWhatsApp(config)).status === "CONNECTED";
