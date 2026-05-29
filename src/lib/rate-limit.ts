/**
 * Простой in-memory rate limiter (подходит для одного Docker-контейнера).
 * Для горизонтального масштабирования заменить на Redis-реализацию.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number; // timestamp ms
}

const store = new Map<string, RateLimitEntry>();

// Чистим устаревшие записи раз в минуту
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 60_000);

/**
 * Проверяет лимит. Возвращает { ok: true } или { ok: false, retryAfterSeconds }.
 *
 * @param key    Уникальный ключ (например, `register:1.2.3.4`)
 * @param limit  Максимум запросов за окно
 * @param windowMs Длина окна в мс
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  if (process.env.RATE_LIMIT_DISABLED === "true") {
    return { ok: true };
  }

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (entry.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count++;
  return { ok: true };
}

/** Извлекает IP из Next.js Request (учитывает X-Forwarded-For от nginx). */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
