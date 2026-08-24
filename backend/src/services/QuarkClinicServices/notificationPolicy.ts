const ALLOWED_OUTBOUND_EVENT_TYPES = new Set([
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
    eventType === "RESCHEDULED"
      ? ["AGENDADO", "CONFIRMADO"]
      : ["AGENDADO"];
  if (!status || !allowedStatuses.includes(status)) return false;
  if (!payloadValidUntil) return true;

  const payloadSchedule = new Date(payloadValidUntil).getTime();
  return (
    Number.isFinite(payloadSchedule) &&
    scheduledAt?.getTime() === payloadSchedule
  );
};
