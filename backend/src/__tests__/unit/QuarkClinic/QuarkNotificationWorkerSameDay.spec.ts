import QuarkAppointment from "../../../models/QuarkAppointment";
import QuarkAppointmentNotification from "../../../models/QuarkAppointmentNotification";
import { assertExecution } from "../../../services/MessagingServices/policy";
import { processNotification } from "../../../services/QuarkClinicServices/QuarkNotificationWorker";
import SendQuarkWhatsAppMessage from "../../../services/QuarkClinicServices/SendQuarkWhatsAppMessage";
import { QuarkConfig } from "../../../services/QuarkClinicServices/config";

jest.mock("../../../database", () => ({
  __esModule: true,
  default: { transaction: jest.fn() }
}));
jest.mock("../../../models/QuarkAppointmentNotification", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), update: jest.fn(), count: jest.fn() }
}));
jest.mock("../../../models/QuarkAppointment", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), update: jest.fn() }
}));
jest.mock("../../../models/OutboundMessage", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));
jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));
jest.mock(
  "../../../services/QuarkClinicServices/SendQuarkWhatsAppMessage",
  () => ({ __esModule: true, default: jest.fn() })
);
jest.mock("../../../services/QuarkClinicServices/dashboardEvents", () => ({
  emitQuarkDashboardUpdate: jest.fn()
}));
jest.mock("../../../services/MessagingServices/policy", () => ({
  assertExecution: jest.fn()
}));
jest.mock("../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const config = {
  timezone: "America/Sao_Paulo",
  testAllowlist: [],
  sendIntervalMaxMs: 180000
} as unknown as QuarkConfig;

const notification = (eventType: string) => {
  const row = {
    id: 94869,
    appointmentId: "492469752",
    recipientPhone: "5511999990000",
    eventType,
    createdAt: new Date("2026-08-31T17:54:06.000Z"),
    attempts: 0,
    payload: JSON.stringify({
      phone: "5511999990000",
      patientName: "Paciente",
      body: "Aviso de alteração",
      requestsConfirmation: false,
      validUntil: "2026-08-31T17:00:00.000Z",
      scheduleFingerprint: "same-day-change"
    }),
    update: jest.fn()
  };
  return row as any;
};

describe("Quark same-day reschedule delivery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2026-08-31T18:00:00.000Z").getTime());
    (assertExecution as jest.Mock).mockResolvedValue(undefined);
    (QuarkAppointmentNotification.findOne as jest.Mock).mockResolvedValue(null);
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue({
      appointmentId: "492469752",
      phone: "5511999990000",
      status: "AGUARDANDO_ATENDIMENTO",
      scheduledAt: new Date("2026-08-31T17:00:00.000Z"),
      scheduleFingerprint: "same-day-change",
      snapshot: JSON.stringify({ clinicaNome: "ESSENCIAL SAÚDE" })
    });
    (SendQuarkWhatsAppMessage as jest.Mock).mockResolvedValue({
      messageId: "provider-message",
      ticketId: 7
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it.each(["CREATED", "UPDATED", "RESCHEDULED"])(
    "suppresses a queued %s notice outside the reminder schedule",
    async eventType => {
      const row = notification(eventType);

      await processNotification(config, row);

      expect(SendQuarkWhatsAppMessage).not.toHaveBeenCalled();
      expect(row.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "SUPPRESSED",
          lastError: "Confirmation notices are sent only in reminder windows"
        })
      );
    }
  );

  it("still suppresses an expired reminder", async () => {
    const row = notification("REMINDER");

    await processNotification(config, row);

    expect(SendQuarkWhatsAppMessage).not.toHaveBeenCalled();
    expect(row.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "SUPPRESSED",
        lastError: "Notification expired after the appointment time"
      })
    );
  });

  it("sends a valid reminder and starts waiting for confirmation", async () => {
    const row = notification("REMINDER");
    row.payload = JSON.stringify({
      phone: "5511999990000",
      patientName: "Paciente",
      body:
        "Lembrete de consulta.\n\nPara confirmar: CONFIRMAR B2DB68F5\nPara cancelar: CANCELAR B2DB68F5",
      requestsConfirmation: true,
      validUntil: "2026-08-31T20:00:00.000Z",
      scheduleFingerprint: "future-reminder"
    });
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue({
      appointmentId: "492469752",
      phone: "5511999990000",
      status: "AGENDADO",
      scheduledAt: new Date("2026-08-31T20:00:00.000Z"),
      scheduleFingerprint: "future-reminder",
      snapshot: JSON.stringify({ clinicaNome: "ESSENCIAL SAÚDE" })
    });

    await processNotification(config, row);

    expect(SendQuarkWhatsAppMessage).toHaveBeenCalledWith(
      config,
      "5511999990000",
      "Paciente",
      expect.stringContaining("Lembrete de consulta"),
      expect.objectContaining({
        appointmentNotice: true,
        appointmentId: "492469752",
        scheduleFingerprint: "future-reminder",
        expiresAt: "2026-08-31T20:00:00.000Z",
        allowAppointmentPhoneVariants: true
      })
    );
    const sentBody = (SendQuarkWhatsAppMessage as jest.Mock).mock.calls[0][3];
    expect(sentBody).toContain("Para confirmar: CONFIRMAR");
    expect(sentBody).toContain("Para cancelar: CANCELAR");
    expect(sentBody).not.toContain("B2DB68F5");
    expect(row.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "SENT", messageId: "provider-message" })
    );
    expect(QuarkAppointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        awaitingConfirmation: true,
        confirmationRequestedAt: expect.any(Date)
      }),
      {
        where: {
          appointmentId: "492469752",
          status: "AGENDADO",
          scheduleFingerprint: "future-reminder"
        }
      }
    );
  });

  it("sends an external cancellation with the cancelled-appointment policy", async () => {
    const row = notification("CANCELLED");
    row.payload = JSON.stringify({
      phone: "5511999990000",
      patientName: "Paciente",
      body: "Sua consulta foi cancelada.",
      requestsConfirmation: false,
      validUntil: "2026-08-31T20:00:00.000Z",
      scheduleFingerprint: "cancelled-appointment"
    });
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue({
      appointmentId: "492469752",
      phone: "5511999990000",
      status: "CANCELADO",
      scheduledAt: new Date("2026-08-31T20:00:00.000Z"),
      scheduleFingerprint: "cancelled-appointment",
      snapshot: JSON.stringify({ clinicaNome: "ESSENCIAL SAÚDE" })
    });

    await processNotification(config, row);

    expect(SendQuarkWhatsAppMessage).toHaveBeenCalledWith(
      config,
      "5511999990000",
      "Paciente",
      "Sua consulta foi cancelada.",
      expect.objectContaining({
        appointmentNotice: true,
        appointmentId: "492469752",
        scheduleFingerprint: "cancelled-appointment",
        allowCancelledAppointment: true,
        expiresAt: "2026-08-31T20:00:00.000Z"
      })
    );
    expect(QuarkAppointment.update).not.toHaveBeenCalled();
    expect(row.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "SENT", messageId: "provider-message" })
    );
  });

  it("suppresses a reminder after the appointment schedule changes", async () => {
    const row = notification("REMINDER");
    row.payload = JSON.stringify({
      phone: "5511999990000",
      patientName: "Paciente",
      body: "Lembrete de consulta",
      requestsConfirmation: true,
      validUntil: "2026-08-31T20:00:00.000Z",
      scheduleFingerprint: "old-schedule"
    });
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue({
      appointmentId: "492469752",
      phone: "5511999990000",
      status: "AGENDADO",
      scheduledAt: new Date("2026-09-01T20:00:00.000Z"),
      scheduleFingerprint: "new-schedule",
      snapshot: "{}"
    });

    await processNotification(config, row);

    expect(SendQuarkWhatsAppMessage).not.toHaveBeenCalled();
    expect(row.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "SUPPRESSED",
        lastError: "ERR_APPOINTMENT_CHANGED"
      })
    );
  });

  it("exposes a permanent phone failure as a dead letter", async () => {
    const row = notification("REMINDER");
    row.payload = JSON.stringify({
      phone: "5511999990000",
      patientName: "Paciente",
      body: "Lembrete de consulta",
      requestsConfirmation: true,
      validUntil: "2026-08-31T20:00:00.000Z",
      scheduleFingerprint: "future-reminder"
    });
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue({
      appointmentId: "492469752",
      scheduledAt: new Date("2026-08-31T20:00:00.000Z"),
      scheduleFingerprint: "future-reminder",
      snapshot: "{}"
    });
    (SendQuarkWhatsAppMessage as jest.Mock).mockRejectedValue(
      new Error("ERR_NUMBER_NOT_ON_WHATSAPP")
    );

    await processNotification(config, row);

    expect(row.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "DEAD_LETTER",
        lastError: "ERR_NUMBER_NOT_ON_WHATSAPP"
      })
    );
  });

  it("keeps an accepted send with pending local persistence as unknown", async () => {
    const row = notification("REMINDER");
    row.payload = JSON.stringify({
      phone: "5511999990000",
      patientName: "Paciente",
      body: "Lembrete de consulta",
      requestsConfirmation: true,
      validUntil: "2026-08-31T20:00:00.000Z",
      scheduleFingerprint: "future-reminder"
    });
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue({
      appointmentId: "492469752",
      scheduledAt: new Date("2026-08-31T20:00:00.000Z"),
      scheduleFingerprint: "future-reminder",
      snapshot: "{}"
    });
    (SendQuarkWhatsAppMessage as jest.Mock).mockRejectedValue(
      new Error("ERR_LOCAL_PERSISTENCE_PENDING")
    );

    await processNotification(config, row);

    expect(row.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "UNKNOWN",
        lastError: "ERR_LOCAL_PERSISTENCE_PENDING"
      })
    );
  });

  it("defers a notice already accepted by the central queue without rapid retry", async () => {
    const row = notification("REMINDER");
    row.payload = JSON.stringify({
      phone: "5511999990000",
      patientName: "Paciente",
      body: "Lembrete de consulta",
      requestsConfirmation: true,
      validUntil: "2026-08-31T20:00:00.000Z",
      scheduleFingerprint: "future-reminder"
    });
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue({
      appointmentId: "492469752",
      phone: "5511999990000",
      status: "AGENDADO",
      scheduledAt: new Date("2026-08-31T20:00:00.000Z"),
      scheduleFingerprint: "future-reminder",
      snapshot: JSON.stringify({ clinicaNome: "ESSENCIAL SAÚDE" })
    });
    (SendQuarkWhatsAppMessage as jest.Mock).mockRejectedValue(
      new Error("ERR_MESSAGE_QUEUED")
    );

    await processNotification(config, row);

    expect(row.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "FAILED_RETRY",
        nextAttemptAt: new Date("2026-08-31T18:05:00.000Z"),
        lastError: "ERR_MESSAGE_QUEUED"
      })
    );
  });
});
