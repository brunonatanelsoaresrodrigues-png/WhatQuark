import { UniqueConstraintError } from "sequelize";
import QuarkAppointmentNotification from "../../models/QuarkAppointmentNotification";

export interface QuarkOutboxPayload {
  phone: string | null;
  patientName: string;
  body: string;
  requestsConfirmation: boolean;
  validUntil: string | null;
  sendOnlyOnWeekday?: number;
}

export const createQuarkNotificationOnce = async (
  appointmentId: string,
  notificationKey: string,
  eventType: string,
  payload: QuarkOutboxPayload,
  status: "PENDING" | "SUPPRESSED" = "PENDING"
): Promise<boolean> => {
  try {
    const validUntil = payload.validUntil
      ? new Date(payload.validUntil)
      : undefined;
    await QuarkAppointmentNotification.create({
      appointmentId,
      notificationKey,
      eventType,
      recipientPhone: payload.phone,
      payload: JSON.stringify(payload),
      status,
      attempts: 0,
      nextAttemptAt: new Date(),
      priorityAt:
        validUntil && Number.isFinite(validUntil.getTime()) ? validUntil : null,
      processingStartedAt: null,
      workerId: null,
      sentAt: null,
      lastError: null
    });
    return true;
  } catch (error) {
    if (error instanceof UniqueConstraintError) return false;
    throw error;
  }
};
