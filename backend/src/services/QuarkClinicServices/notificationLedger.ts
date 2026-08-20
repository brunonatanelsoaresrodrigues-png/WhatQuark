import { UniqueConstraintError } from "sequelize";
import QuarkAppointmentNotification from "../../models/QuarkAppointmentNotification";

export interface QuarkOutboxPayload {
  phone: string | null;
  patientName: string;
  body: string;
  requestsConfirmation: boolean;
  validUntil: string | null;
}

export const createQuarkNotificationOnce = async (
  appointmentId: string,
  notificationKey: string,
  eventType: string,
  payload: QuarkOutboxPayload,
  status: "PENDING" | "SUPPRESSED" = "PENDING"
): Promise<boolean> => {
  try {
    await QuarkAppointmentNotification.create({
      appointmentId,
      notificationKey,
      eventType,
      recipientPhone: payload.phone,
      payload: JSON.stringify(payload),
      status,
      attempts: 0,
      nextAttemptAt: new Date(),
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
