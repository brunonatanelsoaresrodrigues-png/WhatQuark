import {
  AppointmentSnapshot,
  appointmentCanBeConfirmed
} from "./appointmentUtils";
import { QuarkConfig } from "./config";

export interface DueReminder {
  hours: number;
  mondayAdvance: boolean;
  sendOnlyOnWeekday?: number;
}

const localDateParts = (
  value: Date,
  timezone: string
): { year: number; month: number; day: number; weekday: number } => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  });
  const parts = formatter.formatToParts(value);
  const part = (type: string): string =>
    parts.find(item => item.type === type)?.value || "";
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  return {
    year: Number(part("year")),
    month: Number(part("month")),
    day: Number(part("day")),
    weekday: weekdays[part("weekday")]
  };
};

const calendarDaysBetween = (
  start: Date,
  end: Date,
  timezone: string
): number => {
  const from = localDateParts(start, timezone);
  const to = localDateParts(end, timezone);
  const fromUtc = Date.UTC(from.year, from.month - 1, from.day);
  const toUtc = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toUtc - fromUtc) / (24 * 60 * 60 * 1000));
};

export const weekdayInTimezone = (value: Date, timezone: string): number =>
  localDateParts(value, timezone).weekday;

export const dueReminder = (
  config: QuarkConfig,
  snapshot: AppointmentSnapshot,
  now = new Date()
): DueReminder | undefined => {
  if (!snapshot.scheduledAt || !appointmentCanBeConfirmed(snapshot.status)) {
    return undefined;
  }

  const minutesUntil =
    (snapshot.scheduledAt.getTime() - now.getTime()) / (60 * 1000);
  if (minutesUntil <= 0) return undefined;

  const appointmentWeekday = weekdayInTimezone(
    snapshot.scheduledAt,
    config.timezone
  );
  const currentWeekday = weekdayInTimezone(now, config.timezone);

  for (const hours of config.reminderHours) {
    if (hours === 24 && appointmentWeekday === 1) {
      const isPreviousFriday =
        currentWeekday === 5 &&
        calendarDaysBetween(now, snapshot.scheduledAt, config.timezone) === 3;

      if (isPreviousFriday) {
        return { hours, mondayAdvance: true, sendOnlyOnWeekday: 5 };
      }

      // Consultas de segunda nunca geram o lembrete principal no domingo.
      continue;
    }

    if (minutesUntil <= hours * 60) {
      return { hours, mondayAdvance: false };
    }
  }

  return undefined;
};
