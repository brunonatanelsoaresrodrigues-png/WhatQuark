import Whatsapp from "../../models/Whatsapp";
import { whatsappProvider } from "../../providers/WhatsApp";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import AppError from "../../errors/AppError";

export const StartWhatsAppSession = async (
  whatsapp: Whatsapp
): Promise<void> => {
  if (process.env.WHATSAPP_CONNECTIONS_ENABLED === "false")
    throw new AppError("ERR_WHATSAPP_CONNECTIONS_PAUSED", 503);
  await whatsapp.update({ status: "OPENING" });

  const io = getIO();
  io.to("admin").emit("whatsappSession", {
    action: "update",
    session: whatsapp
  });

  try {
    await whatsappProvider.init(whatsapp);
  } catch (err) {
    logger.error(err);
  }
};
