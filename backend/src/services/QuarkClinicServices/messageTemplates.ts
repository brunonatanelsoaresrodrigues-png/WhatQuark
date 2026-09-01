import {
  AppointmentSnapshot,
  formatAppointmentDateTime
} from "./appointmentUtils";
import { clinicTimezone, dateParts } from "./clinicTime";
const clean = (value: string) => value.replace(/[\r\n*_~`]+/g, " ").trim();
const details = (appointment: AppointmentSnapshot) => {
  const { date, time } = formatAppointmentDateTime(appointment.scheduledAt);
  const clinic = clean(appointment.raw.clinicaNome || "nossa unidade");
  return `Sua consulta está prevista para ${date}${
    time ? ` às ${time}` : ""
  }, em ${clinic}.`;
};

const reminderDetails = (appointment: AppointmentSnapshot) => {
  const { date, time } = formatAppointmentDateTime(appointment.scheduledAt);
  const patient = clean(appointment.patientName || "Paciente");
  const professional = clean(
    appointment.raw.profissional?.nome || "Profissional não informado"
  );
  const clinic = clean(appointment.raw.clinicaNome || "nossa unidade");

  return `📅 *Lembrete de consulta*

Olá, ${patient}!

Sua consulta está agendada:

👩‍⚕️ *Profissional:* ${professional}
📆 *Data:* ${date}
🕐 *Horário:* ${time || "a confirmar"}
📍 *Local:* ${clinic}`;
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
  } foi cancelada. Em caso de dúvida, fale com nossa equipe.`;
};
export const reminderAppointmentMessage = (
  appointment: AppointmentSnapshot,
  _hours: number,
  _address = "",
  _mondayAdvance = false
) => reminderDetails(appointment);
export const manualReminderAppointmentMessage = (
  appointment: AppointmentSnapshot,
  _address = ""
) => reminderAppointmentMessage(appointment, 24);
