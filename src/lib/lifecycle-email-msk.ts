/** Календарные дни между двумя датами в часовом поясе Europe/Moscow. */
export function calendarDaysSinceMsk(from: Date, to: Date = new Date()): number {
  const dayKey = (d: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const y = parts.find((p) => p.type === "year")!.value;
    const m = parts.find((p) => p.type === "month")!.value;
    const day = parts.find((p) => p.type === "day")!.value;
    return `${y}-${m}-${day}`;
  };
  const fromKey = dayKey(from);
  const toKey = dayKey(to);
  const fromMs = Date.parse(`${fromKey}T00:00:00Z`);
  const toMs = Date.parse(`${toKey}T00:00:00Z`);
  return Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000));
}
