import prisma from "@/lib/prisma";
import {
  getPreviousMskDayRange,
  getCurrentMskDayRange,
  type DailyReportRange,
} from "@/lib/admin-weekly-report";
import { formatMskDate } from "@/lib/report-formatting";

export interface SnapshotResult {
  date: Date;
  label: string;
  processedQrs: number;
  rowsUpserted: number;
  durationMs: number;
}

export interface SnapshotOptions {
  /** `yesterday` (по умолч., для cron) или `today` (дебаг / e2e). */
  period?: "yesterday" | "today";
}

interface PrevSnapshotRow {
  qrCodeId: string;
  snapshot: bigint | number;
}

/**
 * Дневной снапшот scansCount по каждому QR.
 *
 * FREE-сканы не пишут detail-лог в `QRScan` (только кумулятивный `scansCount`),
 * поэтому агрегаты отчётов за период берутся из `DailyScanStat`.
 *
 * Алгоритм: для каждого QR, существовавшего на конец дня,
 *   count    = max(0, scansCount − snapshot предыдущего дня)
 *   snapshot = scansCount (абсолют, для расчёта следующей дельты)
 * При отсутствии предыдущего снапшота:
 *   - QR создан в этот день → count = scansCount (вчера не существовал);
 *   - иначе (первый запуск cron на legacy-базе) → count = 0 (baseline,
 *     корректные дельты со следующего дня).
 *
 * Идемпотентен: повторный запуск за тот же день пересчитает `count`/`snapshot`.
 */
export async function takeDailyScanSnapshot(
  referenceDate: Date = new Date(),
  options?: SnapshotOptions
): Promise<SnapshotResult> {
  const start = Date.now();
  const range: DailyReportRange =
    options?.period === "today"
      ? getCurrentMskDayRange(referenceDate)
      : getPreviousMskDayRange(referenceDate);
  const dayStart = range.from;
  const dayEnd = range.to;

  const qrs = await prisma.qRCode.findMany({
    where: { createdAt: { lte: dayEnd } },
    select: { id: true, scansCount: true, establishmentId: true, createdAt: true },
  });

  if (qrs.length === 0) {
    return {
      date: dayStart,
      label: formatMskDate(dayStart),
      processedQrs: 0,
      rowsUpserted: 0,
      durationMs: Date.now() - start,
    };
  }

  // Последний снапшот ДО dayStart на каждый qrCodeId (baseline для дельты).
  // DISTINCT ON — Postgres-специфика, берёт ровно одну (последнюю по date) строку на QR.
  const prevRows = await prisma.$queryRaw<PrevSnapshotRow[]>`
    SELECT DISTINCT ON ("qrCodeId") "qrCodeId", "snapshot"
    FROM "DailyScanStat"
    WHERE "date" < ${dayStart}
    ORDER BY "qrCodeId", "date" DESC
  `;
  const prevMap = new Map(
    prevRows.map((r) => [r.qrCodeId, Number(r.snapshot)])
  );

  const CHUNK = 100;
  let rowsUpserted = 0;
  for (let i = 0; i < qrs.length; i += CHUNK) {
    const chunk = qrs.slice(i, i + CHUNK);
    await prisma.$transaction(
      chunk.map((q) => {
        const prev = prevMap.get(q.id);
        const snapshot = q.scansCount;
        let count: number;
        if (prev !== undefined) {
          // Есть снапшот предыдущего дня → дельта от него.
          count = Math.max(0, snapshot - prev);
        } else if (q.createdAt >= dayStart) {
          // QR создан в этот день → вчера не существовал, все сканы за день = scansCount.
          count = Math.max(0, snapshot);
        } else {
          // Существовал ранее, но нет baseline-истории → первый запуск, считаем 0
          // (корректные дельты со следующего дня).
          count = 0;
        }
        return prisma.dailyScanStat.upsert({
          where: {
            qrCodeId_date: { qrCodeId: q.id, date: dayStart },
          },
          create: {
            qrCodeId: q.id,
            establishmentId: q.establishmentId,
            date: dayStart,
            count,
            snapshot,
          },
          update: {
            establishmentId: q.establishmentId,
            count,
            snapshot,
          },
        });
      })
    );
    rowsUpserted += chunk.length;
  }

  return {
    date: dayStart,
    label: formatMskDate(dayStart),
    processedQrs: qrs.length,
    rowsUpserted,
    durationMs: Date.now() - start,
  };
}
