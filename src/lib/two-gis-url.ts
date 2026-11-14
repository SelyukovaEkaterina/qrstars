/**
 * Ссылка на карточку организации в 2GIS: `2gis.ru/{город}/firm/{id}` или короткая `go.2gis.com/…`.
 * Без зависимостей — используется и в мастере (клиент), и в API.
 */

export const TWO_GIS_URL_REQUIRED_ERROR =
  "Укажите ссылку на карточку в 2GIS — по ней гости с оценкой 4–5★ перейдут оставить отзыв";

export const TWO_GIS_URL_INVALID_ERROR =
  "Нужна ссылка на карточку организации в 2GIS: откройте её и нажмите «Поделиться». Ссылка на поиск или здание не подойдёт";

/** Вставили не ссылку: название организации, адрес, телефон. */
export const TWO_GIS_URL_NOT_A_LINK_ERROR =
  "Это не ссылка. Откройте организацию в 2GIS, нажмите «Поделиться» → «Скопировать ссылку» и вставьте её сюда — она начинается с https://2gis.ru/ или https://go.2gis.com/";

/** Ссылка на другой сайт (не 2GIS и не Яндекс.Карты). */
export const TWO_GIS_URL_OTHER_SITE_ERROR =
  "Это ссылка не на 2GIS. Нужна ссылка на карточку организации: https://2gis.ru/…/firm/… или https://go.2gis.com/…";

const TWO_GIS_HOST_RE = /(^|\.)2gis\.(ru|com|kz|kg|uz)$/i;
const YANDEX_MAPS_HOST_RE = /(^|\.)yandex\.(ru|com|by|kz|uz)$/i;

/**
 * «Поделиться» в приложении 2GIS копирует текст вместе со ссылкой
 * («Кафе Ромашка, Ленина 1\nhttps://go.2gis.com/abc12»). Достаём из текста саму ссылку.
 */
export function extractPastedUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!/\s/.test(trimmed)) return trimmed;
  const withScheme = trimmed.match(/https?:\/\/[^\s<>"']+/i);
  const bare = withScheme ?? trimmed.match(/(?:[a-z0-9-]+\.)+[a-z]{2,}\/[^\s<>"']+/i);
  return bare ? bare[0].replace(/[.,;:!?)\]]+$/, "") : trimmed;
}

function parseUrl(raw: string): URL | null {
  const trimmed = extractPastedUrl(raw);
  if (!trimmed || /\s/.test(trimmed)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.hostname.includes(".") ? url : null;
  } catch {
    return null;
  }
}

/** В поле 2GIS вставили ссылку Яндекс.Карт — мастер переключает площадку. */
export function isYandexMapsLink(raw: string | null | undefined): boolean {
  const url = raw ? parseUrl(raw) : null;
  return !!url && YANDEX_MAPS_HOST_RE.test(url.hostname) && /(^|\/)maps(\/|$)/i.test(url.pathname);
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
  if (normalizeTwoGisUrl(raw)) return null;
  const url = parseUrl(raw);
  if (!url) return TWO_GIS_URL_NOT_A_LINK_ERROR;
  return TWO_GIS_HOST_RE.test(url.hostname) ? TWO_GIS_URL_INVALID_ERROR : TWO_GIS_URL_OTHER_SITE_ERROR;
}

/** Метки из рекламы/статей про 2ГИС — в мастере сразу предлагаем 2ГИС. */
export function utmPointsToTwoGis(...values: (string | null | undefined)[]): boolean {
  return values.some((v) => !!v && /2gis|2гис/i.test(v));
}
