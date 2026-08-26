import QuarkAppointment from "../../../models/QuarkAppointment";
import QuarkAppointmentNotification from "../../../models/QuarkAppointmentNotification";
import { QuarkConfig } from "../../../services/QuarkClinicServices/config";
import {
  processNotification,
  quarkNotificationFamilyKey,
  recoverDisconnectedNotifications,
  runQuarkNotificationWorkerCycle
} from "../../../services/QuarkClinicServices/QuarkNotificationWorker";
import SendQuarkWhatsAppMessage from "../../../services/QuarkClinicServices/SendQuarkWhatsAppMessage";
import { quarkWhatsAppIsConnected } from "../../../services/QuarkClinicServices/QuarkWhatsAppConnectionGuard";

jest.mock("../../../database", () => ({
  __esModule: true,
  default: { transaction: jest.fn() }
}));
jest.mock("../../../models/QuarkAppointment", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), update: jest.fn() }
}));
jest.mock("../../../models/QuarkAppointmentNotification", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    update: jest.fn(),
    count: jest.fn()
  }
}));
jest.mock(
  "../../../services/QuarkClinicServices/SendQuarkWhatsAppMessage",
  () => ({ __esModule: true, default: jest.fn() })
);
jest.mock(
  "../../../services/QuarkClinicServices/QuarkWhatsAppConnectionGuard",
  () => ({ quarkWhatsAppIsConnected: jest.fn() })
);

const config = {
  maxRetryAttempts: 5,
  maxMessagesPerHour: 30,
  maxRecoveryMessagesPerHour: 5,
  workerPollIntervalMs: 5000,
  quietHoursStart: "20:00",
  quietHoursEnd: "08:00",
  sendIntervalMinMs: 60000,
  sendIntervalMaxMs: 180000,
  recipientCooldownMs: 15 * 60 * 1000,
  testAllowlist: [],
  timezone: "America/Sao_Paulo"
} as unknown as QuarkConfig;

const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

const makeNotification = () => ({
  id: 10,
  appointmentId: "42",
  notificationKey: "coverage-recovery:3:schedule:to:phonehash",
  eventType: "CREATED",
  recipientPhone: "5511999990000",
  payload: JSON.stringify({
    phone: "5511999990000",
    patientName: "Paciente Teste",
    body: "Confirme sua consulta",
    requestsConfirmation: true,
    validUntil: scheduledAt.toISOString()
  }),
  status: "PROCESSING",
  attempts: 0,
  nextAttemptAt: new Date(),
  update: jest.fn().mockResolvedValue(undefined)
});

describe("QuarkNotificationWorker anti-spam guarantees", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue({
      status: "AGENDADO",
      scheduledAt
    });
    (QuarkAppointment.update as jest.Mock).mockResolvedValue([1]);
    (QuarkAppointmentNotification.update as jest.Mock).mockResolvedValue([1]);
    (QuarkAppointmentNotification.count as jest.Mock).mockResolvedValue(0);
    (quarkWhatsAppIsConnected as jest.Mock).mockResolvedValue(true);
    (SendQuarkWhatsAppMessage as jest.Mock).mockResolvedValue({
      messageId: "message-1",
      ticketId: 7
    });
  });

  it("derives the same family for recipient fallback rows", () => {
    expect(
      quarkNotificationFamilyKey("coverage-recovery:3:schedule:to:first-phone")
    ).toBe("coverage-recovery:3:schedule");
    expect(
      quarkNotificationFamilyKey("coverage-recovery:3:schedule:to:second-phone")
    ).toBe("coverage-recovery:3:schedule");
  });

  it("pauses before claiming work while WhatsApp is disconnected", async () => {
    (quarkWhatsAppIsConnected as jest.Mock).mockResolvedValue(false);

    await expect(runQuarkNotificationWorkerCycle(config)).resolves.toBe(
      30 * 1000
    );

    expect(QuarkAppointmentNotification.findOne).not.toHaveBeenCalled();
    expect(QuarkAppointmentNotification.update).not.toHaveBeenCalled();
  });

  it("requeues only dead letters caused by a disconnected WhatsApp", async () => {
    (QuarkAppointmentNotification.update as jest.Mock).mockResolvedValue([24]);

    await expect(recoverDisconnectedNotifications()).resolves.toBe(24);

    expect(QuarkAppointmentNotification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "FAILED_RETRY",
        attempts: 0,
        nextAttemptAt: expect.any(Date)
      }),
      expect.objectContaining({
        where: {
          status: "DEAD_LETTER",
          lastError: "QUARK_TEMPORARY_WHATSAPP_DISCONNECTED"
        }
      })
    );
  });

  it("suppresses a fallback phone after the same appointment message was sent", async () => {
    const notification = makeNotification();
    (QuarkAppointmentNotification.findOne as jest.Mock).mockResolvedValueOnce({
      id: 9
    });

    await processNotification(config, notification as any);

    expect(notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "SUPPRESSED",
        lastError: expect.stringContaining("already sent")
      })
    );
    expect(SendQuarkWhatsAppMessage).not.toHaveBeenCalled();
  });

  it("defers consecutive messages to the same recipient without consuming a retry", async () => {
    const notification = makeNotification();
    const recentlySentAt = new Date(Date.now() - 60 * 1000);
    (QuarkAppointmentNotification.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ sentAt: recentlySentAt });

    await processNotification(config, notification as any);

    expect(notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "PENDING",
        nextAttemptAt: expect.any(Date),
        lastError: expect.stringContaining("anti-spam cooldown")
      })
    );
    expect(notification.attempts).toBe(0);
    expect(SendQuarkWhatsAppMessage).not.toHaveBeenCalled();
  });

  it("does not consume a retry if the connection drops between claim and send", async () => {
    const notification = makeNotification();
    (QuarkAppointmentNotification.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (SendQuarkWhatsAppMessage as jest.Mock).mockRejectedValue(
      new Error("QUARK_TEMPORARY_WHATSAPP_DISCONNECTED")
    );

    await processNotification(config, notification as any);

    expect(notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "PENDING",
        attempts: 0,
        nextAttemptAt: expect.any(Date),
        lastError: "QUARK_TEMPORARY_WHATSAPP_DISCONNECTED"
      })
    );
  });

  it("suppresses remaining fallback rows immediately after one successful send", async () => {
    const notification = makeNotification();
    (QuarkAppointmentNotification.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await processNotification(config, notification as any);

    expect(SendQuarkWhatsAppMessage).toHaveBeenCalledTimes(1);
    expect(notification.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "SENT" })
    );
    expect(QuarkAppointmentNotification.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "SUPPRESSED" }),
      expect.objectContaining({ where: expect.any(Object) })
    );
  });

  it("still sends a newly detected cancellation if its appointment time has just passed", async () => {
    const notification = makeNotification();
    const cancelledAt = new Date(Date.now() - 10 * 60 * 1000);
    notification.eventType = "CANCELLED";
    notification.notificationKey = "cancelled:schedule:to:phonehash";
    notification.payload = JSON.stringify({
      phone: "5511999990000",
      patientName: "Paciente Teste",
      body: "Consulta cancelada",
      requestsConfirmation: false,
      validUntil: cancelledAt.toISOString()
    });
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue({
      status: "CANCELADO",
      scheduledAt: cancelledAt
    });
    (QuarkAppointmentNotification.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await processNotification(config, notification as any);

    expect(SendQuarkWhatsAppMessage).toHaveBeenCalledTimes(1);
    expect(notification.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "SENT" })
    );
  });
});
