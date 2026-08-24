import prisma from "@/lib/prisma";
import { startOfMskDay, mskDateKey } from "@/lib/report-formatting";

export interface ScanPeriodStats {
  /** Сканы за период по каждому QR (id → количество). */
  perQr: Map<string, number>;
  /** Сканы по дням МСК (ключ `YYYY-MM-DD`). */
  daily: Map<string, number>;
  total: number;
}

interface LatestSnapshotRow {
  qrCodeId: string;
  snapshot: bigint | number;
}

function emptyStats(): ScanPeriodStats {
  return { perQr: new Map(), daily: new Map(), total: 0 };
}

/**
 * Сканы за период для набора QR-кодов.
 *
 * Источник — `DailyScanStat` (дневные дельты `scansCount`, пишутся для всех
 * тарифов), а не `QRScan`: детальный лог ведётся только для PRO/Сеть, поэтому
 * на FREE агрегаты по нему всегда нулевые.
 *
 * Снапшот за текущий день появляется только в 04:00 МСК следующего дня, поэтому
 * сканы «с полуночи» доливаются живой дельтой `scansCount − последний snapshot`.
 */
export async function collectScanPeriodStats(
  qrCodeIds: string[],
  periodStart: Date,
  periodEnd: Date,
  now: Date = new Date()
): Promise<ScanPeriodStats> {
  if (qrCodeIds.length === 0) return emptyStats();

  const fromDay = startOfMskDay(periodStart);
  const toDay = startOfMskDay(periodEnd);
  if (toDay < fromDay) return emptyStats();

  const todayStart = startOfMskDay(now);
  const includesToday = toDay >= todayStart && fromDay <= todayStart;

  const rows = await prisma.dailyScanStat.groupBy({
    by: ["qrCodeId", "date"],
    where: { qrCodeId: { in: qrCodeIds }, date: { gte: fromDay, lte: toDay } },
    _sum: { count: true },
  });

  const perQr = new Map<string, number>();
  const daily = new Map<string, number>();
  let total = 0;

  const addScans = (qrCodeId: string, dayKey: string, count: number) => {
    if (count <= 0) return;
    perQr.set(qrCodeId, (perQr.get(qrCodeId) ?? 0) + count);
    daily.set(dayKey, (daily.get(dayKey) ?? 0) + count);
    total += count;
  };

  for (const row of rows) {
    addScans(row.qrCodeId, mskDateKey(row.date), row._sum.count ?? 0);
  }

  if (includesToday) {
    const [qrs, latestSnapshots] = await Promise.all([
      prisma.qRCode.findMany({
        where: { id: { in: qrCodeIds } },
        select: { id: true, scansCount: true, createdAt: true },
      }),
      // Последний снапшот на каждый QR — baseline для сканов, ещё не попавших
      // в DailyScanStat. DISTINCT ON — Postgres-специфика (одна строка на QR).
      prisma.$queryRaw<LatestSnapshotRow[]>`
        SELECT DISTINCT ON ("qrCodeId") "qrCodeId", "snapshot"
        FROM "DailyScanStat"
        WHERE "qrCodeId" = ANY(${qrCodeIds}::text[]) AND "date" <= ${todayStart}
        ORDER BY "qrCodeId", "date" DESC
      `,
    ]);

    const snapshotMap = new Map(
      latestSnapshots.map((r) => [r.qrCodeId, Number(r.snapshot)])
    );
    const todayKey = mskDateKey(todayStart);

    for (const qr of qrs) {
      const baseline = snapshotMap.get(qr.id);
      if (baseline === undefined) {
        // Снапшотов ещё нет: у QR, созданного сегодня, весь scansCount — за сегодня.
        if (qr.createdAt >= todayStart) addScans(qr.id, todayKey, qr.scansCount);
        continue;
      }
      addScans(qr.id, todayKey, Math.max(0, qr.scansCount - baseline));
    }
  }

  return { perQr, daily, total };
}
