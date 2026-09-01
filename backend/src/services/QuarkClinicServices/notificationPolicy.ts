import { dateParts, zonedDate } from "./clinicTime";

const ALLOWED_OUTBOUND_EVENT_TYPES = new Set([
  "CREATED",
  "REMINDER",
  "MANUAL_REMINDER",
  "RESCHEDULED"
]);

export const quarkNotificationCanBeSent = (eventType: string): boolean =>
  ALLOWED_OUTBOUND_EVENT_TYPES.has(eventType);

export const appointmentStillMatchesNotification = (
  status: string | undefined,
  scheduledAt: Date | null | undefined,
  payloadValidUntil: string | null,
  eventType = "REMINDER"
): boolean => {
  const allowedStatuses =
    eventType === "RESCHEDULED" ? ["AGENDADO", "CONFIRMADO"] : ["AGENDADO"];
  if (!status || !allowedStatuses.includes(status)) return false;
  if (!payloadValidUntil) return true;

  const payloadSchedule = new Date(payloadValidUntil).getTime();
  return (
    Number.isFinite(payloadSchedule) &&
    scheduledAt?.getTime() === payloadSchedule
  );
};

const sameClinicDay = (left: Date, right: Date, timezone: string): boolean => {
  const leftParts = dateParts(left, timezone);
  const rightParts = dateParts(right, timezone);
  return (
    leftParts.year === rightParts.year &&
    leftParts.month === rightParts.month &&
    leftParts.day === rightParts.day
  );
};

export const isSameDayReschedule = (
  eventType: string,
  scheduledAt: Date | null | undefined,
  eventCreatedAt: Date,
  timezone: string
): boolean =>
  eventType === "RESCHEDULED" &&
  !!scheduledAt &&
  sameClinicDay(scheduledAt, eventCreatedAt, timezone);

export const quarkNotificationExpiresAt = (
  eventType: string,
  payloadValidUntil: string | null,
  eventCreatedAt: Date,
  timezone: string
): string | null => {
  if (!payloadValidUntil) return null;
  const scheduledAt = new Date(payloadValidUntil);
  if (!Number.isFinite(scheduledAt.getTime())) return payloadValidUntil;
  if (!isSameDayReschedule(eventType, scheduledAt, eventCreatedAt, timezone))
    return payloadValidUntil;

  const parts = dateParts(scheduledAt, timezone);
  const followingDay = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + 1)
  );
  return (
    zonedDate(
      followingDay.getUTCFullYear(),
      followingDay.getUTCMonth() + 1,
      followingDay.getUTCDate(),
      0,
      0,
      0,
      timezone
    )?.toISOString() || payloadValidUntil
  );
};
