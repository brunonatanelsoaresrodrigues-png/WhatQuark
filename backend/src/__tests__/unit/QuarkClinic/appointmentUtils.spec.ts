import {
  buildAppointmentSnapshot,
  normalizeQuarkPhone,
  parseConfirmationChoice,
  parseConfirmationReply,
  parseQuarkScheduledAt,
  selectQuarkPhones
} from "../../../services/QuarkClinicServices/appointmentUtils";
import { QuarkConfig } from "../../../services/QuarkClinicServices/config";

const config: QuarkConfig = {
  baseUrl: "https://api.example.test",
  authToken: "test-token",
  xChaveKey: "test-key",
  xSecretKey: "test-secret",
  pollIntervalMs: 60000,
  startupDelayMs: 20000,
  defaultCountryCode: "55",
  cancelReason: "test",
  reminderHours: [2, 24],
  sendIntervalMinMs: 10000,
  sendIntervalMaxMs: 25000,
  syncHorizonDays: 365,
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
  clinicAddress: "",
  dryRun: true,
  testAllowlist: []
};

describe("QuarkClinic appointment helpers", () => {
  it("adds the configured DDI to a Brazilian local number", () => {
    expect(normalizeQuarkPhone("(11) 98765-4321", "55")).toBe("5511987654321");
  });

  it("keeps a number returned by a ComDDI field", () => {
    expect(normalizeQuarkPhone("+55 11 98765-4321", "55", true)).toBe(
      "5511987654321"
    );
  });

  it("returns the main and alternate Quark phones without duplicates", () => {
    expect(
      selectQuarkPhones(
        {
          id: 42,
          telefoneComDDI: "+55 85 99999-0000",
          telefoneOutro: "(85) 98888-0000"
        },
        config
      )
    ).toEqual([
      {
        phone: "5585999990000",
        source: "telefoneComDDI",
        isPrimary: true
      },
      {
        phone: "5585988880000",
        source: "telefoneOutro",
        isPrimary: false
      }
    ]);

    expect(
      selectQuarkPhones(
        {
          id: 42,
          telefoneComDDI: "+55 85 99999-0000",
          telefoneOutroComDDI: "+55 85 99999-0000"
        },
        config
      )
    ).toHaveLength(1);
  });

  it("combines the Quark date and time without changing the local hour", () => {
    const parsed = parseQuarkScheduledAt(
      "20-08-2026",
      "2026-08-20T14:35:00.000Z"
    );

    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(7);
    expect(parsed?.getDate()).toBe(20);
    expect(parsed?.getHours()).toBe(14);
    expect(parsed?.getMinutes()).toBe(35);
  });

  it("accepts numeric choices and the confirmation button label", () => {
    expect(parseConfirmationChoice("1")).toBe(1);
    expect(parseConfirmationChoice("2 - cancelar")).toBe(2);
    expect(parseConfirmationChoice("12")).toBeNull();
    expect(parseConfirmationChoice("confirmar")).toBe(1);
  });

  it("accepts unambiguous SIM and NÃO replies with an optional appointment number", () => {
    expect(parseConfirmationReply("SIM")).toEqual({ choice: 1 });
    expect(parseConfirmationReply("Sim, confirmo")).toEqual({ choice: 1 });
    expect(parseConfirmationReply("NÃO")).toEqual({ choice: 2 });
    expect(parseConfirmationReply("Confirmar consulta")).toEqual({
      choice: 1
    });
    expect(parseConfirmationReply("Confirmo")).toEqual({ choice: 1 });
    expect(parseConfirmationReply("Comfirmo")).toEqual({ choice: 1 });
    expect(parseConfirmationReply("Cancelar consulta")).toEqual({
      choice: 2
    });
    expect(parseConfirmationReply("nao 2")).toEqual({
      choice: 2,
      appointmentOption: 2
    });
    expect(parseConfirmationReply("acho que sim")).toBeNull();
    expect(parseConfirmationReply("talvez não")).toBeNull();
  });

  it("changes the schedule fingerprint when an old appointment is moved", () => {
    const original = buildAppointmentSnapshot(
      {
        id: 42,
        pacienteId: 7,
        nomePaciente: "Maria da Silva",
        dataAgendamento: "20-08-2026",
        horaAgendamento: "09:00:00",
        telefoneComDDI: "+5511987654321",
        statusMarcacao: "AGENDADO",
        profissional: { id: 3, nome: "Dra. Ana" }
      },
      config
    );
    const moved = buildAppointmentSnapshot(
      {
        ...original.raw,
        dataAgendamento: "21-08-2026",
        horaAgendamento: "10:30:00"
      },
      config
    );

    expect(moved.scheduleFingerprint).not.toBe(original.scheduleFingerprint);
    expect(moved.phone).toBe("5511987654321");
  });
});
