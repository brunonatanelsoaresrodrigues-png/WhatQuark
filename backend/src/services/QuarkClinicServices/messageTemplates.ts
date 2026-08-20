import {
  AppointmentSnapshot,
  formatAppointmentDateTime
} from "./appointmentUtils";

const greeting = (name: string): string => {
  const firstName = name.trim().split(/\s+/)[0] || "Paciente";
  return `Olá, ${firstName}!`;
};

const appointmentLine = (appointment: AppointmentSnapshot): string => {
  const { date, time } = formatAppointmentDateTime(appointment.scheduledAt);
  const professional = appointment.raw.profissional?.nome
    ? ` com ${appointment.raw.profissional.nome}`
    : "";
  return `${date}${time ? ` às ${time}` : ""}${professional}`;
};

const confirmationOptions =
  "\n\nResponda *1* para confirmar ou *2* para cancelar.";

export const newAppointmentMessage = (
  appointment: AppointmentSnapshot
): string =>
  `${greeting(
    appointment.patientName
  )} Seu agendamento foi registrado para ${appointmentLine(
    appointment
  )}.${confirmationOptions}`;

export const changedAppointmentMessage = (
  appointment: AppointmentSnapshot
): string =>
  `${greeting(
    appointment.patientName
  )} Seu agendamento foi alterado. O novo horário é ${appointmentLine(
    appointment
  )}.${confirmationOptions}`;

export const cancelledAppointmentMessage = (
  appointment: AppointmentSnapshot
): string =>
  `${greeting(appointment.patientName)} Seu agendamento de ${appointmentLine(
    appointment
  )} foi cancelado. Em caso de dúvida, fale com a nossa equipe.`;

export const reminderAppointmentMessage = (
  appointment: AppointmentSnapshot,
  hours: number
): string =>
  `${greeting(appointment.patientName)} Lembrete: sua consulta é ${
    hours <= 2 ? "em breve" : "amanhã"
  }, em ${appointmentLine(appointment)}.${confirmationOptions}`;
