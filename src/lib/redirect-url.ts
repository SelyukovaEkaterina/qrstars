/**
 * Заголовок `Location` допускает только ASCII, поэтому URL с кириллицей
 * (частый случай — ссылка Яндекс.Карт с `?text=Ломбард 585`) роняет ответ
 * на `setHeader` уже после начала рендера. Все внешние URL, попадающие
 * в `redirect()`, нужно прогонять через `toHeaderSafeUrl`.
 */

/** Percent-кодирует всё, что не ASCII (страховка для схем с opaque path: tel:, sms:). */
function encodeNonAscii(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[^\u0000-\u007f]+/g, (chunk) => encodeURIComponent(chunk));
}

const RELATIVE_BASE = "https://relative.invalid";

/**
 * Нормализует пользовательский URL до ASCII-формы, пригодной для `Location`.
 * Возвращает `null`, если строка не парсится как URL.
 */
export function toHeaderSafeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Управляющие символы недопустимы в заголовке и открывают header injection
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!cleaned) return null;

  const isRelative = cleaned.startsWith("/");
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(cleaned);

  try {
    if (isRelative) {
      const parsed = new URL(cleaned, RELATIVE_BASE);
      return encodeNonAscii(parsed.href.slice(RELATIVE_BASE.length));
    }
    const parsed = new URL(hasScheme ? cleaned : `https://${cleaned}`);
    return encodeNonAscii(parsed.href);
  } catch {
    return null;
  }
}

const FORBIDDEN_SCHEMES = new Set(["blob:", "javascript:", "data:", "file:", "vbscript:"]);

/**
 * Ловит ссылки, которые у гостя заведомо не откроются. Частый случай —
 * ссылка вставлена дважды и склеилась (`…/q/abc12tars.ru/q/abc12`,
 * `…/f03blob:https://…`): URL парсится, но ведёт на 404.
 * Возвращает текст ошибки для владельца или `null`, если ссылка выглядит рабочей.
 */
export function findRedirectUrlProblem(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;

  const scheme = value.match(/^([a-z][a-z0-9+.-]*:)/i)?.[1]?.toLowerCase();
  if (scheme && FORBIDDEN_SCHEMES.has(scheme)) {
    return scheme === "blob:"
      ? "Это временная ссылка браузера (blob:), у гостей она не откроется. Скопируйте адрес страницы из адресной строки"
      : "Такой тип ссылки не поддерживается. Укажите адрес, начинающийся с https://";
  }

  let parsed: URL;
  try {
    parsed = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const glued = "Похоже, ссылка вставлена дважды и склеилась. Проверьте адрес и вставьте его один раз";

  // Схема внутри пути (не в query, где её законно передают редиректоры).
  if (/(?:https?|blob):/i.test(decodeSafe(parsed.pathname))) return glued;

  // Хвост пути повторяется: `/q/abc12…/q/abc12`.
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length >= 2) {
    const tail = segments.slice(-2).join("/");
    const path = parsed.pathname;
    if (tail.length >= 6 && path.indexOf(tail) !== path.lastIndexOf(tail)) return glued;
  }

  return null;
}

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
