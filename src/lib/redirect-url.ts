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
