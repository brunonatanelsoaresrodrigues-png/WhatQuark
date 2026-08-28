import { readState } from "../../../services/MessagingServices/state";
import { getPreference } from "../../../services/MessagingServices/preferences";
import QuarkAppointment from "../../../models/QuarkAppointment";
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
    findOne: jest.fn(),
    create: jest.fn(),
    findOrCreate: jest.fn()
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

jest.mock("../../../database", () => ({
  __esModule: true,
  default: { transaction: jest.fn((fn: Function) => fn({})) }
}));
jest.mock("../../../services/MessagingServices/state", () => ({
  withLease: (_: string, fn: Function) => fn(),
  readState: jest.fn((_: string, fallback: any) => Promise.resolve(fallback)),
  writeState: jest.fn()
}));
jest.mock("../../../services/MessagingServices/preferences", () => ({
  getPreference: jest.fn().mockResolvedValue({ consent: "GRANTED" })
}));
jest.mock("../../../services/QuarkClinicServices/dashboardEvents", () => ({
  emitQuarkDashboardUpdate: jest.fn()
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
    fingerprintVersion: 4,
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
    (readState as jest.Mock).mockImplementation((_: string, fallback: any) =>
      Promise.resolve(fallback)
    );
    (getPreference as jest.Mock).mockResolvedValue({ consent: "GRANTED" });
    (createQuarkNotificationOnce as jest.Mock).mockResolvedValue(true);
    (QuarkAppointmentRecipient.update as jest.Mock).mockResolvedValue([0]);
    (QuarkAppointmentRecipient.findOrCreate as jest.Mock).mockResolvedValue([
      { update: jest.fn().mockResolvedValue(undefined) },
      true
    ]);
  });

  it("imports the initial two-sweep baseline without creating an outbound message", async () => {
    const state = mockSyncState("BASELINING");
    (listQuarkAppointments as jest.Mock).mockResolvedValue([appointment()]);
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue(null);
    (QuarkAppointment.findOrCreate as jest.Mock)
      .mockResolvedValueOnce([{}, true])
      .mockResolvedValueOnce([{}, false]);

    await SyncQuarkAppointmentsService(config);

    expect(listQuarkAppointments).toHaveBeenCalledTimes(2);
    expect(QuarkAppointment.create).toHaveBeenCalledTimes(2);
    expect(createQuarkNotificationOnce).not.toHaveBeenCalled();
    expect(QuarkSyncState.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ACTIVE" }),
      expect.anything()
    );
  });

  it("creates one reschedule outbox when an appointment from the baseline changes", async () => {
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
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue(record);

    await SyncQuarkAppointmentsService(config);

    expect(listQuarkAppointments).toHaveBeenCalledTimes(1);
    expect(createQuarkNotificationOnce).toHaveBeenCalledTimes(1);
    expect(createQuarkNotificationOnce).toHaveBeenCalledWith(
      "42",
      expect.stringMatching(/^changed:.*:to:[a-f0-9]{16}$/),
      "RESCHEDULED",
      expect.objectContaining({ phone: "5511999990000" }),
      "PENDING",
      expect.anything()
    );
    expect(record.update).toHaveBeenCalledTimes(1);
  });
  it("preserves awaiting confirmation on an unchanged polling snapshot", async () => {
    mockSyncState("ACTIVE");
    const dto = appointment();
    const snapshot = buildAppointmentSnapshot(dto, config);
    const record = {
      ...snapshot,
      awaitingConfirmation: true,
      confirmationRequestedAt: new Date(),
      update: jest.fn()
    };
    (listQuarkAppointments as jest.Mock).mockResolvedValue([dto]);
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue(record);
    await SyncQuarkAppointmentsService(config);
    expect(record.update).toHaveBeenCalled();
    expect(record.update.mock.calls[0][0]).not.toHaveProperty(
      "awaitingConfirmation"
    );
  });
  it("does not overwrite an unresolved remote mutation during polling", async () => {
    mockSyncState("ACTIVE");
    const dto = appointment();
    const record = {
      ...buildAppointmentSnapshot(dto, config),
      update: jest.fn()
    };
    (listQuarkAppointments as jest.Mock).mockResolvedValue([dto]);
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue(record);
    (readState as jest.Mock).mockImplementation((key: string, fallback: any) =>
      Promise.resolve(
        key.startsWith("quark-operation:") ? { status: "UNKNOWN" } : fallback
      )
    );
    await SyncQuarkAppointmentsService(config);
    expect(record.update).not.toHaveBeenCalled();
    expect(createQuarkNotificationOnce).not.toHaveBeenCalled();
  });
  it("suppresses unsolicited notices and queues only the primary recipient", async () => {
    mockSyncState("ACTIVE");
    const dto = { ...appointment(), telefoneOutroComDDI: "5511999992222" };
    (listQuarkAppointments as jest.Mock).mockResolvedValue([dto]);
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue(null);
    (getPreference as jest.Mock).mockResolvedValue({ consent: "UNKNOWN" });
    await SyncQuarkAppointmentsService(config);
    expect(createQuarkNotificationOnce).toHaveBeenCalledTimes(1);
    expect(createQuarkNotificationOnce).toHaveBeenCalledWith(
      "42",
      expect.any(String),
      "CREATED",
      expect.objectContaining({ phone: "5511999990000" }),
      "SUPPRESSED",
      expect.anything()
    );
  });
});
