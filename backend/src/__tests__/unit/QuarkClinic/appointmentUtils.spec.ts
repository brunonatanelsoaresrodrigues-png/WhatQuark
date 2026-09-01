import {
  buildAppointmentSnapshot,
  normalizeQuarkPhone,
  parseConfirmationChoice,
  parseConfirmationReply,
  parseQuarkScheduledAt,
  quarkPatientIdFrom,
  quarkPhoneVariants,
  selectQuarkPhones,
  quarkCpfFrom
} from "../../../services/QuarkClinicServices/appointmentUtils";
import { QuarkConfig } from "../../../services/QuarkClinicServices/config";

it("extracts and validates CPF fields returned by Quark", () => {
  expect(quarkCpfFrom({ id: 1, cpf: "529.982.247-25" })).toBe("52998224725");
  expect(quarkCpfFrom({ id: 1, paciente: { cpf: "11111111111" } })).toBeNull();
});

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
  syncLookbackDays: 365,
  requestTimeoutMs: 15000,
  maxMessagesPerHour: 100,
  quietHoursStart: "20:00",
  quietHoursEnd: "08:00",
  maxRetryAttempts: 5,
  processingTimeoutMs: 600000,
  workerPollIntervalMs: 5000,
  timezone: "America/Sao_Paulo",
  clinicAddress: "",
  dryRun: true,
  testAllowlist: []
};

describe("QuarkClinic appointment helpers", () => {
  it("keeps opaque patient ids and rejects legacy null-like values", () => {
    expect(quarkPatientIdFrom("ABC_123-xyz")).toBe("ABC_123-xyz");
    expect(quarkPatientIdFrom(" null ")).toBeNull();
    expect(quarkPatientIdFrom("undefined")).toBeNull();
    expect(quarkPatientIdFrom(null)).toBeNull();
  });

  it("adds the configured DDI to a Brazilian local number", () => {
    expect(normalizeQuarkPhone("(11) 98765-4321", "55")).toBe("5511987654321");
  });

  it("keeps a number returned by a ComDDI field", () => {
    expect(normalizeQuarkPhone("+55 11 98765-4321", "55", true)).toBe(
      "5511987654321"
    );
  });

  it("matches Brazilian mobile phones with or without the ninth digit", () => {
    expect(quarkPhoneVariants("+55 (85) 9241-3638")).toEqual([
      "558592413638",
      "5585992413638"
    ]);
    expect(quarkPhoneVariants("5585992413638")).toEqual([
      "5585992413638",
      "558592413638"
    ]);
  });

  it("does not add a ninth digit to a Brazilian landline", () => {
    expect(quarkPhoneVariants("+55 (85) 3241-3638")).toEqual([
      "558532413638"
    ]);
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
    expect(parsed?.toISOString()).toBe("2026-08-20T17:35:00.000Z");
  });
  it.each([
    "1",
    "2 - cancelar",
    "2 pessoas",
    "12",
    "confirmar",
    "Sim, preciso remarcar",
    "Não quero cancelar",
    "Não sei o endereço",
    "nao 2",
    "Sim, confirmo"
  ])("does not turn ambiguous text %s into an action", body => {
    expect(parseConfirmationReply(body)).toBeNull();
  });
  it("parses explicit reference commands and exact legacy answers", () => {
    expect(parseConfirmationReply("SIM")).toEqual({ choice: 1 });
    expect(parseConfirmationReply("NÃO")).toEqual({ choice: 2 });
    expect(parseConfirmationReply("CONFIRMAR AB12CD34")).toMatchObject({
      choice: 1,
      appointmentReference: "AB12CD34"
    });
    expect(
      parseConfirmationReply("CONFIRMO CANCELAMENTO AB12CD34")
    ).toMatchObject({ choice: 2, confirmedCancellation: true });
    expect(parseQuarkScheduledAt("31-02-2026", "10:00")).toBeNull();
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
