export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;

/** `?limit=`: по умолчанию 50, максимум 200; `null` — некорректное значение. */
export function parseLimit(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return DEFAULT_PAGE_LIMIT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_PAGE_LIMIT) return null;
  return n;
}

/** Дата из query: ISO 8601 или `YYYY-MM-DD`; `null` — некорректная, `undefined` — не задана. */
export function parseDateParam(raw: string | null): Date | null | undefined {
  if (raw === null || raw.trim() === "") return undefined;
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}
