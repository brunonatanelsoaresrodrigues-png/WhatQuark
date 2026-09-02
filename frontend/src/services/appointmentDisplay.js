const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const DAY_MS = 24 * 60 * 60 * 1000;

const partsFor = (value, timeZone, includeTime = false) => {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timeZone || DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(includeTime
      ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
      : {})
  }).formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value || "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: get("hour"),
    minute: get("minute")
  };
};

export const appointmentDayOffset = (
  scheduledAt,
  now = new Date(),
  timeZone = DEFAULT_TIMEZONE
) => {
  const scheduled = partsFor(scheduledAt, timeZone);
  const current = partsFor(now, timeZone);
  if (!scheduled || !current) return null;
  return Math.round(
    (Date.UTC(scheduled.year, scheduled.month - 1, scheduled.day) -
      Date.UTC(current.year, current.month - 1, current.day)) /
      DAY_MS
  );
};

export const appointmentDayLabel = (scheduledAt, now, timeZone) => {
  const days = appointmentDayOffset(scheduledAt, now, timeZone);
  if (days === null) return "";
  if (days === 0) return "Hoje";
  if (days === 1) return "Em 1 dia";
  if (days > 1) return `Em ${days} dias`;
  if (days === -1) return "Há 1 dia";
  return `Há ${Math.abs(days)} dias`;
};

export const appointmentDateTimeLabel = (
  scheduledAt,
  timeZone = DEFAULT_TIMEZONE
) => {
  const parts = partsFor(scheduledAt, timeZone, true);
  if (!parts) return "Data não informada";
  const pad = value => String(value).padStart(2, "0");
  return `${pad(parts.day)}/${pad(parts.month)}/${parts.year} às ${
    parts.hour
  }:${parts.minute}`;
};

const statusLabels = {
  AGENDADO: "Agendada",
  CONFIRMADO: "Confirmada",
  CANCELADO: "Cancelada",
  CANCELADO_VIA_SMS: "Cancelada",
  EXCLUIDO: "Excluída"
};

export const appointmentStatusLabel = status =>
  statusLabels[status] || status || "Situação não informada";

export const appointmentConfirmationDisabledReason = (
  appointment,
  now = Date.now()
) => {
  if (appointment?.status === "CONFIRMADO") {
    return "A consulta já está confirmada.";
  }
  if (appointment?.status !== "AGENDADO") {
    return "A consulta não está agendada.";
  }
  const scheduledAt = new Date(appointment?.scheduledAt).getTime();
  if (!Number.isFinite(scheduledAt) || scheduledAt <= Number(now)) {
    return "O horário da consulta já passou.";
  }
  return "";
};
