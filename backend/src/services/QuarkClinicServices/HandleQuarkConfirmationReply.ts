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
interface PendingCancel {
  appointmentId: string;
  fingerprint: string;
  reference: string;
  expiresAt: number;
}
const description = (appointment: QuarkAppointment) => {
  const p = formatAppointmentDateTime(appointment.scheduledAt);
  return `${p.date} às ${p.time}`;
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
  const referenceOf = (item: QuarkAppointment) =>
    appointmentReference(item.appointmentId, item.scheduleFingerprint, phone);
  const referencesOf = (item: QuarkAppointment) =>
    phoneVariants.map(value =>
      appointmentReference(item.appointmentId, item.scheduleFingerprint, value)
    );
  const appointment = reply.appointmentReference
    ? appointments.find(
        item => referencesOf(item).includes(reply.appointmentReference as string)
      )
    : undefined;
  if (!appointment) {
    const options = appointments
      .slice(0, 9)
      .map(
        item =>
          `${description(item)} — CONFIRMAR ${referenceOf(
            item
          )} ou CANCELAR ${referenceOf(item)}`
      )
      .join("\n");
    await send(
      `Escolha a consulta pelo código indicado.\n\n${options}\n\nSe não encontrar sua consulta, escreva ATENDENTE.`,
      "options"
    );
    return true;
  }
  const reference = referenceOf(appointment);
  const pendingKey = `quark-cancel:${whatsappId}:${phone}`;
  const pending = await readState<PendingCancel | null>(pendingKey, null);
  const validPending =
    pending &&
    pending.appointmentId === appointment.appointmentId &&
    pending.fingerprint === appointment.scheduleFingerprint &&
    pending.expiresAt > Date.now();
  if (validPending && !reply.appointmentReference) {
    await send(
      `Para cancelar a consulta de ${description(
        appointment
      )}, responda exatamente CONFIRMO CANCELAMENTO ${reference}. Se precisar de ajuda, escreva ATENDENTE.`,
      "explicit-cancel"
    );
    return true;
  }
  if (reply.choice === 2) {
    if (!reply.confirmedCancellation) {
      if (!validPending) {
        await writeState(pendingKey, {
          appointmentId: appointment.appointmentId,
          fingerprint: appointment.scheduleFingerprint,
          reference,
          expiresAt: Date.now() + 10 * 60000
        });
        await send(
          `Você deseja cancelar a consulta de ${description(
            appointment
          )}?\nPara concluir, responda CONFIRMO CANCELAMENTO ${reference}. Essa confirmação vale por 10 minutos.`,
          `cancel-question:${reference}`
        );
      }
      return true;
    }
    if (!validPending) {
      await send(
        "A confirmação de cancelamento expirou ou a consulta mudou. Solicite o cancelamento novamente ou fale com a equipe.",
        "expired"
      );
      return true;
    }
  }
  try {
    await ApplyQuarkDecision({
      appointmentId: appointment.appointmentId,
      phone,
      choice: reply.choice,
      fingerprint: appointment.scheduleFingerprint
    });
    await writeState(pendingKey, null);
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
