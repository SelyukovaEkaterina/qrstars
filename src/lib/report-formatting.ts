const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

export { MSK_OFFSET_MS };

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatMskDate(date: Date): string {
  const msk = new Date(date.getTime() + MSK_OFFSET_MS);
  const d = String(msk.getUTCDate()).padStart(2, "0");
  const m = String(msk.getUTCMonth() + 1).padStart(2, "0");
  const y = msk.getUTCFullYear();
  return `${d}.${m}.${y}`;
}

export function startOfMskDay(date: Date): Date {
  const msk = new Date(date.getTime() + MSK_OFFSET_MS);
  msk.setUTCHours(0, 0, 0, 0);
  return new Date(msk.getTime() - MSK_OFFSET_MS);
}

/** Строка дельты для HTML (Telegram/MAX): « · 📈 +12%» / « · 📉 -5%» / « · <i>новые</i>». */
export function deltaLine(current: number, previous: number): string {
  if (previous === 0) {
    return current > 0 ? " · <i>новые</i>" : "";
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return " · 0%";
  const sign = pct > 0 ? "+" : "";
  const emoji = pct > 0 ? "📈" : "📉";
  return ` · ${emoji} ${sign}${pct}%`;
}

export function countLine(label: string, current: number, previous: number): string {
  return `<b>${escapeHtml(label)}:</b> ${current.toLocaleString("ru-RU")}${deltaLine(current, previous)}`;
}

export function valueLine(label: string, value: number): string {
  return `<b>${escapeHtml(label)}:</b> ${value.toLocaleString("ru-RU")}`;
}

/** Числовая дельта без HTML — для email-шаблонов и логики. */
export function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export const RU_LOCALE = "ru-RU";

export function fmtRu(value: number): string {
  return value.toLocaleString(RU_LOCALE);
}

/** Названия месяцев в родительном падеже («июня»). */
const MONTH_NAMES_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export function formatMskMonthHuman(date: Date): string {
  const msk = new Date(date.getTime() + MSK_OFFSET_MS);
  const month = MONTH_NAMES_GENITIVE[msk.getUTCMonth()];
  return `${month} ${msk.getUTCFullYear()}`;
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
