export const isQuarkIntegrationEnabled = (): boolean =>
  process.env.QUARK_INTEGRATION_ENABLED === "true";

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export interface QuarkConfig {
  baseUrl: string;
  authToken: string;
  xChaveKey: string;
  xSecretKey: string;
  pollIntervalMs: number;
  startupDelayMs: number;
  defaultCountryCode: string;
  whatsappId?: number;
  cancelReason: string;
  reminderHours: number[];
  sendIntervalMinMs: number;
  sendIntervalMaxMs: number;
  syncHorizonDays: number;
  requestTimeoutMs: number;
  maxMessagesPerHour: number;
  quietHoursStart: string;
  quietHoursEnd: string;
  maxRetryAttempts: number;
  processingTimeoutMs: number;
  workerPollIntervalMs: number;
  timezone: string;
  clinicAddress: string;
  dryRun: boolean;
  testAllowlist: string[];
}

const positiveNumber = (
  value: string | undefined,
  fallback: number
): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const getQuarkConfig = (): QuarkConfig => {
  const whatsappIdValue = Number(process.env.QUARK_WHATSAPP_ID);
  const reminderSource =
    process.env.QUARK_REMINDER_HOURS === undefined
      ? "24,2"
      : process.env.QUARK_REMINDER_HOURS;
  const reminderHours = reminderSource
    .split(",")
    .map(value => Number(value.trim()))
    .filter(value => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  const sendIntervalMinMs =
    positiveNumber(process.env.QUARK_SEND_INTERVAL_MIN_SECONDS, 15) * 1000;
  const configuredMaxMs =
    positiveNumber(process.env.QUARK_SEND_INTERVAL_MAX_SECONDS, 45) * 1000;
  if (configuredMaxMs < sendIntervalMinMs) {
    throw new Error(
      "QUARK_SEND_INTERVAL_MAX_SECONDS must be greater than or equal to QUARK_SEND_INTERVAL_MIN_SECONDS"
    );
  }

  const timezone = process.env.QUARK_TIMEZONE || "America/Sao_Paulo";
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: timezone }).format(new Date());
  } catch {
    throw new Error("QUARK_TIMEZONE is invalid");
  }

  const quietHoursStart = process.env.QUARK_QUIET_HOURS_START || "20:00";
  const quietHoursEnd = process.env.QUARK_QUIET_HOURS_END || "08:00";
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(quietHoursStart) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(quietHoursEnd)
  ) {
    throw new Error("QUARK quiet hours must use the HH:mm format");
  }

  const baseUrl = (
    process.env.QUARK_API_BASE_URL || "https://api.quark.tec.br/clinic/ext"
  ).replace(/\/$/, "");
  let baseUrlProtocol: string;
  try {
    baseUrlProtocol = new URL(baseUrl).protocol;
  } catch {
    throw new Error("QUARK_API_BASE_URL is invalid");
  }
  if (process.env.NODE_ENV === "production" && baseUrlProtocol !== "https:") {
    throw new Error("QUARK_API_BASE_URL must use HTTPS in production");
  }

  return {
    baseUrl,
    authToken: required("QUARK_AUTH_TOKEN"),
    xChaveKey: required("QUARK_X_CHAVE_KEY"),
    xSecretKey: required("QUARK_X_SECRET_KEY"),
    pollIntervalMs:
      positiveNumber(process.env.QUARK_POLL_INTERVAL_SECONDS, 300) * 1000,
    startupDelayMs:
      positiveNumber(process.env.QUARK_STARTUP_DELAY_SECONDS, 20) * 1000,
    defaultCountryCode: (
      process.env.QUARK_DEFAULT_COUNTRY_CODE || "55"
    ).replace(/\D/g, ""),
    whatsappId:
      Number.isInteger(whatsappIdValue) && whatsappIdValue > 0
        ? whatsappIdValue
        : undefined,
    cancelReason:
      process.env.QUARK_CANCEL_REASON ||
      "Cancelado pelo paciente através da confirmação no WhatsApp",
    reminderHours,
    sendIntervalMinMs,
    sendIntervalMaxMs: configuredMaxMs,
    syncHorizonDays: Math.floor(
      positiveNumber(process.env.QUARK_SYNC_HORIZON_DAYS, 365)
    ),
    requestTimeoutMs: positiveNumber(
      process.env.QUARK_REQUEST_TIMEOUT_MS,
      15000
    ),
    maxMessagesPerHour: Math.floor(
      positiveNumber(process.env.QUARK_MAX_MESSAGES_PER_HOUR, 100)
    ),
    quietHoursStart,
    quietHoursEnd,
    maxRetryAttempts: Math.floor(
      positiveNumber(process.env.QUARK_MAX_RETRY_ATTEMPTS, 5)
    ),
    processingTimeoutMs:
      positiveNumber(process.env.QUARK_PROCESSING_TIMEOUT_MINUTES, 10) *
      60 *
      1000,
    workerPollIntervalMs:
      positiveNumber(process.env.QUARK_WORKER_POLL_INTERVAL_SECONDS, 5) * 1000,
    timezone,
    clinicAddress: (process.env.QUARK_CLINIC_ADDRESS || "").trim(),
    dryRun: process.env.QUARK_DRY_RUN !== "false",
    testAllowlist: (process.env.QUARK_TEST_ALLOWLIST || "")
      .split(",")
      .map(value => value.replace(/\D/g, ""))
      .filter(Boolean)
  };
};
