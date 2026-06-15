import prisma from "@/lib/prisma";
import { redis } from "@/lib/cache";
import { parseUserAgent, getClientIp } from "@/lib/client-info";
import { lookupGeoRegion } from "@/lib/geoip";
import { establishmentHasPaidFeatures } from "@/lib/establishment-access";
import { userHasPaidFeatures } from "@/lib/subscription-utils";
import {
  incrScanCount,
  enqueueScanDetail,
  takeScanBatch,
  getAndClearScanCounters,
  getProFlag,
  setProFlag,
  acquireFlushLock,
  releaseFlushLock,
} from "@/lib/cache";

const PRO_CACHE_TTL = 300; // 5 min
const FLUSH_BATCH_SIZE = 200;

/**
 * Cached PRO-статус заведения / QR-кода.
 * Redis-ключ: `pro:est:{estId}` или `pro:qr:{qrCodeId}`.
 * При cache miss — один DB-запрос, далее кэшируется на 5 минут.
 */
async function shouldLogDetailedScan(
  qrCodeId: string,
  establishmentId?: string | null
): Promise<boolean> {
  const cacheKey = establishmentId
    ? `pro:est:${establishmentId}`
    : `pro:qr:${qrCodeId}`;

  const cached = await getProFlag(cacheKey);
  if (cached === "1") return true;
  if (cached === "0") return false;

  let pro: boolean;
  if (establishmentId) {
    pro = await establishmentHasPaidFeatures(establishmentId);
  } else {
    const qr = await prisma.qRCode.findUnique({
      where: { id: qrCodeId },
      select: { userId: true },
    });
    pro = qr?.userId ? await userHasPaidFeatures(qr.userId) : false;
  }

  await setProFlag(cacheKey, pro ? "1" : "0", PRO_CACHE_TTL);
  return pro;
}

export interface EnqueueScanParams {
  qrCodeId: string;
  establishmentId?: string | null;
  headers: Headers;
}

// ─── Fallback: synchronous DB write when Redis is unavailable ───────────────

async function markUserFirstScan(qrCodeId: string): Promise<void> {
  try {
    const qr = await prisma.qRCode.findUnique({
      where: { id: qrCodeId },
      select: { userId: true },
    });
    if (!qr?.userId) return;
    await prisma.user.updateMany({
      where: { id: qr.userId, firstScanAt: null },
      data: { firstScanAt: new Date() },
    });
  } catch {
    // best-effort
  }
}

/** Old-style synchronous write — used when Redis is not configured. */
async function recordScanFallback(
  qrCodeId: string,
  establishmentId: string | null | undefined,
  headers: Headers
): Promise<void> {
  try {
    const detailed = await shouldLogDetailedScan(qrCodeId, establishmentId ?? undefined);

    if (!detailed) {
      await prisma.qRCode.update({
        where: { id: qrCodeId },
        data: { scansCount: { increment: 1 } },
      });
      void markUserFirstScan(qrCodeId);
      return;
    }

    const ip = getClientIp({ headers } as Request);
    const ua = headers.get("user-agent");
    const { browser, device } = parseUserAgent(ua);
    const region = await lookupGeoRegion(ip);

    await prisma.$transaction([
      prisma.qRCode.update({
        where: { id: qrCodeId },
        data: { scansCount: { increment: 1 } },
      }),
      prisma.qRScan.create({
        data: {
          qrCodeId,
          establishmentId: establishmentId ?? null,
          ip: ip.slice(0, 45),
          region: region.slice(0, 200),
          browser: browser.slice(0, 100),
          device: device.slice(0, 100),
        },
      }),
    ]);
    void markUserFirstScan(qrCodeId);
  } catch {
    // best-effort
  }
}

/**
 * Неблокирующая постановка скана в очередь.
 * - С Redis: INCR счётчика (всегда) + LPUSH в detail-очередь (только PRO)
 *   → батчевый flush через cron / setInterval
 * - Без Redis: синхронная запись в БД (старое поведение, fire-and-forget)
 */
export function enqueueScan({
  qrCodeId,
  establishmentId,
  headers,
}: EnqueueScanParams): void {
  // Fallback to synchronous DB write when Redis is not available
  if (!redis) {
    void recordScanFallback(qrCodeId, establishmentId, headers);
    return;
  }

  const ip = (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  ).slice(0, 45);
  const userAgent = (headers.get("user-agent") || "").slice(0, 500);

  void (async () => {
    try {
      await incrScanCount(qrCodeId);

      const detailed = await shouldLogDetailedScan(qrCodeId, establishmentId ?? undefined);
      if (!detailed) return;

      await enqueueScanDetail({
        qrCodeId,
        establishmentId: establishmentId ?? null,
        ip,
        userAgent,
        ts: Date.now(),
      });
    } catch {
      // best-effort
    }
  })();
}

export interface FlushResult {
  countersFlushed: number;
  detailsInserted: number;
  durationMs: number;
}

/**
 * Батчевый flush статистики сканов: счётчики → scansCount, очередь → QRScan.
 * Берёт Redis-лок, чтобы concurrent cron + setInterval не дублировали работу.
 */
export async function flushScanStats(): Promise<FlushResult> {
  const start = Date.now();
  const token = await acquireFlushLock();
  if (!token) {
    return { countersFlushed: 0, detailsInserted: 0, durationMs: 0 };
  }

  let countersFlushed = 0;
  let detailsInserted = 0;

  try {
    // 1. Flush counters (scansCount increments)
    const counters = await getAndClearScanCounters();
    if (counters.size > 0) {
      const entries = Array.from(counters.entries());
      const CHUNK = 50;
      for (let i = 0; i < entries.length; i += CHUNK) {
        const chunk = entries.slice(i, i + CHUNK);
        await prisma.$transaction(
          chunk.map(([qrCodeId, n]) =>
            prisma.qRCode.update({
              where: { id: qrCodeId },
              data: { scansCount: { increment: n } },
            })
          )
        );
      }
      countersFlushed = counters.size;

      // markUserFirstScan: одним запросом для всех затронутых владельцев
      const qrIds = entries.map(([id]) => id);
      const qrs = await prisma.qRCode.findMany({
        where: { id: { in: qrIds } },
        select: { userId: true },
      });
      const userIds = [
        ...new Set(qrs.map((q) => q.userId).filter(Boolean)),
      ] as string[];
      if (userIds.length > 0) {
        await prisma.user.updateMany({
          where: { id: { in: userIds }, firstScanAt: null },
          data: { firstScanAt: new Date() },
        });
      }
    }

    // 2. Flush detailed scan logs (QRScan inserts)
    while (true) {
      const batch = await takeScanBatch(FLUSH_BATCH_SIZE);
      if (batch.length === 0) break;

      const rows = [];
      for (const entry of batch) {
        const { browser, device } = parseUserAgent(entry.userAgent || null);
        const region = await lookupGeoRegion(entry.ip);
        rows.push({
          qrCodeId: entry.qrCodeId,
          establishmentId: entry.establishmentId ?? null,
          ip: entry.ip.slice(0, 45),
          region: region.slice(0, 200),
          browser: browser.slice(0, 100),
          device: device.slice(0, 100),
        });
      }

      if (rows.length > 0) {
        await prisma.qRScan.createMany({ data: rows });
        detailsInserted += rows.length;
      }

      if (batch.length < FLUSH_BATCH_SIZE) break;
    }
  } finally {
    await releaseFlushLock(token);
  }

  return {
    countersFlushed,
    detailsInserted,
    durationMs: Date.now() - start,
  };
}

// ─── In-process flush (belt-and-suspenders alongside cron) ───────────────────

let intervalTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Запускает периодический flush статистики в текущем процессе.
 * Дублирует cron для надёжности (лок в Redis предотвращает двойную работу).
 */
export function startScanFlushInterval(intervalMs?: number): void {
  if (intervalTimer) return;
  const interval = intervalMs ?? parseInt(
    process.env.SCAN_FLUSH_INTERVAL_MS || "30000",
    10
  );
  if (interval <= 0) return;

  intervalTimer = setInterval(() => {
    void flushScanStats().catch(() => {});
  }, interval);
  intervalTimer.unref?.();
}
