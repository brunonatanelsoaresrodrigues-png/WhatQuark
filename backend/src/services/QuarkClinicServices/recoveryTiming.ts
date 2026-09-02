import { dateParts, zonedDate } from "./clinicTime";

const weekday = (value: Date, timezone: string): number => {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short"
  }).format(value);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(label);
};

export const noShowInitialAttemptAt = (now = new Date()): Date =>
  new Date(now.getTime() + 30 * 60 * 1000);

export const nextBusinessFollowUpAt = (
  now = new Date(),
  timezone = "America/Sao_Paulo"
): Date => {
  const current = dateParts(now, timezone);
  for (let offset = 1; offset <= 4; offset += 1) {
    const calendar = new Date(
      Date.UTC(current.year, current.month - 1, current.day + offset)
    );
    const candidate = zonedDate(
      calendar.getUTCFullYear(),
      calendar.getUTCMonth() + 1,
      calendar.getUTCDate(),
      9,
      0,
      0,
      timezone
    );
    if (candidate && ![0, 6].includes(weekday(candidate, timezone))) {
      return candidate;
    }
  }
  throw new Error("Could not calculate the next business follow-up");
};
