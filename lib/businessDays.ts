const frenchDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function localFrenchDate(value: Date): string {
  const parts = frenchDateFormatter.formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("FRENCH_DATE_UNAVAILABLE");
  return `${year}-${month}-${day}`;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function frenchPublicHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  const offset = (days: number) => {
    const date = new Date(easter);
    date.setUTCDate(date.getUTCDate() + days);
    return dateKey(date);
  };
  return new Set([
    `${year}-01-01`,
    `${year}-05-01`,
    `${year}-05-08`,
    `${year}-07-14`,
    `${year}-08-15`,
    `${year}-11-01`,
    `${year}-11-11`,
    `${year}-12-25`,
    offset(1),
    offset(39),
    offset(50),
  ]);
}

export function isFrenchBusinessDay(value: Date): boolean {
  if (Number.isNaN(value.getTime())) throw new Error("INVALID_DATE");
  const localDate = localFrenchDate(value);
  const calendarDate = new Date(`${localDate}T00:00:00.000Z`);
  const weekday = calendarDate.getUTCDay();
  return (
    weekday !== 0 &&
    weekday !== 6 &&
    !frenchPublicHolidays(calendarDate.getUTCFullYear()).has(localDate)
  );
}

export function addFrenchBusinessDays(
  value: Date,
  businessDays: number,
): string {
  if (
    Number.isNaN(value.getTime()) ||
    !Number.isInteger(businessDays) ||
    businessDays < 1 ||
    businessDays > 30
  )
    throw new Error("INVALID_PREPARATION_DEADLINE_INPUT");
  const [year, month, day] = localFrenchDate(value)
    .split("-")
    .map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  let counted = 0;
  while (counted < businessDays) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isFrenchBusinessDay(cursor)) counted += 1;
  }
  return dateKey(cursor);
}
