/**
 * Ссылки на площадки отзывов (Яндекс / 2GIS / Авито / свои) уходят гостю в
 * `location.assign` и `href`, поэтому храним только http(s): `javascript:` и
 * прочие схемы выполнялись бы на origin кабинета (stored XSS).
 * Без зависимостей — используется и в API, и в клиентских модулях.
 */

/** http(s)-ссылка или null. Голое `2gis.ru/…` дополняется до https. */
export function toSafeHttpUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2000 || trimmed.startsWith("/")) return null;
  const href = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname) return null;
    return url.href;
  } catch {
    return null;
  }
}

export const PLATFORM_URL_INVALID_ERROR = "Ссылка на площадку должна начинаться с http:// или https://";

/**
 * Поле ссылки из формы: `undefined` — не трогать, `null` — очистить,
 * строка — сохранить, `{ error }` — отклонить запрос.
 */
export function parsePlatformUrlField(
  raw: unknown,
): string | null | undefined | { error: string } {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "string") return { error: PLATFORM_URL_INVALID_ERROR };
  if (!raw.trim()) return null;
  const safe = toSafeHttpUrl(raw);
  return safe ?? { error: PLATFORM_URL_INVALID_ERROR };
}

export function isPlatformUrlError(v: unknown): v is { error: string } {
  return typeof v === "object" && v !== null && "error" in v;
}
