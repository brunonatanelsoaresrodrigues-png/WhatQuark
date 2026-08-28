export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
}

export const zonedParts = (date: Date, timezone: string): ZonedParts => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short"
  });
  const values = formatter
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {});
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    weekday: values.weekday
  };
};

export const localDateKey = (date: Date, timezone: string): string => {
  const value = zonedParts(date, timezone);
  return `${value.year}-${String(value.month).padStart(2, "0")}-${String(
    value.day
  ).padStart(2, "0")}`;
};

export const zonedDateToUtc = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string
): Date => {
  const desiredUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let candidate = new Date(desiredUtc);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = zonedParts(candidate, timezone);
    const represented = Date.UTC(
      current.year,
      current.month - 1,
      current.day,
      current.hour,
      current.minute,
      current.second
    );
    candidate = new Date(candidate.getTime() + desiredUtc - represented);
  }
  return candidate;
};

const addLocalDays = (
  year: number,
  month: number,
  day: number,
  days: number
) => {
  const value = new Date(Date.UTC(year, month - 1, day + days, 12));
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate()
  };
};

export const reportWindowFor = (
  now: Date,
  timezone: string,
  reportTime: string
) => {
  const current = zonedParts(now, timezone);
  const [hour, minute] = reportTime.split(":").map(Number);
  const previous = addLocalDays(current.year, current.month, current.day, -1);
  const tomorrow = addLocalDays(current.year, current.month, current.day, 1);
  const dayAfterTomorrow = addLocalDays(
    current.year,
    current.month,
    current.day,
    2
  );
  return {
    reportDate: localDateKey(now, timezone),
    periodStart: zonedDateToUtc(
      previous.year,
      previous.month,
      previous.day,
      hour,
      minute,
      timezone
    ),
    periodEnd: zonedDateToUtc(
      current.year,
      current.month,
      current.day,
      hour,
      minute,
      timezone
    ),
    tomorrowStart: zonedDateToUtc(
      tomorrow.year,
      tomorrow.month,
      tomorrow.day,
      0,
      0,
      timezone
    ),
    tomorrowEnd: zonedDateToUtc(
      dayAfterTomorrow.year,
      dayAfterTomorrow.month,
      dayAfterTomorrow.day,
      0,
      0,
      timezone
    ),
    due:
      current.hour > hour ||
      (current.hour === hour && current.minute >= minute),
    weekend: current.weekday === "Sat" || current.weekday === "Sun"
  };
};
