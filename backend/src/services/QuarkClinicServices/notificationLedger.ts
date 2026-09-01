import { UniqueConstraintError, Transaction } from "sequelize";
import QuarkAppointmentNotification from "../../models/QuarkAppointmentNotification";

export interface QuarkOutboxPayload {
  phone: string | null;
  patientName: string;
  body: string;
  requestsConfirmation: boolean;
  validUntil: string | null;
  scheduleFingerprint?: string;
  sendOnlyOnWeekday?: number;
}

export const createQuarkNotificationOnce = async (
  appointmentId: string,
  notificationKey: string,
  eventType: string,
  payload: QuarkOutboxPayload,
  status: "PENDING" | "SUPPRESSED" = "PENDING",
  transaction?: Transaction
): Promise<boolean> => {
  try {
    const [, created] = await QuarkAppointmentNotification.findOrCreate({
      where: { appointmentId, notificationKey },
      transaction,
      defaults: {
        appointmentId,
        notificationKey,
        eventType,
        recipientPhone: payload.phone,
        payload: JSON.stringify(payload),
        status,
        attempts: 0,
        nextAttemptAt: new Date(),
        priorityAt: payload.validUntil ? new Date(payload.validUntil) : null,
        processingStartedAt: null,
        workerId: null,
        sentAt: null,
        lastError: null
      }
    });
    return created;
  } catch (error) {
    if (error instanceof UniqueConstraintError) return false;
    throw error;
  }
};
