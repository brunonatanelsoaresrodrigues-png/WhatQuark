import QuarkAppointment from "../../../models/QuarkAppointment";
import QuarkAppointmentNotification from "../../../models/QuarkAppointmentNotification";
import QuarkAppointmentRecipient from "../../../models/QuarkAppointmentRecipient";
import QuarkSyncState from "../../../models/QuarkSyncState";
import { buildAppointmentSnapshot } from "../../../services/QuarkClinicServices/appointmentUtils";
import { QuarkConfig } from "../../../services/QuarkClinicServices/config";
import { listQuarkAppointments } from "../../../services/QuarkClinicServices/QuarkClinicClient";
import { createQuarkNotificationOnce } from "../../../services/QuarkClinicServices/notificationLedger";
import { SyncQuarkAppointmentsService } from "../../../services/QuarkClinicServices/SyncQuarkAppointmentsService";

jest.mock("../../../models/QuarkAppointment", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(),
    findOrCreate: jest.fn()
  }
}));

jest.mock("../../../models/QuarkAppointmentNotification", () => ({
  __esModule: true,
  default: {
    update: jest.fn()
  }
}));

jest.mock("../../../models/QuarkAppointmentRecipient", () => ({
  __esModule: true,
  default: {
    update: jest.fn(),
    findOrCreate: jest.fn()
  }
}));

jest.mock("../../../models/QuarkSyncState", () => ({
  __esModule: true,
  default: {
    findOrCreate: jest.fn(),
    update: jest.fn(),
    findByPk: jest.fn()
  }
}));

jest.mock("../../../services/QuarkClinicServices/QuarkClinicClient", () => ({
  listQuarkAppointments: jest.fn()
}));
jest.mock(
  "../../../services/QuarkClinicServices/RecordQuarkAppointmentEventService",
  () => jest.fn()
);

jest.mock("../../../services/QuarkClinicServices/notificationLedger", () => ({
  createQuarkNotificationOnce: jest.fn()
}));

const config = {
  baseUrl: "https://api.example.test",
  authToken: "test-token",
  xChaveKey: "test-key",
  xSecretKey: "test-secret",
  pollIntervalMs: 300000,
  startupDelayMs: 20000,
  defaultCountryCode: "55",
  cancelReason: "test",
  reminderHours: [],
  sendIntervalMinMs: 15000,
  sendIntervalMaxMs: 45000,
  syncHorizonDays: 30,
  requestTimeoutMs: 15000,
  maxMessagesPerHour: 100,
  quietHoursStart: "20:00",
  quietHoursEnd: "08:00",
  maxRetryAttempts: 5,
  processingTimeoutMs: 600000,
  workerPollIntervalMs: 5000,
  timezone: "America/Sao_Paulo",
  clinicAddress: "Avenida de Teste, 123",
  dryRun: true,
  testAllowlist: []
} as QuarkConfig;

const futureDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + 10);
  const pad = (value: number) => (value < 10 ? `0${value}` : String(value));
  return `${pad(date.getDate())}-${pad(
    date.getMonth() + 1
  )}-${date.getFullYear()}`;
};

const appointment = () => ({
  id: 42,
  pacienteId: 7,
  nomePaciente: "Paciente Teste",
  dataAgendamento: futureDate(),
  horaAgendamento: "10:30:00",
  telefoneComDDI: "+5511999990000",
  statusMarcacao: "AGENDADO",
  profissional: { id: 3, nome: "Profissional Teste" }
});

const mockSyncState = (status: "BASELINING" | "ACTIVE") => {
  const state = {
    status,
    baselineCompletedAt: status === "ACTIVE" ? new Date() : null,
    update: jest.fn().mockResolvedValue(undefined)
  };
  (QuarkSyncState.findOrCreate as jest.Mock).mockResolvedValue([state, false]);
  (QuarkSyncState.update as jest.Mock).mockResolvedValue([1]);
  (QuarkSyncState.findByPk as jest.Mock).mockResolvedValue(state);
  return state;
};

describe("SyncQuarkAppointmentsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createQuarkNotificationOnce as jest.Mock).mockResolvedValue(true);
    (QuarkAppointmentRecipient.update as jest.Mock).mockResolvedValue([0]);
    (QuarkAppointmentNotification.update as jest.Mock).mockResolvedValue([0]);
    (QuarkAppointmentRecipient.findOrCreate as jest.Mock).mockResolvedValue([
      { update: jest.fn().mockResolvedValue(undefined) },
      true
    ]);
  });

  it("imports the initial two-sweep baseline without creating an outbound message", async () => {
    const state = mockSyncState("BASELINING");
    (listQuarkAppointments as jest.Mock).mockResolvedValue([appointment()]);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([]);
    (QuarkAppointment.findOrCreate as jest.Mock)
      .mockResolvedValueOnce([{}, true])
      .mockResolvedValueOnce([{}, false]);

    await SyncQuarkAppointmentsService(config);

    expect(listQuarkAppointments).toHaveBeenCalledTimes(2);
    expect(QuarkAppointment.findOrCreate).toHaveBeenCalledTimes(2);
    expect(createQuarkNotificationOnce).not.toHaveBeenCalled();
    expect(state.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ACTIVE" })
    );
  });

  it("does not contact a patient when a distant appointment first appears after baseline", async () => {
    mockSyncState("ACTIVE");
    (listQuarkAppointments as jest.Mock).mockResolvedValue([appointment()]);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([]);
    (QuarkAppointment.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);

    await SyncQuarkAppointmentsService(config);

    expect(createQuarkNotificationOnce).not.toHaveBeenCalled();
  });

  it("records a distant reschedule without contacting the patient", async () => {
    mockSyncState("ACTIVE");
    const currentDto = appointment();
    const currentSnapshot = buildAppointmentSnapshot(currentDto, config);
    const record = {
      appointmentId: "42",
      status: "AGENDADO",
      phone: currentSnapshot.phone,
      phones: JSON.stringify(currentSnapshot.phones.map(item => item.phone)),
      scheduleFingerprint: "old-schedule-fingerprint",
      snapshotFingerprint: "old-snapshot-fingerprint",
      baselineImported: true,
      firstSeenAt: new Date(),
      lastChangedAt: new Date(),
      awaitingConfirmation: false,
      confirmationRequestedAt: null,
      update: jest.fn().mockResolvedValue(undefined)
    };
    (listQuarkAppointments as jest.Mock).mockResolvedValue([currentDto]);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([record]);

    await SyncQuarkAppointmentsService(config);

    expect(listQuarkAppointments).toHaveBeenCalledTimes(1);
    expect(createQuarkNotificationOnce).not.toHaveBeenCalled();
    expect(QuarkAppointmentNotification.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "SUPPRESSED" }),
      expect.objectContaining({
        where: expect.objectContaining({ appointmentId: "42" })
      })
    );
    expect(record.update).toHaveBeenCalledTimes(1);
  });
});
