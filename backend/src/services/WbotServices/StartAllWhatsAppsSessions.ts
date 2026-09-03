import ListWhatsAppsService from "../WhatsappService/ListWhatsAppsService";
import { StartWhatsAppSession } from "./StartWhatsAppSession";

export const StartAllWhatsAppsSessions = async (): Promise<void> => {
  if (process.env.WHATSAPP_CONNECTIONS_ENABLED === "false") return;
  const whatsapps = await ListWhatsAppsService();
  if (whatsapps.length > 0) {
    whatsapps
      .filter(
        whatsapp =>
          process.env.WHATSAPP_PROVIDER !== "cloud" ||
          whatsapp.id === Number(process.env.CLOUD_WHATSAPP_ID)
      )
      .forEach(whatsapp => {
        StartWhatsAppSession(whatsapp);
      });
  }
};
