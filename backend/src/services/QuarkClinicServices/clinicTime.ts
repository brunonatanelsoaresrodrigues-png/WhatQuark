export const clinicTimezone = () =>
  process.env.QUARK_TIMEZONE || "America/Sao_Paulo";
export const dateParts = (date: Date, timeZone = clinicTimezone()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  } as any).formatToParts(date);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second")
  };
};
export const zonedDate = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  timeZone = clinicTimezone()
): Date | null => {
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = target;
  for (let i = 0; i < 3; i += 1) {
    const p = dateParts(new Date(guess), timeZone);
    guess +=
      target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  }
  const actual = dateParts(new Date(guess), timeZone);
  return actual.year === year &&
    actual.month === month &&
    actual.day === day &&
    actual.hour === hour &&
    actual.minute === minute &&
    actual.second === second
    ? new Date(guess)
    : null;
};
export const clinicDay = (date = new Date(), offset = 0): Date => {
  const p = dateParts(date);
  const calendar = new Date(Date.UTC(p.year, p.month - 1, p.day + offset));
  const result = zonedDate(
    calendar.getUTCFullYear(),
    calendar.getUTCMonth() + 1,
    calendar.getUTCDate()
  );
  if (!result) throw new Error("Invalid clinic calendar day");
  return result;
};
