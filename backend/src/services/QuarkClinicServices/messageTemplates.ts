import {
  AppointmentSnapshot,
  formatAppointmentDateTime
} from "./appointmentUtils";
const clean = (value: string) => value.replace(/[\r\n*_~`]+/g, " ").trim();
const details = (appointment: AppointmentSnapshot) => {
  const { date, time } = formatAppointmentDateTime(appointment.scheduledAt);
  const clinic = clean(appointment.raw.clinicaNome || "nossa unidade");
  return `Sua consulta está prevista para ${date}${
    time ? ` às ${time}` : ""
  }, em ${clinic}.`;
};
export const newAppointmentMessage = (
  appointment: AppointmentSnapshot,
  _address = ""
) => details(appointment);
export const changedAppointmentMessage = (
  appointment: AppointmentSnapshot,
  _address = ""
) => `Houve uma alteração no seu agendamento.\n${details(appointment)}`;
export const cancelledAppointmentMessage = (
  appointment: AppointmentSnapshot
) => {
  const { date, time } = formatAppointmentDateTime(appointment.scheduledAt);
  return `Sua consulta de ${date}${
    time ? ` às ${time}` : ""
  } foi cancelada. Em caso de dúvida, fale com nossa equipe.`;
};
export const reminderAppointmentMessage = (
  appointment: AppointmentSnapshot,
  _hours: number,
  _address = "",
  _mondayAdvance = false
) => `Lembrete de consulta.\n${details(appointment)}`;
export const manualReminderAppointmentMessage = (
  appointment: AppointmentSnapshot,
  _address = ""
) => reminderAppointmentMessage(appointment, 24);
