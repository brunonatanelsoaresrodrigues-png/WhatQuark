import {
  AppointmentSnapshot,
  formatAppointmentDateTime
} from "./appointmentUtils";
import { clinicTimezone, dateParts } from "./clinicTime";
const clean = (value: string) => value.replace(/[\r\n*_~`]+/g, " ").trim();
const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

const knownClinicAddress = (clinic: string): string =>
  normalized(clinic) === "ESSENCIAL SAUDE"
    ? "Avenida Ulisses Bezerra, 2227 - Cidade dos Funcionários, FORTALEZA, 60822-490"
    : "";

const parsePrice = (value: unknown): number | null => {
  if (typeof value === "number")
    return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const compact = value.replace(/[^\d,.-]/g, "");
  const decimal = compact.includes(",")
    ? compact.replace(/\./g, "").replace(",", ".")
    : compact;
  const parsed = Number(decimal);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const procedurePrice = (appointment: AppointmentSnapshot): string => {
  const procedure = appointment.raw.procedimento;
  const informedPrice = [
    procedure?.valor,
    procedure?.preco,
    procedure?.valorParticular,
    appointment.raw.valorProcedimento,
    appointment.raw.precoProcedimento
  ]
    .map(parsePrice)
    .find(value => value !== null);
  const procedureName = normalized(procedure?.nome || "");
  const knownPrice = procedureName.includes("PSIQUIATR")
    ? 350
    : procedureName.includes("LAUDO")
    ? 450
    : procedureName.includes("ANAMNESE")
    ? 100
    : procedureName.includes("SESSAO")
    ? 80
    : null;
  const price = informedPrice ?? knownPrice;
  return price === null
    ? ""
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
      })
        .format(price)
        .replace(/[\u00a0\u202f]/g, " ");
};

export const confirmationReplyInstructions = `Por favor, responda apenas com uma das opções:

*CONFIRMAR* — para confirmar
*CANCELAR* — para cancelar`;

export const removeLegacyConfirmationCodes = (body: string): string =>
  body
    .replace(/\b(CONFIRMAR|CANCELAR)\s+[A-F0-9]{8}\b/gi, "$1")
    .replace(/\*CONFIRMAR\*\s+ou\s+\*1\*/gi, "*CONFIRMAR*")
    .replace(/\*CANCELAR\*\s+ou\s+\*2\*/gi, "*CANCELAR*");

export const appointmentNoticeOptOut =
  "Para deixar de receber avisos, responda *PARAR*.";
const details = (appointment: AppointmentSnapshot) => {
  const { date, time } = formatAppointmentDateTime(appointment.scheduledAt);
  const clinic = clean(appointment.raw.clinicaNome || "nossa unidade");
  return `Sua consulta está prevista para ${date}${
    time ? ` às ${time}` : ""
  }, em ${clinic}.`;
};

const reminderDetails = (
  appointment: AppointmentSnapshot,
  configuredAddress = "",
  hours = 24
) => {
  const { date, time } = formatAppointmentDateTime(appointment.scheduledAt);
  const patient = clean(appointment.patientName || "Paciente");
  const professional = clean(
    appointment.raw.profissional?.nome || "Profissional não informado"
  );
  const clinic = clean(appointment.raw.clinicaNome || "nossa unidade");
  const procedure = clean(
    appointment.raw.procedimento?.nome || "procedimento não informado"
  );
  const price = procedurePrice(appointment);
  const address = clean(configuredAddress || knownClinicAddress(clinic));
  const location = `${clinic}${
    address ? `, localizada no endereço: ${address}` : ""
  }`;
  const arrivalOrder = "O atendimento é realizado por ordem de chegada.";

  if (hours <= 2) {
    return `Lembrete: sua consulta é hoje${
      time ? ` às ${time}` : " em horário a confirmar"
    }, com o(a) profissional ${professional}, na clínica ${location}.\n\n${arrivalOrder}`;
  }

  if (hours === 24 && appointment.status === "CONFIRMADO") {
    return `Lembrete: sua consulta com o(a) profissional ${professional} está confirmada para ${date}${
      time ? ` às ${time}` : " em horário a confirmar"
    }, na clínica ${location}.\n\n${arrivalOrder}`;
  }

  return `Caro(a) Paciente ${patient}, você possui um agendamento com o(a) profissional ${professional} no dia ${date}${
    time ? ` às ${time}` : " em horário a confirmar"
  } para o procedimento ${procedure}${
    price ? `, no valor de ${price}` : ""
  }, na clínica ${location}.\n\n${arrivalOrder}`;
};
export const newAppointmentMessage = (
  appointment: AppointmentSnapshot,
  _address = ""
) => details(appointment);
export const changedAppointmentMessage = (
  appointment: AppointmentSnapshot,
  _address = "",
  now = new Date(),
  timezone = clinicTimezone()
) => {
  if (
    appointment.scheduledAt &&
    appointment.scheduledAt.getTime() <= now.getTime()
  ) {
    const scheduled = dateParts(appointment.scheduledAt, timezone);
    const current = dateParts(now, timezone);
    if (
      scheduled.year === current.year &&
      scheduled.month === current.month &&
      scheduled.day === current.day
    ) {
      const { time } = formatAppointmentDateTime(appointment.scheduledAt);
      const clinic = clean(appointment.raw.clinicaNome || "nossa unidade");
      return `Houve uma alteração no seu agendamento de hoje${
        time ? `, às ${time}` : ""
      }, em ${clinic}. Em caso de dúvida, fale com nossa equipe.`;
    }
  }
  return `Houve uma alteração no seu agendamento.\n${details(appointment)}`;
};
export const cancelledAppointmentMessage = (
  appointment: AppointmentSnapshot
) => {
  const { date, time } = formatAppointmentDateTime(appointment.scheduledAt);
  return `Sua consulta de ${date}${
    time ? ` às ${time}` : ""
  } foi cancelada. Se desejar marcar uma nova data, responda a esta mensagem e nossa equipe ajudará com o reagendamento.`;
};
export const noShowRecoveryMessage = (appointment: AppointmentSnapshot) => {
  const { date, time } = formatAppointmentDateTime(appointment.scheduledAt);
  const patient = clean(appointment.patientName || "Paciente");
  const professional = clean(
    appointment.raw.profissional?.nome || "profissional agendado"
  );
  return `Olá, ${patient}. Verificamos que não foi possível comparecer à consulta de ${date}${
    time ? ` às ${time}` : ""
  }, com ${professional}. Se desejar reagendar, responda a esta mensagem e ajudaremos com uma nova data.`;
};
export const noShowFollowUpMessage = (appointment: AppointmentSnapshot) => {
  const patient = clean(appointment.patientName || "Paciente");
  return `Olá, ${patient}. Passando para saber se deseja remarcar a consulta. Se precisar de uma nova data, responda a esta mensagem e nossa equipe ajudará.`;
};
export const reminderAppointmentMessage = (
  appointment: AppointmentSnapshot,
  _hours: number,
  address = "",
  _mondayAdvance = false
) => reminderDetails(appointment, address, _hours);
export const manualReminderAppointmentMessage = (
  appointment: AppointmentSnapshot,
  address = ""
) => reminderAppointmentMessage(appointment, 24, address);
