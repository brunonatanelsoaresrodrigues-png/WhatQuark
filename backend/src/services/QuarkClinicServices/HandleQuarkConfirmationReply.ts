import { Op } from "sequelize";
import QuarkAppointment from "../../models/QuarkAppointment";
import QuarkAppointmentRecipient from "../../models/QuarkAppointmentRecipient";
import Ticket from "../../models/Ticket";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import {
  appointmentReference,
  formatAppointmentDateTime,
  parseConfirmationReply,
  quarkPhoneVariants
} from "./appointmentUtils";
import { getQuarkConfig, isQuarkIntegrationEnabled } from "./config";
import { assertExecution } from "../MessagingServices/policy";
import { readState, writeState } from "../MessagingServices/state";
import { ApplyQuarkDecision } from "./ApplyQuarkDecision";

interface Request {
  body: string;
  phone: string;
  ticket: Ticket;
  whatsappId: number;
  messageId?: string;
}
interface PendingOptions {
  items: Array<{ appointmentId: string; fingerprint: string }>;
  expiresAt: number;
}
const description = (appointment: QuarkAppointment) => {
  const p = formatAppointmentDateTime(appointment.scheduledAt);
  const patient = String(appointment.patientName || "Paciente")
    .replace(/[\r\n*_~`]+/g, " ")
    .trim();
  return `${patient} — ${p.date} às ${p.time}`;
};

const HandleQuarkConfirmationReply = async ({
  body,
  phone,
  ticket,
  whatsappId,
  messageId
}: Request): Promise<boolean> => {
  if (
    !isQuarkIntegrationEnabled() ||
    ticket.userId ||
    ticket.status === "closed"
  )
    return false;
  const reply = parseConfirmationReply(body);
  if (!reply) return false;
  const config = getQuarkConfig();
  if (!config.whatsappId || config.whatsappId !== whatsappId) return false;
  await assertExecution(phone, true);
  const phoneVariants = quarkPhoneVariants(phone);
  const recipients = await QuarkAppointmentRecipient.findAll({
    where: {
      phone: { [Op.in]: phoneVariants },
      active: true,
      isPrimary: true
    }
  });
  const ids = recipients.map(item => item.appointmentId);
  const appointments = await QuarkAppointment.findAll({
    where: {
      [Op.or]: [
        { phone: { [Op.in]: phoneVariants } },
        ...phoneVariants.map(value => ({
          phones: { [Op.like]: `%${value}%` }
        })),
        ...(ids.length ? [{ appointmentId: { [Op.in]: ids } }] : [])
      ],
      awaitingConfirmation: true,
      status: "AGENDADO",
      scheduledAt: { [Op.gte]: new Date() }
    },
    order: [["scheduledAt", "ASC"]],
    limit: 20
  });
  if (!appointments.length) return false;
  const send = (text: string, suffix: string) =>
    SendWhatsAppMessage({
      body: text,
      ticket,
      origin: "QUARK",
      policy: {
        bot: true,
        allowPausedBot: true,
        idempotencyKey: `quark-reply:${ticket.id}:${
          messageId || body
        }:${suffix}`,
        expiresAt: new Date(Date.now() + 5 * 60000).toISOString()
      }
    });
  const referencesOf = (item: QuarkAppointment) =>
    phoneVariants.map(value =>
      appointmentReference(item.appointmentId, item.scheduleFingerprint, value)
    );
  const optionsKey = `quark-options:${whatsappId}:${phone}`;
  const pendingOptions = reply.appointmentOption
    ? await readState<PendingOptions | null>(optionsKey, null)
    : null;
  const selectedOption =
    pendingOptions && pendingOptions.expiresAt > Date.now()
      ? pendingOptions.items[reply.appointmentOption! - 1]
      : undefined;
  const appointment = reply.appointmentReference
    ? appointments.find(item =>
        referencesOf(item).includes(reply.appointmentReference as string)
      )
    : selectedOption
    ? appointments.find(
        item =>
          item.appointmentId === selectedOption.appointmentId &&
          item.scheduleFingerprint === selectedOption.fingerprint
      )
    : !reply.appointmentOption && appointments.length === 1
    ? appointments[0]
    : undefined;
  if (!appointment) {
    const offered = appointments.slice(0, 9);
    const options = offered
      .map((item, index) => `${index + 1} — ${description(item)}`)
      .join("\n");
    await writeState(optionsKey, {
      items: offered.map(item => ({
        appointmentId: item.appointmentId,
        fingerprint: item.scheduleFingerprint
      })),
      expiresAt: Date.now() + 30 * 60 * 1000
    });
    await send(
      `Há mais de uma consulta pendente. Escolha pelo número da lista:\n\n${options}\n\nResponda, por exemplo, CONFIRMAR 1 ou CANCELAR 1. Se não encontrar sua consulta, escreva ATENDENTE.`,
      "options"
    );
    return true;
  }
  const pendingKey = `quark-cancel:${whatsappId}:${phone}`;
  try {
    await ApplyQuarkDecision({
      appointmentId: appointment.appointmentId,
      phone,
      choice: reply.choice,
      fingerprint: appointment.scheduleFingerprint
    });
    await writeState(pendingKey, null);
    await writeState(optionsKey, null);
  } catch (error) {
    await writeState(`bot-pause:${ticket.id}`, true);
    await send(
      "Não consegui concluir esta alteração com segurança. O bot foi pausado nesta conversa. Nossa equipe poderá verificar o agendamento; evite repetir a solicitação agora.",
      "review"
    ).catch(() => undefined);
    throw error;
  }
  await send(
    reply.choice === 1
      ? `Consulta de ${description(appointment)} confirmada.`
      : `Consulta de ${description(
          appointment
        )} cancelada conforme sua confirmação.`,
    "applied"
  ).catch(() => undefined);
  return true;
};
export default HandleQuarkConfirmationReply;
