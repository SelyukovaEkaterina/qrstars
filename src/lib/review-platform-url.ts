import { isYandexMapsOrgPath, parseYandexMapsInput } from "@/lib/yandex-maps-url";

type PlatformAction = "YANDEX" | "TWO_GIS" | "AVITO" | "CUSTOM" | string;

/**
 * Карточка организации в БД остаётся «чистой» (`/maps/org/…`).
 * Для гостя 4–5★ собираем URL формы отзыва; если не получилось — исходная ссылка.
 */

export function toYandexReviewSubmitUrl(raw: string): string | null {
  const parsed = parseYandexMapsInput(raw);
  if (!parsed || !isYandexMapsOrgPath(parsed.pathname)) return null;

  const match = parsed.pathname.match(/^(\/(?:maps\/)?org\/[^/]+\/\d+)/i);
  if (!match?.[1]) return null;

  parsed.pathname = `${match[1].replace(/\/+$/, "")}/reviews/`;
  parsed.searchParams.set("add-review", "1");
  parsed.hash = "";
  return parsed.href;
}

export function toTwoGisReviewSubmitUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (!/(^|\.)2gis\.(ru|com|kz|kg|uz)$/i.test(url.hostname) && !/^go\.2gis\./i.test(url.hostname)) {
    return null;
  }
  const firm = url.pathname.match(/^(.*?\/firm\/\d+)/i);
  if (!firm?.[1]) return null;
  url.pathname = `${firm[1].replace(/\/+$/, "")}/tab/reviews/addreview`;
  url.search = "";
  url.hash = "";
  return url.href;
}

export function toAvitoReviewSubmitUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (!/(^|\.)avito\.ru$/i.test(url.hostname)) return null;
  if (/\/reviews\/?$/i.test(url.pathname) || url.searchParams.has("reviews")) {
    return url.href;
  }
  return null;
}

export function toPlatformReviewUrl(
  action: PlatformAction,
  url: string | null | undefined
): string | null {
  if (!url?.trim()) return null;
  const raw = url.trim();
  try {
    if (action === "YANDEX") return toYandexReviewSubmitUrl(raw) || raw;
    if (action === "TWO_GIS") return toTwoGisReviewSubmitUrl(raw) || raw;
    if (action === "AVITO") return toAvitoReviewSubmitUrl(raw) || raw;
    return raw;
  } catch {
    return raw;
  }
}
