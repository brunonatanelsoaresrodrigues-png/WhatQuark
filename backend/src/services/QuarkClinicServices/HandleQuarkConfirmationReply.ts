import { Op } from "sequelize";
import QuarkAppointment from "../../models/QuarkAppointment";
import QuarkAppointmentNotification from "../../models/QuarkAppointmentNotification";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import {
  formatAppointmentDateTime,
  normalizeQuarkPhone,
  parseConfirmationReply
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

interface StoredSnapshot {
  profissionalNome?: string | null;
}

const appointmentDescription = (appointment: QuarkAppointment): string => {
  const { date, time } = formatAppointmentDateTime(appointment.scheduledAt);
  let professional = "profissional a confirmar";
  try {
    const snapshot = JSON.parse(appointment.snapshot) as StoredSnapshot;
    if (snapshot.profissionalNome) professional = snapshot.profissionalNome;
  } catch {
    // The minimal date/time description remains safe for legacy rows.
  }
  return `${date}${time ? ` às ${time}` : ""} com ${professional}`;
};

const sendAppointmentOptions = async (
  ticket: Ticket,
  appointments: QuarkAppointment[]
): Promise<void> => {
  const options = appointments
    .slice(0, 9)
    .map(
      (appointment, index) =>
        `${index + 1} — ${appointmentDescription(appointment)}`
    )
    .join("\n");

  await SendWhatsAppMessage({
    body: `Encontramos mais de uma consulta aguardando confirmação:\n\n${options}\n\nResponda *SIM 1* ou *NÃO 1*, trocando o número pela consulta desejada.`,
    ticket
  });
};

const sendAlreadyApplied = async (
  ticket: Ticket,
  choice: 1 | 2,
  appointment: QuarkAppointment
): Promise<void> => {
  await SendWhatsAppMessage({
    body:
      choice === 1
        ? `Esta consulta já está confirmada no QuarkClinic: ${appointmentDescription(
            appointment
          )}.`
        : `Esta consulta já está cancelada no QuarkClinic: ${appointmentDescription(
            appointment
          )}.`,
    ticket
  });
};

const HandleQuarkConfirmationReply = async ({
  body,
  phone,
  ticket,
  whatsappId
}: Request): Promise<boolean> => {
  if (!isQuarkIntegrationEnabled()) return false;

  const reply = parseConfirmationReply(body);
  if (!reply) return false;

  const config = getQuarkConfig();
  if (config.whatsappId && config.whatsappId !== whatsappId) return false;

  const normalizedPhone = normalizeQuarkPhone(phone, "", true);
  if (!normalizedPhone) return false;

  const appointments = await QuarkAppointment.findAll({
    where: {
      phone: normalizedPhone,
      awaitingConfirmation: true,
      status: "AGENDADO",
      scheduledAt: { [Op.gte]: new Date() }
    },
    order: [["scheduledAt", "ASC"]]
  });
  if (appointments.length === 0) {
    const alreadyApplied = await QuarkAppointment.findOne({
      where: {
        phone: normalizedPhone,
        status: reply.choice === 1 ? "CONFIRMADO" : "CANCELADO",
        confirmationRequestedAt: { [Op.ne]: null } as any,
        scheduledAt: { [Op.gte]: new Date() }
      },
      order: [["scheduledAt", "ASC"]]
    });
    if (!alreadyApplied) return false;
    await sendAlreadyApplied(ticket, reply.choice, alreadyApplied);
    return true;
  }

  if (appointments.length > 1 && !reply.appointmentOption) {
    await sendAppointmentOptions(ticket, appointments);
    return true;
  }

  const optionIndex = (reply.appointmentOption || 1) - 1;
  const appointment = appointments[optionIndex];
  if (!appointment) {
    await sendAppointmentOptions(ticket, appointments);
    return true;
  }

  const [claimed] = await QuarkAppointment.update(
    { awaitingConfirmation: false },
    { where: { id: appointment.id, awaitingConfirmation: true } }
  );
  if (claimed === 0) {
    await SendWhatsAppMessage({
      body: "Esta resposta já está sendo processada. Aguarde a confirmação por alguns instantes.",
      ticket
    });
    return true;
  }

  let successBody: string;
  try {
    if (reply.choice === 1) {
      await confirmQuarkAppointment(config, appointment.appointmentId);
      await appointment.update({ status: "CONFIRMADO" });
      successBody = `✅ Consulta confirmada com sucesso no QuarkClinic!\n\n${appointmentDescription(
        appointment
      )}.`;
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
      successBody = `Consulta cancelada no QuarkClinic conforme solicitado.\n\n${appointmentDescription(
        appointment
      )}.\n\nCaso queira realizar um novo agendamento, fale com nossa equipe.`;
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
    }).catch(sendError =>
      logger.error({
        info: "Could not send QuarkClinic reply failure notice",
        appointmentId: appointment.appointmentId,
        err: sendError
      })
    );
    return true;
  }

  await SendWhatsAppMessage({ body: successBody, ticket }).catch(error =>
    logger.error({
      info: "QuarkClinic decision was applied but acknowledgement failed",
      appointmentId: appointment.appointmentId,
      err: error
    })
  );

  return true;
};

export default HandleQuarkConfirmationReply;
