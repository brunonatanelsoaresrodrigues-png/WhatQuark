import QuarkAppointment from "../../../models/QuarkAppointment";
import { getQuarkConfig } from "../../../services/QuarkClinicServices/config";
import { emitQuarkDashboardUpdate } from "../../../services/QuarkClinicServices/dashboardEvents";
import EnqueueManualQuarkReminderService from "../../../services/QuarkClinicServices/EnqueueManualQuarkReminderService";
import { createQuarkNotificationOnce } from "../../../services/QuarkClinicServices/notificationLedger";
import { getPreference } from "../../../services/MessagingServices/preferences";

jest.mock("../../../services/MessagingServices/policy", () => ({
  assertExecution: jest.fn().mockResolvedValue(undefined)
}));
jest.mock("../../../services/MessagingServices/state", () => ({
  withLease: (_: string, fn: Function) => fn()
}));
jest.mock("../../../services/MessagingServices/preferences", () => ({
  ...jest.requireActual("../../../services/MessagingServices/preferences"),
  getPreference: jest.fn().mockResolvedValue({ consent: "GRANTED" })
}));
jest.mock("../../../models/QuarkAppointment", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock("../../../services/QuarkClinicServices/config", () => ({
  getQuarkConfig: jest.fn()
}));
jest.mock("../../../services/QuarkClinicServices/dashboardEvents", () => ({
  emitQuarkDashboardUpdate: jest.fn()
}));
jest.mock("../../../services/QuarkClinicServices/notificationLedger", () => ({
  createQuarkNotificationOnce: jest.fn()
}));

const appointment = {
  appointmentId: "quark-42",
  patientId: "patient-7",
  phone: "5585999990000",
  phones: JSON.stringify(["5585999990000"]),
  patientName: "PACIENTE COMPLETO",
  status: "AGENDADO",
  scheduledAt: new Date("2099-08-21T16:00:00-03:00"),
  scheduleFingerprint: "a".repeat(64),
  snapshotFingerprint: "b".repeat(64),
  snapshot: JSON.stringify({
    dataAgendamento: "21-08-2099",
    horaAgendamento: "16:00:00",
    clinicaNome: "ESSENCIAL SAÚDE",
    profissionalNome: "PROFISSIONAL COMPLETO",
    procedimentoNome: "Consulta"
  })
};

describe("EnqueueManualQuarkReminderService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.QUARK_APPOINTMENT_NOTICES_REQUIRE_OPT_IN = "false";
    (getQuarkConfig as jest.Mock).mockReturnValue({
      timezone: "America/Sao_Paulo",
      clinicAddress: "Avenida Ulisses Bezerra, 2227"
    });
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue(appointment);
    (createQuarkNotificationOnce as jest.Mock).mockResolvedValue(true);
    (getPreference as jest.Mock).mockResolvedValue({ consent: "GRANTED" });
  });

  it("queues a confirmation reminder through the protected outbox", async () => {
    await expect(
      EnqueueManualQuarkReminderService({ appointmentId: "quark-42" })
    ).resolves.toEqual({ queued: true, recipients: 1 });

    expect(createQuarkNotificationOnce).toHaveBeenCalledWith(
      "quark-42",
      expect.stringMatching(
        /^manual-reminder:\d{4}-\d{2}-\d{2}:a{24}:to:[a-f0-9]{16}$/
      ),
      "MANUAL_REMINDER",
      expect.objectContaining({
        phone: "5585999990000",
        patientName: "PACIENTE COMPLETO",
        requestsConfirmation: true,
        validUntil: appointment.scheduledAt.toISOString(),
        body: expect.stringContaining("Para confirmar: CONFIRMAR")
      })
    );
    expect(emitQuarkDashboardUpdate).toHaveBeenCalledWith(
      "notification",
      "quark-42"
    );
  });

  it("queues only the primary recipient, even when alternate phones exist", async () => {
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue({
      ...appointment,
      phones: JSON.stringify(["5585999990000", "5585988880000"])
    });

    await expect(
      EnqueueManualQuarkReminderService({ appointmentId: "quark-42" })
    ).resolves.toEqual({ queued: true, recipients: 1 });

    expect(createQuarkNotificationOnce).toHaveBeenCalledTimes(1);
  });

  it("queues an operational reminder without manual opt-in", async () => {
    (getPreference as jest.Mock).mockResolvedValue({ consent: "UNKNOWN" });

    await expect(
      EnqueueManualQuarkReminderService({ appointmentId: "quark-42" })
    ).resolves.toEqual({ queued: true, recipients: 1 });
  });

  it("rejects a reminder after the patient opts out", async () => {
    (getPreference as jest.Mock).mockResolvedValue({ consent: "REVOKED" });

    await expect(
      EnqueueManualQuarkReminderService({ appointmentId: "quark-42" })
    ).rejects.toEqual(
      expect.objectContaining({
        statusCode: 409,
        message: "ERR_RECIPIENT_OPTED_OUT"
      })
    );
    expect(createQuarkNotificationOnce).not.toHaveBeenCalled();
  });

  it("rejects a duplicate manual reminder on the same day", async () => {
    (createQuarkNotificationOnce as jest.Mock).mockResolvedValue(false);

    await expect(
      EnqueueManualQuarkReminderService({ appointmentId: "quark-42" })
    ).rejects.toEqual(
      expect.objectContaining({
        statusCode: 409,
        message: "Um lembrete manual já foi solicitado hoje para esta consulta."
      })
    );
  });

  it("does not queue reminders for non-scheduled appointments", async () => {
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue({
      ...appointment,
      status: "CONFIRMADO"
    });

    await expect(
      EnqueueManualQuarkReminderService({ appointmentId: "quark-42" })
    ).rejects.toEqual(expect.objectContaining({ statusCode: 409 }));
    expect(createQuarkNotificationOnce).not.toHaveBeenCalled();
  });
});
