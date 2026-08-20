import { Op } from "sequelize";
import QuarkAppointment from "../../models/QuarkAppointment";
import QuarkAppointmentNotification from "../../models/QuarkAppointmentNotification";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import {
  normalizeQuarkPhone,
  parseConfirmationChoice
} from "./appointmentUtils";
import { getQuarkConfig, isQuarkIntegrationEnabled } from "./config";
import {
  cancelQuarkAppointment,
  confirmQuarkAppointment
} from "./QuarkClinicClient";

interface Request {
  body: string;
  phone: string;
  ticket: Ticket;
  whatsappId: number;
}

const HandleQuarkConfirmationReply = async ({
  body,
  phone,
  ticket,
  whatsappId
}: Request): Promise<boolean> => {
  if (!isQuarkIntegrationEnabled()) return false;

  const choice = parseConfirmationChoice(body);
  if (!choice) return false;

  const config = getQuarkConfig();
  if (config.whatsappId && config.whatsappId !== whatsappId) return false;

  const normalizedPhone = normalizeQuarkPhone(phone, "", true);
  if (!normalizedPhone) return false;

  const appointment = await QuarkAppointment.findOne({
    where: {
      phone: normalizedPhone,
      awaitingConfirmation: true,
      status: "AGENDADO",
      scheduledAt: { [Op.gte]: new Date() }
    },
    order: [["scheduledAt", "ASC"]]
  });
  if (!appointment) return false;

  await appointment.update({ awaitingConfirmation: false });

  try {
    if (choice === 1) {
      await confirmQuarkAppointment(config, appointment.appointmentId);
      await appointment.update({ status: "CONFIRMADO" });
      await SendWhatsAppMessage({
        body: "Agendamento confirmado com sucesso. Obrigado!",
        ticket
      });
    } else {
      await cancelQuarkAppointment(config, appointment.appointmentId);
      await appointment.update({ status: "CANCELADO" });
      await QuarkAppointmentNotification.update(
        {
          status: "SUPPRESSED",
          lastError: "Appointment cancelled by the patient"
        },
        {
          where: {
            appointmentId: appointment.appointmentId,
            status: { [Op.in]: ["PENDING", "FAILED_RETRY"] }
          }
        }
      );
      await SendWhatsAppMessage({
        body: "Agendamento cancelado conforme solicitado. Se precisar, fale com a nossa equipe.",
        ticket
      });
    }
  } catch (error) {
    await appointment.update({ awaitingConfirmation: true });
    logger.error({
      info: "Could not apply patient reply in QuarkClinic",
      appointmentId: appointment.appointmentId,
      err: error
    });
    await SendWhatsAppMessage({
      body: "Não foi possível processar sua resposta agora. Nossa equipe foi avisada; tente novamente em alguns minutos.",
      ticket
    });
  }

  return true;
};

export default HandleQuarkConfirmationReply;
