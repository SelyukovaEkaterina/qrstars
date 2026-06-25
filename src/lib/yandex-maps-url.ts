const ALLOWED_HOSTS = new Set([
  "yandex.ru",
  "yandex.com",
  "maps.yandex.ru",
  "maps.yandex.com",
]);

/** Путь похож на карточку организации (не поиск и не главная). */
const ORG_PATH_PATTERNS = [
  /\/maps\/org\//i,
  /\/org\//i,
  /\/maps\/-\/[A-Za-z0-9_-]+/i,
];

export const YANDEX_MAPS_CARD_ERROR =
  "Вставьте ссылку на карточку заведения, а не на поиск или главную карт";

export const YANDEX_MAPS_INVALID_ERROR = "Некорректная ссылка на Яндекс.Карты";

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOSTS.has(hostname.toLowerCase());
}

function isSearchOrMainPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/maps" || path === "/") return true;
  return /\/maps\/search(?:\/|$)/i.test(pathname);
}

function hasOrgCardPath(pathname: string): boolean {
  return ORG_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

function parseInput(raw: string): URL | null {
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

/** Нормализует ввод → https URL или null */
export function normalizeYandexMapsUrl(raw: string): string | null {
  const parsed = parseInput(raw);
  if (!parsed) return null;
  if (!isAllowedHost(parsed.hostname)) return null;
  if (isSearchOrMainPath(parsed.pathname)) return null;
  if (!hasOrgCardPath(parsed.pathname)) return null;
  return parsed.href;
}

/** true если домен yandex.* / maps.yandex.* и путь похож на карточку */
export function isValidYandexMapsUrl(url: string): boolean {
  return normalizeYandexMapsUrl(url) !== null;
}

/** Человекочитаемая ошибка для UI; null — ссылка валидна (пустая строка тоже null) */
export function yandexMapsUrlError(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parsed = parseInput(trimmed);
  if (!parsed) return YANDEX_MAPS_INVALID_ERROR;
  if (!isAllowedHost(parsed.hostname)) return YANDEX_MAPS_INVALID_ERROR;
  if (isSearchOrMainPath(parsed.pathname) || /\/maps\/search(?:\/|$)/i.test(parsed.pathname)) {
    return YANDEX_MAPS_CARD_ERROR;
  }
  if (!hasOrgCardPath(parsed.pathname)) return YANDEX_MAPS_CARD_ERROR;
  return null;
}
