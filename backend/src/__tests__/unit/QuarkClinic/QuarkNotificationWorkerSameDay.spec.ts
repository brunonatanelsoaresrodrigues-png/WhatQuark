import QuarkAppointment from "../../../models/QuarkAppointment";
import QuarkAppointmentNotification from "../../../models/QuarkAppointmentNotification";
import Message from "../../../models/Message";
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
jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
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
    (Message.findOne as jest.Mock).mockResolvedValue(null);
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
      body: "Lembrete de consulta.\n\nPara confirmar: CONFIRMAR B2DB68F5\nPara cancelar: CANCELAR B2DB68F5",
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
        expiresAt: undefined
      })
    );
    expect(QuarkAppointment.update).not.toHaveBeenCalled();
    expect(row.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "SENT", messageId: "provider-message" })
    );
  });

  it("sends the first recovery only after an authoritative no-show", async () => {
    const row = notification("NO_SHOW_RECOVERY");
    row.payload = JSON.stringify({
      phone: "5511999990000",
      patientName: "Paciente",
      body: "Notamos que não foi possível comparecer. Deseja reagendar?",
      requestsConfirmation: false,
      validUntil: null,
      scheduleFingerprint: "no-show-appointment"
    });
    const current = {
      appointmentId: "492469752",
      phone: "5511999990000",
      status: "FALTOU",
      scheduledAt: new Date("2026-08-31T17:00:00.000Z"),
      scheduleFingerprint: "no-show-appointment",
      snapshot: JSON.stringify({ clinicaNome: "ESSENCIAL SAÚDE" })
    };
    (QuarkAppointment.findOne as jest.Mock)
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(null);

    await processNotification(config, row);

    expect(SendQuarkWhatsAppMessage).toHaveBeenCalledWith(
      config,
      "5511999990000",
      "Paciente",
      expect.stringContaining("Deseja reagendar"),
      expect.objectContaining({
        allowNoShowAppointment: true,
        expiresAt: undefined,
        appointmentId: "492469752"
      })
    );
    expect(row.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "SENT" })
    );
  });

  it("suppresses no-show recovery when the patient already has a future appointment", async () => {
    const row = notification("NO_SHOW_RECOVERY");
    row.payload = JSON.stringify({
      phone: "5511999990000",
      patientName: "Paciente",
      body: "Deseja reagendar?",
      requestsConfirmation: false,
      validUntil: null,
      scheduleFingerprint: "no-show-appointment"
    });
    const current = {
      appointmentId: "492469752",
      phone: "5511999990000",
      status: "FALTOU",
      scheduledAt: new Date("2026-08-31T17:00:00.000Z"),
      scheduleFingerprint: "no-show-appointment",
      snapshot: "{}"
    };
    (QuarkAppointment.findOne as jest.Mock)
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce({ appointmentId: "future" });

    await processNotification(config, row);

    expect(SendQuarkWhatsAppMessage).not.toHaveBeenCalled();
    expect(row.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "SUPPRESSED",
        lastError: "Patient already has another future appointment"
      })
    );
  });

  it("defers no-show recovery when its dedicated hourly limit is reached", async () => {
    const row = notification("NO_SHOW_RECOVERY");
    row.payload = JSON.stringify({
      phone: "5511999990000",
      patientName: "Paciente",
      body: "Deseja reagendar?",
      requestsConfirmation: false,
      validUntil: null,
      scheduleFingerprint: "no-show-appointment"
    });
    const current = {
      appointmentId: "492469752",
      phone: "5511999990000",
      status: "FALTOU",
      scheduledAt: new Date("2026-08-31T17:00:00.000Z"),
      scheduleFingerprint: "no-show-appointment",
      snapshot: "{}"
    };
    (QuarkAppointment.findOne as jest.Mock)
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(null);
    (QuarkAppointmentNotification.count as jest.Mock).mockResolvedValue(5);

    await processNotification(
      { ...config, maxRecoveryMessagesPerHour: 5 },
      row
    );

    expect(SendQuarkWhatsAppMessage).not.toHaveBeenCalled();
    expect(row.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "PENDING",
        nextAttemptAt: new Date("2026-08-31T18:15:00.000Z"),
        lastError: "No-show recovery hourly limit reached"
      })
    );
  });

  it("does not send the next-day follow-up after the patient replies", async () => {
    const row = notification("NO_SHOW_FOLLOW_UP");
    row.payload = JSON.stringify({
      phone: "5511999990000",
      patientName: "Paciente",
      body: "Ainda deseja remarcar?",
      requestsConfirmation: false,
      validUntil: null,
      scheduleFingerprint: "no-show-appointment"
    });
    const current = {
      appointmentId: "492469752",
      phone: "5511999990000",
      status: "FALTOU",
      scheduledAt: new Date("2026-08-31T17:00:00.000Z"),
      scheduleFingerprint: "no-show-appointment",
      snapshot: "{}"
    };
    (QuarkAppointment.findOne as jest.Mock)
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(null);
    (QuarkAppointmentNotification.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 94868,
        ticketId: 7,
        sentAt: new Date("2026-08-31T17:30:00.000Z")
      });
    (Message.findOne as jest.Mock).mockResolvedValue({ id: "patient-reply" });

    await processNotification(config, row);

    expect(SendQuarkWhatsAppMessage).not.toHaveBeenCalled();
    expect(row.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "SUPPRESSED",
        lastError: "Patient replied after the initial no-show recovery"
      })
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
