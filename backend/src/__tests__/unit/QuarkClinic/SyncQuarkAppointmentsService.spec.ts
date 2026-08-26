import QuarkAppointment from "../../../models/QuarkAppointment";
import QuarkAppointmentEvent from "../../../models/QuarkAppointmentEvent";
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
    findOrCreate: jest.fn(),
    count: jest.fn()
  }
}));

jest.mock("../../../models/QuarkAppointmentEvent", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn()
  }
}));

jest.mock("../../../models/QuarkAppointmentNotification", () => ({
  __esModule: true,
  default: {
    update: jest.fn(),
    findAll: jest.fn()
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
  maxRecoveryMessagesPerHour: 5,
  quietHoursStart: "20:00",
  quietHoursEnd: "08:00",
  maxRetryAttempts: 5,
  processingTimeoutMs: 600000,
  workerPollIntervalMs: 5000,
  recipientCooldownMs: 15 * 60 * 1000,
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

const appointmentWithinTwoHours = () => {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const part = (type: string): string =>
    parts.find(item => item.type === type)?.value || "";
  return {
    ...appointment(),
    dataAgendamento: `${part("day")}-${part("month")}-${part("year")}`,
    horaAgendamento: `${part("hour")}:${part("minute")}:00`
  };
};

const mockSyncState = (
  status: "BASELINING" | "ACTIVE",
  fingerprintVersion = 3
) => {
  const state = {
    status,
    fingerprintVersion,
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
    (QuarkAppointmentEvent.findAll as jest.Mock).mockResolvedValue([]);
    (QuarkAppointment.count as jest.Mock).mockResolvedValue(1);
    (QuarkAppointmentNotification.findAll as jest.Mock).mockImplementation(() =>
      (createQuarkNotificationOnce as jest.Mock).mock.calls
        .filter(call => call[4] !== "SUPPRESSED")
        .map(call => ({
          appointmentId: call[0],
          eventType: call[2],
          recipientPhone: call[3].phone,
          payload: JSON.stringify(call[3]),
          status: call[4]
        }))
    );
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

  it("queues an immediate, idempotent confirmation when a distant appointment first appears after baseline", async () => {
    mockSyncState("ACTIVE");
    const currentDto = appointment();
    const currentSnapshot = buildAppointmentSnapshot(currentDto, config);
    (listQuarkAppointments as jest.Mock).mockResolvedValue([currentDto]);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([]);
    (QuarkAppointment.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);

    await SyncQuarkAppointmentsService(config);

    expect(createQuarkNotificationOnce).toHaveBeenCalledTimes(1);
    expect(createQuarkNotificationOnce).toHaveBeenCalledWith(
      "42",
      expect.stringMatching(/^created:[a-f0-9]{24}:to:[a-f0-9]{16}$/),
      "CREATED",
      expect.objectContaining({
        phone: "5511999990000",
        patientName: "Paciente Teste",
        body: expect.stringContaining("SIM para confirmar"),
        requestsConfirmation: true,
        validUntil: currentSnapshot.scheduledAt?.toISOString()
      }),
      "PENDING"
    );
  });

  it("repairs an appointment missed by the old pagination without using the normal new-booking blast", async () => {
    const state = mockSyncState("ACTIVE", 2);
    const currentDto = appointment();
    (listQuarkAppointments as jest.Mock).mockResolvedValue([currentDto]);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([]);
    (QuarkAppointment.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);

    await SyncQuarkAppointmentsService(config);

    expect(createQuarkNotificationOnce).toHaveBeenCalledTimes(1);
    expect(createQuarkNotificationOnce).toHaveBeenCalledWith(
      "42",
      expect.stringMatching(
        /^coverage-recovery:3:[a-f0-9]{24}:to:[a-f0-9]{16}$/
      ),
      "COVERAGE_RECOVERY",
      expect.objectContaining({
        body: expect.stringContaining("Confirmação do seu agendamento"),
        requestsConfirmation: true
      }),
      "PENDING"
    );
    expect(state.update).toHaveBeenCalledWith(
      expect.objectContaining({ fingerprintVersion: 3 })
    );
  });

  it("does not reset an awaiting confirmation while repairing coverage", async () => {
    mockSyncState("ACTIVE", 2);
    const currentDto = appointment();
    const currentSnapshot = buildAppointmentSnapshot(currentDto, config);
    const record = {
      appointmentId: "42",
      status: "AGENDADO",
      phone: currentSnapshot.phone,
      phones: JSON.stringify(currentSnapshot.phones.map(item => item.phone)),
      scheduleFingerprint: currentSnapshot.scheduleFingerprint,
      snapshotFingerprint: currentSnapshot.snapshotFingerprint,
      baselineImported: true,
      fingerprintVersion: 2,
      firstSeenAt: new Date(),
      lastChangedAt: new Date(),
      awaitingConfirmation: true,
      confirmationRequestedAt: new Date(),
      update: jest.fn().mockResolvedValue(undefined)
    };
    (listQuarkAppointments as jest.Mock).mockResolvedValue([currentDto]);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([record]);

    await SyncQuarkAppointmentsService(config);

    expect(record.update).toHaveBeenCalledWith(
      expect.objectContaining({ awaitingConfirmation: true })
    );
  });

  it("does not mark a synchronization successful when a fetched appointment was not persisted", async () => {
    const state = mockSyncState("ACTIVE");
    (listQuarkAppointments as jest.Mock).mockResolvedValue([appointment()]);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([]);
    (QuarkAppointment.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);
    (QuarkAppointment.count as jest.Mock).mockResolvedValue(0);

    await expect(SyncQuarkAppointmentsService(config)).rejects.toThrow(
      "persistence coverage mismatch"
    );
    expect(state.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ lastSuccessfulSyncAt: expect.any(Date) })
    );
  });

  it("requeues an old recoverable dead letter instead of silently losing the appointment", async () => {
    mockSyncState("ACTIVE");
    const currentDto = appointment();
    const currentSnapshot = buildAppointmentSnapshot(currentDto, config);
    const record = {
      appointmentId: "42",
      status: "AGENDADO",
      phone: currentSnapshot.phone,
      phones: JSON.stringify(currentSnapshot.phones.map(item => item.phone)),
      scheduleFingerprint: currentSnapshot.scheduleFingerprint,
      snapshotFingerprint: currentSnapshot.snapshotFingerprint,
      baselineImported: true,
      fingerprintVersion: 3,
      firstSeenAt: new Date(),
      lastChangedAt: new Date(),
      awaitingConfirmation: false,
      confirmationRequestedAt: null,
      update: jest.fn().mockResolvedValue(undefined)
    };
    const deadLetter = {
      appointmentId: "42",
      notificationKey: `coverage-recovery:3:${currentSnapshot.scheduleFingerprint.slice(
        0,
        24
      )}:to:164524c44cb9901e`,
      eventType: "CREATED",
      recipientPhone: currentSnapshot.phone,
      payload: JSON.stringify({
        phone: currentSnapshot.phone,
        patientName: currentSnapshot.patientName,
        body: "Confirme",
        requestsConfirmation: true,
        validUntil: currentSnapshot.scheduledAt?.toISOString()
      }),
      status: "DEAD_LETTER",
      lastError: "Configured WhatsApp was temporarily unavailable",
      updatedAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
      update: jest.fn().mockResolvedValue(undefined)
    };
    (listQuarkAppointments as jest.Mock).mockResolvedValue([currentDto]);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([record]);
    (QuarkAppointmentNotification.findAll as jest.Mock).mockResolvedValue([
      deadLetter
    ]);
    (createQuarkNotificationOnce as jest.Mock).mockResolvedValue(false);

    await SyncQuarkAppointmentsService(config);

    expect(deadLetter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "FAILED_RETRY",
        attempts: 0,
        nextAttemptAt: expect.any(Date)
      })
    );
  });

  it("suppresses the simultaneous reminder when a new appointment is already within two hours", async () => {
    mockSyncState("ACTIVE");
    const currentDto = appointmentWithinTwoHours();
    const reminderConfig = { ...config, reminderHours: [2, 24] };
    (listQuarkAppointments as jest.Mock).mockResolvedValue([currentDto]);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([]);
    (QuarkAppointment.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);

    await SyncQuarkAppointmentsService(reminderConfig);

    expect(createQuarkNotificationOnce).toHaveBeenCalledTimes(2);
    expect(createQuarkNotificationOnce).toHaveBeenNthCalledWith(
      1,
      "42",
      expect.stringMatching(/^reminder:2:[a-f0-9]{24}:to:[a-f0-9]{16}$/),
      "REMINDER",
      expect.any(Object),
      "SUPPRESSED"
    );
    expect(createQuarkNotificationOnce).toHaveBeenNthCalledWith(
      2,
      "42",
      expect.stringMatching(/^created:[a-f0-9]{24}:to:[a-f0-9]{16}$/),
      "CREATED",
      expect.any(Object),
      "PENDING"
    );
  });

  it("queues an immediate, idempotent message for a distant reschedule", async () => {
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
    expect(createQuarkNotificationOnce).toHaveBeenCalledTimes(1);
    expect(createQuarkNotificationOnce).toHaveBeenCalledWith(
      "42",
      expect.stringMatching(/^rescheduled:[a-f0-9]{24}:to:[a-f0-9]{16}$/),
      "RESCHEDULED",
      expect.objectContaining({
        phone: "5511999990000",
        patientName: "Paciente Teste",
        body: expect.stringContaining("Aviso de alteração de agendamento"),
        requestsConfirmation: true,
        validUntil: currentSnapshot.scheduledAt?.toISOString()
      }),
      "PENDING"
    );
    expect(QuarkAppointmentNotification.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "SUPPRESSED" }),
      expect.objectContaining({
        where: expect.objectContaining({ appointmentId: "42" })
      })
    );
    expect(record.update).toHaveBeenCalledTimes(1);
  });

  it("suppresses pending reminders and queues one message when an existing appointment is cancelled", async () => {
    mockSyncState("ACTIVE");
    const currentDto = { ...appointment(), statusMarcacao: "CANCELADO" };
    const currentSnapshot = buildAppointmentSnapshot(currentDto, config);
    const record = {
      appointmentId: "42",
      status: "AGENDADO",
      phone: currentSnapshot.phone,
      phones: JSON.stringify(currentSnapshot.phones.map(item => item.phone)),
      scheduleFingerprint: currentSnapshot.scheduleFingerprint,
      snapshotFingerprint: "old-active-snapshot",
      baselineImported: false,
      fingerprintVersion: 3,
      firstSeenAt: new Date(),
      lastChangedAt: new Date(),
      awaitingConfirmation: true,
      confirmationRequestedAt: new Date(),
      update: jest.fn().mockResolvedValue(undefined)
    };
    (listQuarkAppointments as jest.Mock).mockResolvedValue([currentDto]);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([record]);

    await SyncQuarkAppointmentsService(config);

    expect(QuarkAppointmentNotification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "SUPPRESSED",
        lastError: "Appointment was cancelled before delivery"
      }),
      expect.any(Object)
    );
    expect(createQuarkNotificationOnce).toHaveBeenCalledTimes(1);
    expect(createQuarkNotificationOnce).toHaveBeenCalledWith(
      "42",
      expect.stringMatching(/^cancelled:[a-f0-9]{24}:to:[a-f0-9]{16}$/),
      "CANCELLED",
      expect.objectContaining({
        phone: "5511999990000",
        body: expect.stringContaining("Consulta cancelada"),
        requestsConfirmation: false,
        validUntil: currentSnapshot.scheduledAt?.toISOString()
      }),
      "PENDING"
    );
    expect(record.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "CANCELADO",
        awaitingConfirmation: false,
        confirmationRequestedAt: null
      })
    );
  });

  it("queues a cancellation first seen in active mode but not during baseline", async () => {
    mockSyncState("ACTIVE");
    const cancelled = { ...appointment(), statusMarcacao: "CANCELADO" };
    (listQuarkAppointments as jest.Mock).mockResolvedValue([cancelled]);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([]);
    (QuarkAppointment.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);

    await SyncQuarkAppointmentsService(config);

    expect(createQuarkNotificationOnce).toHaveBeenCalledWith(
      "42",
      expect.stringMatching(/^cancelled:/),
      "CANCELLED",
      expect.any(Object),
      "PENDING"
    );

    jest.clearAllMocks();
    (createQuarkNotificationOnce as jest.Mock).mockResolvedValue(true);
    (QuarkAppointmentRecipient.update as jest.Mock).mockResolvedValue([0]);
    (QuarkAppointment.count as jest.Mock).mockResolvedValue(1);
    (QuarkAppointmentRecipient.findOrCreate as jest.Mock).mockResolvedValue([
      { update: jest.fn().mockResolvedValue(undefined) },
      true
    ]);
    mockSyncState("BASELINING");
    (listQuarkAppointments as jest.Mock).mockResolvedValue([cancelled]);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([]);
    (QuarkAppointment.findOrCreate as jest.Mock)
      .mockResolvedValueOnce([{}, true])
      .mockResolvedValueOnce([{}, false]);

    await SyncQuarkAppointmentsService(config);

    expect(createQuarkNotificationOnce).not.toHaveBeenCalled();
  });

  it("repairs a recent external cancellation that has no notice", async () => {
    mockSyncState("ACTIVE");
    const cancelled = { ...appointment(), statusMarcacao: "CANCELADO" };
    const currentSnapshot = buildAppointmentSnapshot(cancelled, config);
    const record = {
      appointmentId: "42",
      status: "CANCELADO",
      phone: currentSnapshot.phone,
      phones: JSON.stringify(currentSnapshot.phones.map(item => item.phone)),
      scheduleFingerprint: currentSnapshot.scheduleFingerprint,
      snapshotFingerprint: currentSnapshot.snapshotFingerprint,
      baselineImported: true,
      fingerprintVersion: 3,
      firstSeenAt: new Date(),
      lastChangedAt: new Date(),
      awaitingConfirmation: false,
      confirmationRequestedAt: null,
      update: jest.fn().mockResolvedValue(undefined)
    };
    (listQuarkAppointments as jest.Mock).mockResolvedValue([cancelled]);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([record]);
    (QuarkAppointmentEvent.findAll as jest.Mock).mockResolvedValue([
      { appointmentId: "42" }
    ]);
    (QuarkAppointmentNotification.findAll as jest.Mock).mockResolvedValue([]);

    await SyncQuarkAppointmentsService(config);

    expect(createQuarkNotificationOnce).toHaveBeenCalledTimes(1);
    expect(createQuarkNotificationOnce).toHaveBeenCalledWith(
      "42",
      expect.stringMatching(/^cancelled:[a-f0-9]{24}:to:[a-f0-9]{16}$/),
      "CANCELLED",
      expect.objectContaining({
        phone: "5511999990000",
        requestsConfirmation: false
      }),
      "PENDING"
    );
  });

  it("does not duplicate a patient-requested cancellation acknowledgement", async () => {
    mockSyncState("ACTIVE");
    const cancelled = { ...appointment(), statusMarcacao: "CANCELADO" };
    const currentSnapshot = buildAppointmentSnapshot(cancelled, config);
    const record = {
      appointmentId: "42",
      status: "CANCELADO",
      phone: currentSnapshot.phone,
      phones: JSON.stringify(currentSnapshot.phones.map(item => item.phone)),
      scheduleFingerprint: currentSnapshot.scheduleFingerprint,
      snapshotFingerprint: currentSnapshot.snapshotFingerprint,
      baselineImported: true,
      fingerprintVersion: 3,
      firstSeenAt: new Date(),
      lastChangedAt: new Date(),
      awaitingConfirmation: false,
      confirmationRequestedAt: null,
      update: jest.fn().mockResolvedValue(undefined)
    };
    (listQuarkAppointments as jest.Mock).mockResolvedValue([cancelled]);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([record]);
    (QuarkAppointmentEvent.findAll as jest.Mock).mockResolvedValue([]);

    await SyncQuarkAppointmentsService(config);

    expect(createQuarkNotificationOnce).not.toHaveBeenCalled();
  });
});
