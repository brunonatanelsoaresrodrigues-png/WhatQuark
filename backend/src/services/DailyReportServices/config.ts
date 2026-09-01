const positiveInteger = (
  value: string | undefined,
  fallback: number
): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const booleanValue = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined ? fallback : value.toLowerCase() === "true";

export interface DailyReportConfig {
  enabled: boolean;
  testMode: boolean;
  reportTime: string;
  timezone: string;
  whatsappId: number | null;
  pollIntervalSeconds: number;
  sendIntervalSeconds: number;
  maxRetryAttempts: number;
  allowWeekends: boolean;
}

export const getDailyReportConfig = (): DailyReportConfig => {
  const reportTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(
    process.env.DAILY_REPORT_TIME || ""
  )
    ? String(process.env.DAILY_REPORT_TIME)
    : "17:00";
  const whatsappId = positiveInteger(process.env.DAILY_REPORT_WHATSAPP_ID, 0);

  return {
    enabled: booleanValue(process.env.DAILY_REPORT_ENABLED, false),
    testMode: booleanValue(process.env.DAILY_REPORT_TEST_MODE, true),
    reportTime,
    timezone: process.env.DAILY_REPORT_TIMEZONE || "America/Sao_Paulo",
    whatsappId: whatsappId || null,
    pollIntervalSeconds: positiveInteger(
      process.env.DAILY_REPORT_POLL_INTERVAL_SECONDS,
      30
    ),
    sendIntervalSeconds: positiveInteger(
      process.env.DAILY_REPORT_SEND_INTERVAL_SECONDS,
      20
    ),
    maxRetryAttempts: positiveInteger(
      process.env.DAILY_REPORT_MAX_RETRY_ATTEMPTS,
      5
    ),
    allowWeekends: booleanValue(process.env.DAILY_REPORT_ALLOW_WEEKENDS, true)
  };
};
