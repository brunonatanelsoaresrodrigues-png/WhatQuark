import {
  AppointmentSnapshot,
  appointmentCanBeConfirmed,
  formatAppointmentDateTime
} from "./appointmentUtils";

const safeValue = (value: string | undefined, fallback: string): string =>
  (value || fallback)
    .replace(/[\r\n*_~`]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const appointmentLine = (appointment: AppointmentSnapshot): string => {
  const { date, time } = formatAppointmentDateTime(appointment.scheduledAt);
  const professional = appointment.raw.profissional?.nome
    ? ` com ${appointment.raw.profissional.nome}`
    : "";
  return `${date}${time ? ` às ${time}` : ""}${professional}`;
};

const confirmationOptions =
  "\n\n*Responda SIM para confirmar ou NÃO para cancelar.*\nVocê também pode responder *1* para confirmar ou *2* para cancelar.";

const appointmentDetails = (
  appointment: AppointmentSnapshot,
  clinicAddress = ""
): string => {
  const { date, time } = formatAppointmentDateTime(appointment.scheduledAt);
  const patient = safeValue(appointment.patientName, "Paciente");
  const professional = safeValue(
    appointment.raw.profissional?.nome,
    "profissional a confirmar"
  );
  const procedure = safeValue(appointment.raw.procedimento?.nome, "Consulta");
  const clinic = safeValue(appointment.raw.clinicaNome, "clínica a confirmar");
  const address = clinicAddress
    ? `, localizada no endereço: ${safeValue(clinicAddress, "")}`
    : "";

  return `Caro(a) Paciente _${patient}_, você possui um agendamento para o profissional *_${professional}_* no dia *${date}${
    time ? ` às ${time}` : ""
  }* para o procedimento ${procedure}, na clínica: ${clinic}${address}.`;
};

export const newAppointmentMessage = (
  appointment: AppointmentSnapshot,
  clinicAddress = ""
): string =>
  `${appointmentDetails(appointment, clinicAddress)}${confirmationOptions}`;

export const changedAppointmentMessage = (
  appointment: AppointmentSnapshot,
  clinicAddress = ""
): string =>
  `*Aviso de alteração de agendamento.*\n\n${appointmentDetails(
    appointment,
    clinicAddress
  )}${
    appointmentCanBeConfirmed(appointment.status) ? confirmationOptions : ""
  }`;

export const cancelledAppointmentMessage = (
  appointment: AppointmentSnapshot
): string =>
  `Caro(a) Paciente _${safeValue(
    appointment.patientName,
    "Paciente"
  )}_, seu agendamento de ${appointmentLine(
    appointment
  )} foi cancelado. Em caso de dúvida, fale com a nossa equipe.`;

export const reminderAppointmentMessage = (
  appointment: AppointmentSnapshot,
  hours: number,
  clinicAddress = "",
  mondayAdvance = false
): string =>
  `*Lembrete: sua consulta é ${
    mondayAdvance ? "na segunda-feira" : hours <= 2 ? "hoje" : "amanhã"
  }.*\n\n${appointmentDetails(
    appointment,
    clinicAddress
  )}${confirmationOptions}`;

export const manualReminderAppointmentMessage = (
  appointment: AppointmentSnapshot,
  clinicAddress = ""
): string =>
  `*Lembrete de consulta.*\n\n${appointmentDetails(
    appointment,
    clinicAddress
  )}${confirmationOptions}`;
