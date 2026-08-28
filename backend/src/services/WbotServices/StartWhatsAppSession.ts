import Whatsapp from "../../models/Whatsapp";
import { whatsappProvider } from "../../providers/WhatsApp";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";

export const StartWhatsAppSession = async (
  whatsapp: Whatsapp
): Promise<void> => {
  await whatsapp.update({ status: "OPENING" });

  const io = getIO();
  io.to("admin").emit("whatsappSession", {
    action: "update",
    session: whatsapp
  });

  try {
    console.log("VAI!");
    await whatsappProvider.init(whatsapp);
  } catch (err) {
    logger.error(err);
  }
};
