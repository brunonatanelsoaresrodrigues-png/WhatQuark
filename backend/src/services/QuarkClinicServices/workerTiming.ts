import { QuarkConfig } from "./config";

const randomBetween = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const randomSendIntervalMs = (config: QuarkConfig): number =>
  randomBetween(config.sendIntervalMinMs, config.sendIntervalMaxMs);

const timeParts = (
  date: Date,
  timezone: string
): { hour: number; minute: number } => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23"
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string): number =>
    Number(parts.find(part => part.type === type)?.value || 0);
  return { hour: get("hour") % 24, minute: get("minute") };
};

const parseTime = (value: string): number => {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
};

export const quietHoursDelayMs = (
  config: QuarkConfig,
  now = new Date()
): number => {
  const currentParts = timeParts(now, config.timezone);
  const current = currentParts.hour * 60 + currentParts.minute;
  const start = parseTime(config.quietHoursStart);
  const end = parseTime(config.quietHoursEnd);
  if (start === end) return 0;

  if (start < end) {
    return current >= start && current < end ? (end - current) * 60 * 1000 : 0;
  }

  if (current >= start) {
    return (24 * 60 - current + end) * 60 * 1000;
  }
  if (current < end) return (end - current) * 60 * 1000;
  return 0;
};
