/** = DEMO_QR_PREFIX из demo-qrcodes.ts; не импортируем — модуль тянет демо-данные в клиентский бандл. */
const DEMO_PREFIX = "demo-";

/** Восстанавливаемый код: как в `/q/{code}`, без пробелов и спецсимволов. */
const RESTORE_CODE_RE = /^[A-Za-z0-9_-]{3,64}$/;

/**
 * Достаёт код из того, что вставил владелец: сам код, ссылка `…/q/{code}`
 * или `…/scan/{code}` (с query/hash). Возвращает null, если кода не видно.
 */
export function parseRestoreCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let value = input.trim();
  if (!value) return null;
  const fromUrl = value.match(/\/(?:q|scan|activate)\/([^/?#\s]+)/i);
  if (fromUrl) value = fromUrl[1];
  value = value.replace(/[?#].*$/, "").replace(/\/+$/, "");
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!RESTORE_CODE_RE.test(value)) return null;
  if (value.toLowerCase().startsWith(DEMO_PREFIX)) return null;
  return value;
}
