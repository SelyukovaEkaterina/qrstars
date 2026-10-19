/** YYYY-MM-DD в часовом поясе Europe/Moscow. */
export function mskDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${day}`;
}

/** Полночь текущего дня МСК. */
export function startOfMskDay(date: Date): Date {
  return new Date(`${mskDateKey(date)}T00:00:00+03:00`);
}

/** Календарные дни между двумя датами в часовом поясе Europe/Moscow. */
export function calendarDaysSinceMsk(from: Date, to: Date = new Date()): number {
  const fromKey = mskDateKey(from);
  const toKey = mskDateKey(to);
  const fromMs = Date.parse(`${fromKey}T00:00:00Z`);
  const toMs = Date.parse(`${toKey}T00:00:00Z`);
  return Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000));
}

/** «25 октября» в часовом поясе Europe/Moscow. */
export function formatMskDayMonth(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "numeric",
    month: "long",
  }).format(date);
}
