const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /\+?\d[\d\s()-]{8,}\d/g;
const TG_RE = /(^|\s)@[A-Za-z0-9_]{4,}/g;

/** Вырезает из свободного текста email, телефоны и @ники, схлопывает пробелы и обрезает. */
export function scrubPii(text: string, limit = 300): string {
  const clean = text
    .replace(EMAIL_RE, "[email]")
    .replace(PHONE_RE, "[телефон]")
    .replace(TG_RE, "$1[ник]")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
}
