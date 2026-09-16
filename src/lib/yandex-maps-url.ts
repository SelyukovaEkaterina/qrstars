const ALLOWED_HOSTS = new Set([
  "yandex.ru",
  "yandex.com",
  "maps.yandex.ru",
  "maps.yandex.com",
]);

const ORG_PATH_PATTERNS = [/\/maps\/org\//i, /\/org\//i];
const SHORT_PATH_PATTERN = /\/maps\/-\/[A-Za-z0-9_-]+/i;

export const YANDEX_MAPS_CARD_ERROR =
  "Вставьте ссылку на карточку заведения, а не на поиск или главную карт";

export const YANDEX_MAPS_INVALID_ERROR = "Некорректная ссылка на Яндекс.Карты";

export const YANDEX_MAPS_SHORT_UNCONFIRMED_ERROR =
  "Это короткая ссылка. Подтвердите организацию после проверки карточки или вставьте ссылку вида yandex.ru/maps/org/…";

export const YANDEX_MAPS_RESOLVE_ERROR =
  "Не удалось открыть карточку по этой ссылке. Скопируйте ссылку «Поделиться» с страницы организации (yandex.ru/maps/org/…).";

export const YANDEX_MAPS_GENERIC_ORG_ERROR =
  "По этой ссылке нет карточки организации. Проверьте, что скопировали ссылку «Поделиться» со страницы заведения, а не с главной Яндекс.Карт.";

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOSTS.has(hostname.toLowerCase());
}

function isSearchOrMainPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/maps" || path === "/") return true;
  return /\/maps\/search(?:\/|$)/i.test(pathname);
}

export function isYandexMapsOrgPath(pathname: string): boolean {
  return ORG_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function isYandexMapsShortPath(pathname: string): boolean {
  return SHORT_PATH_PATTERN.test(pathname);
}

export function parseYandexMapsInput(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let href = trimmed;
  if (!/^https?:\/\//i.test(href)) {
    href = `https://${href}`;
  }

  try {
    return new URL(href);
  } catch {
    return null;
  }
}

export function isAllowedYandexMapsHost(hostname: string): boolean {
  return isAllowedHost(hostname);
}

/** Нормализует карточку /maps/org/… . Короткие /maps/-/ не принимаются без резолва. */
export function normalizeYandexMapsUrl(raw: string): string | null {
  const parsed = parseYandexMapsInput(raw);
  if (!parsed) return null;
  if (!isAllowedHost(parsed.hostname)) return null;
  if (isSearchOrMainPath(parsed.pathname)) return null;
  if (!isYandexMapsOrgPath(parsed.pathname)) return null;
  return parsed.href;
}

export function isYandexMapsShortUrl(raw: string): boolean {
  const parsed = parseYandexMapsInput(raw);
  if (!parsed || !isAllowedHost(parsed.hostname)) return false;
  if (isSearchOrMainPath(parsed.pathname)) return false;
  return isYandexMapsShortPath(parsed.pathname);
}

export function isValidYandexMapsUrl(url: string): boolean {
  return normalizeYandexMapsUrl(url) !== null;
}

export function yandexMapsUrlError(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parsed = parseYandexMapsInput(trimmed);
  if (!parsed) return YANDEX_MAPS_INVALID_ERROR;
  if (!isAllowedHost(parsed.hostname)) return YANDEX_MAPS_INVALID_ERROR;
  if (isSearchOrMainPath(parsed.pathname) || /\/maps\/search(?:\/|$)/i.test(parsed.pathname)) {
    return YANDEX_MAPS_CARD_ERROR;
  }
  if (isYandexMapsShortPath(parsed.pathname)) {
    return YANDEX_MAPS_SHORT_UNCONFIRMED_ERROR;
  }
  if (!isYandexMapsOrgPath(parsed.pathname)) return YANDEX_MAPS_CARD_ERROR;
  return null;
}

export function orgNameFromYandexPath(pathname: string): string | null {
  const match = pathname.match(/\/(?:maps\/)?org\/([^/]+)/i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]).replace(/_/g, " ").trim() || null;
  } catch {
    return match[1].replace(/_/g, " ").trim() || null;
  }
}

export function extractYandexOrgTitle(html: string): string | null {
  const og =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const raw = og?.[1] || html.match(/<title>([^<]+)<\/title>/i)?.[1];
  if (!raw) return null;
  const decoded = raw
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
  return decoded.replace(/\s+[—–-]\s+Яндекс.*$/i, "").trim() || null;
}

/** Главная / заглушка вместо карточки организации. */
export function isGenericYandexMapsTitle(name: string | null | undefined): boolean {
  const n = name?.trim() ?? "";
  if (!n) return true;
  if (/^яндекс(\s|\.|\s?карты|$)/i.test(n)) return true;
  if (/^yandex(\s|\.|\s?maps|$)/i.test(n)) return true;
  if (/транспорт,\s*навигация/i.test(n)) return true;
  if (/поиск мест/i.test(n)) return true;
  if (/^организация на яндекс/i.test(n)) return true;
  return false;
}

export type YandexMapsPreview = {
  ok: true;
  name: string;
  canonicalUrl: string;
} | {
  ok: false;
  error: string;
};

export async function resolveYandexMapsPreview(
  raw: string,
  fetchImpl: typeof fetch = fetch
): Promise<YandexMapsPreview> {
  const searchError = yandexMapsUrlError(raw);
  if (searchError === YANDEX_MAPS_INVALID_ERROR || searchError === YANDEX_MAPS_CARD_ERROR) {
    return { ok: false, error: searchError };
  }

  const start = parseYandexMapsInput(raw);
  if (!start || !isAllowedHost(start.hostname)) {
    return { ok: false, error: YANDEX_MAPS_INVALID_ERROR };
  }

  let current = start.href;
  let html = "";
  for (let hop = 0; hop < 6; hop++) {
    let res: Response;
    try {
      res = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent": "QrStarsMapsPreview/1.0",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(6000),
      });
    } catch {
      return { ok: false, error: YANDEX_MAPS_RESOLVE_ERROR };
    }

    const location = res.headers.get("location");
    if (location && [301, 302, 303, 307, 308].includes(res.status)) {
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        return { ok: false, error: YANDEX_MAPS_RESOLVE_ERROR };
      }
      if (!isAllowedHost(next.hostname)) {
        return { ok: false, error: YANDEX_MAPS_RESOLVE_ERROR };
      }
      current = next.href;
      continue;
    }

    if (!res.ok) {
      return { ok: false, error: YANDEX_MAPS_GENERIC_ORG_ERROR };
    }

    html = await res.text();
    break;
  }

  const finalUrl = parseYandexMapsInput(current);
  if (!finalUrl || !isAllowedHost(finalUrl.hostname) || isSearchOrMainPath(finalUrl.pathname)) {
    return { ok: false, error: YANDEX_MAPS_RESOLVE_ERROR };
  }
  if (!isYandexMapsOrgPath(finalUrl.pathname)) {
    return { ok: false, error: YANDEX_MAPS_RESOLVE_ERROR };
  }

  const name = extractYandexOrgTitle(html);
  if (!name || isGenericYandexMapsTitle(name)) {
    return { ok: false, error: YANDEX_MAPS_GENERIC_ORG_ERROR };
  }

  return { ok: true, name, canonicalUrl: finalUrl.href };
}
