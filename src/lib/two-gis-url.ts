/**
 * Ссылка на карточку организации в 2GIS: `2gis.ru/{город}/firm/{id}` или короткая `go.2gis.com/…`.
 * Без зависимостей — используется и в мастере (клиент), и в API.
 */

export const TWO_GIS_URL_REQUIRED_ERROR =
  "Укажите ссылку на карточку в 2GIS — по ней гости с оценкой 4–5★ перейдут оставить отзыв";

export const TWO_GIS_URL_INVALID_ERROR =
  "Нужна ссылка на карточку организации в 2GIS: откройте её и нажмите «Поделиться». Ссылка на поиск или здание не подойдёт";

const TWO_GIS_HOST_RE = /(^|\.)2gis\.(ru|com|kz|kg|uz)$/i;

function parseUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

/** Канонический вид ссылки или null, если это не карточка организации. */
export function normalizeTwoGisUrl(raw: string | null | undefined): string | null {
  const url = raw ? parseUrl(raw) : null;
  if (!url || !TWO_GIS_HOST_RE.test(url.hostname)) return null;
  const host = url.hostname.toLowerCase();

  // Короткая ссылка из «Поделиться» — ведёт на карточку редиректом.
  if (host.startsWith("go.")) {
    const path = url.pathname.replace(/\/+$/, "");
    return path ? `https://${host}${path}` : null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const firmIndex = segments.findIndex((s) => s.toLowerCase() === "firm");
  const firmId = firmIndex >= 0 ? segments[firmIndex + 1] : undefined;
  if (!firmId || !/^\d+$/.test(firmId)) return null;
  const city = firmIndex > 0 && /^[a-z_-]+$/i.test(segments[0]) ? `/${segments[0]}` : "";
  return `https://${host}${city}/firm/${firmId}`;
}

export function twoGisUrlError(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return TWO_GIS_URL_REQUIRED_ERROR;
  return normalizeTwoGisUrl(raw) ? null : TWO_GIS_URL_INVALID_ERROR;
}

/** Метки из рекламы/статей про 2ГИС — в мастере сразу предлагаем 2ГИС. */
export function utmPointsToTwoGis(...values: (string | null | undefined)[]): boolean {
  return values.some((v) => !!v && /2gis|2гис/i.test(v));
}
