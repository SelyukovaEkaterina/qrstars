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

// ─── Scan stats queue (batched writes) ──────────────────────────────────────

const SCAN_COUNT_TTL = 7200; // 2h — counters expire if not flushed
const FLUSH_LOCK_TTL = 120;
const QUEUE_MAX = 10000;

export async function incrScanCount(qrCodeId: string): Promise<void> {
  if (!redis) return;
  try {
    const key = `scan:count:${qrCodeId}`;
    await redis.pipeline().incr(key).expire(key, SCAN_COUNT_TTL).exec();
  } catch {}
}

export interface ScanQueueEntry {
  qrCodeId: string;
  establishmentId?: string | null;
  ip: string;
  userAgent: string;
  ts: number;
}

export async function enqueueScanDetail(entry: ScanQueueEntry): Promise<void> {
  if (!redis) return;
  try {
    const pipeline = redis.pipeline();
    pipeline.lpush("scan:queue", JSON.stringify(entry));
    pipeline.ltrim("scan:queue", 0, QUEUE_MAX - 1);
    await pipeline.exec();
  } catch {}
}

export async function takeScanBatch(count: number): Promise<ScanQueueEntry[]> {
  if (!redis) return [];
  try {
    const entries: ScanQueueEntry[] = [];
    for (let i = 0; i < count; i++) {
      const raw = await redis.rpop("scan:queue");
      if (!raw) break;
      try {
        entries.push(JSON.parse(raw) as ScanQueueEntry);
      } catch {
        // skip malformed
      }
    }
    return entries;
  } catch {
    return [];
  }
}

export async function getAndClearScanCounters(): Promise<Map<string, number>> {
  if (!redis) return new Map();
  const result = new Map<string, number>();
  try {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(
        cursor,
        "MATCH",
        "scan:count:*",
        "COUNT",
        200
      );
      cursor = next;
      if (keys.length === 0) continue;
      const values = await redis.mget(...keys);
      await redis.del(...keys);
      for (let i = 0; i < keys.length; i++) {
        const qrId = keys[i].replace("scan:count:", "");
        const n = parseInt(values[i] || "0", 10);
        if (n > 0) result.set(qrId, n);
      }
    } while (cursor !== "0");
  } catch {
    // best-effort
  }
  return result;
}

export async function getProFlag(key: string): Promise<"1" | "0" | null> {
  if (!redis) return null;
  try {
    return (await redis.get(key)) as "1" | "0" | null;
  } catch {
    return null;
  }
}

export async function setProFlag(
  key: string,
  value: "1" | "0",
  ttl = 300
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, value, "EX", ttl);
  } catch {}
}

export async function acquireFlushLock(): Promise<string | null> {
  if (!redis) return null;
  try {
    const token = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const ok = await redis.set("scan:flush:lock", token, "EX", FLUSH_LOCK_TTL, "NX");
    return ok === "OK" ? token : null;
  } catch {
    return null;
  }
}

export async function releaseFlushLock(token: string): Promise<void> {
  if (!redis) return;
  try {
    const current = await redis.get("scan:flush:lock");
    if (current === token) {
      await redis.del("scan:flush:lock");
    }
  } catch {}
}
