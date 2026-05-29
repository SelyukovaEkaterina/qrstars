import Redis from "ioredis";

const SCAN_TTL = 60; // seconds
const SLUG_PAGE_TTL = 60;
const EST_CODES_TTL = 600; // 10 min reverse index

function createRedisClient() {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  const client = new Redis(url, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    lazyConnect: true,
    retryStrategy: () => null, // fail fast, never block the app
  });
  client.on("error", () => {});
  return client;
}

const globalForRedis = globalThis as unknown as { redis: Redis | null };
export const redis = globalForRedis.redis ?? createRedisClient();
if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

// ─── Generic helpers ───────────────────────────────────────────────────────

export async function getCached<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function setCached(key: string, value: unknown, ttl: number): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttl);
  } catch {
    // swallow — cache failure must never break the app
  }
}

// ─── Scan-specific cache ───────────────────────────────────────────────────

export async function getScanCache<T>(code: string): Promise<T | null> {
  return getCached<T>(`scan:${code}`);
}

export async function setScanCache(
  code: string,
  data: unknown,
  establishmentId?: string | null
): Promise<void> {
  if (!redis) return;
  try {
    const pipeline = redis.pipeline();
    pipeline.set(`scan:${code}`, JSON.stringify(data), "EX", SCAN_TTL);
    if (establishmentId) {
      // reverse index: est → set of QR codes (for bulk invalidation)
      pipeline.sadd(`est_codes:${establishmentId}`, code);
      pipeline.expire(`est_codes:${establishmentId}`, EST_CODES_TTL);
    }
    await pipeline.exec();
  } catch {}
}

// ─── Short slug page cache (/a/[slug]) ─────────────────────────────────────

export async function getSlugPageCache<T>(slug: string): Promise<T | null> {
  return getCached<T>(`slug:${slug}`);
}

export async function setSlugPageCache(
  slug: string,
  establishmentId: string,
  data: unknown
): Promise<void> {
  if (!redis) return;
  try {
    const pipeline = redis.pipeline();
    pipeline.set(`slug:${slug}`, JSON.stringify(data), "EX", SLUG_PAGE_TTL);
    pipeline.set(`est_slug:${establishmentId}`, slug, "EX", SLUG_PAGE_TTL);
    await pipeline.exec();
  } catch {}
}

/** Invalidate a single QR code scan cache (e.g. after QR mode change). */
export async function invalidateScanCache(code: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`scan:${code}`);
  } catch {}
}

/**
 * Invalidate all QR codes belonging to an establishment.
 * Called when establishment content changes (page PUT, activate).
 */
/** Сброс кэша меню iiko после смены настроек или скрытых категорий. */
export async function invalidateIikoMenuCache(menuId: string): Promise<void> {
  if (!redis) return;
  try {
    const keys = await redis.keys(`iiko:menu:${menuId}:*`);
    if (keys.length > 0) await redis.del(...keys);
  } catch {}
}

export async function invalidateEstablishmentCache(establishmentId: string): Promise<void> {
  if (!redis) return;
  try {
    const [codes, slug] = await Promise.all([
      redis.smembers(`est_codes:${establishmentId}`),
      redis.get(`est_slug:${establishmentId}`),
    ]);
    const keys = [
      `est_codes:${establishmentId}`,
      `est_slug:${establishmentId}`,
      ...codes.map((c) => `scan:${c}`),
    ];
    if (slug) keys.push(`slug:${slug}`);
    await redis.del(...keys);
  } catch {}
}
