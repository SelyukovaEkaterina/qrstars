import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { establishmentAccessWhere, qrcodeAccessWhere } from "@/lib/establishment-access";
import { apiError, apiJson, apiOptions, withApiAuth } from "@/lib/public-api/auth";
import { parseDateParam } from "@/lib/public-api/pagination";
import { collectScanPeriodStats } from "@/lib/scan-period-stats";
import { mskDateKey } from "@/lib/report-formatting";

export const OPTIONS = apiOptions;

const DAY_MS = 24 * 60 * 60_000;
const MAX_RANGE_DAYS = 366;

/** Сканы и отзывы за период. Дни — по календарю МСК, как в кабинете. */
export const GET = withApiAuth(async (request, { userId }) => {
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const to = parseDateParam(searchParams.get("to"));
  const from = parseDateParam(searchParams.get("from"));
  if (to === null || from === null) {
    return apiError(400, "invalid_request", "from / to — дата ISO 8601 или YYYY-MM-DD");
  }
  const periodEnd = to ?? now;
  const periodStart = from ?? new Date(periodEnd.getTime() - 29 * DAY_MS);
  if (periodStart > periodEnd) return apiError(400, "invalid_request", "from позже to");
  if (periodEnd.getTime() - periodStart.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    return apiError(400, "invalid_request", `Период — не больше ${MAX_RANGE_DAYS} дней`);
  }

  const projectId = searchParams.get("projectId")?.trim() || null;
  const qrCodeId = searchParams.get("qrCodeId")?.trim() || null;

  if (projectId) {
    const project = await prisma.establishment.findFirst({
      where: { id: projectId, ...establishmentAccessWhere(userId) },
      select: { id: true },
    });
    if (!project) return apiError(404, "not_found", "Проект не найден");
  }

  const qrWhere: Prisma.QRCodeWhereInput = { ...qrcodeAccessWhere(userId) };
  if (projectId) qrWhere.establishmentId = projectId;
  if (qrCodeId) qrWhere.id = qrCodeId;
  const qrcodes = await prisma.qRCode.findMany({
    where: qrWhere,
    select: { id: true, code: true, label: true },
  });
  if (qrCodeId && qrcodes.length === 0) return apiError(404, "not_found", "QR-код не найден");

  const scans = await collectScanPeriodStats(
    qrcodes.map((q) => q.id),
    periodStart,
    periodEnd,
    now
  );

  const reviewWhere: Prisma.ReviewWhereInput = {
    establishment: establishmentAccessWhere(userId),
    createdAt: { gte: periodStart, lte: periodEnd },
  };
  if (projectId) reviewWhere.establishmentId = projectId;
  if (qrCodeId) reviewWhere.qrCodeId = qrCodeId;
  const byRating = await prisma.review.groupBy({
    by: ["rating"],
    where: reviewWhere,
    _count: { _all: true },
  });
  const ratingCounts: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  let reviewsTotal = 0;
  let ratingSum = 0;
  for (const row of byRating) {
    ratingCounts[String(row.rating)] = row._count._all;
    reviewsTotal += row._count._all;
    ratingSum += row.rating * row._count._all;
  }
  const negative = await prisma.review.count({ where: { ...reviewWhere, isNegative: true } });

  // Все дни периода, включая нулевые, чтобы график не «проваливался».
  const daily: Array<{ date: string; scans: number }> = [];
  const seen = new Set<string>();
  for (let t = periodStart.getTime(); t <= periodEnd.getTime() + DAY_MS; t += DAY_MS) {
    const key = mskDateKey(new Date(Math.min(t, periodEnd.getTime())));
    if (seen.has(key)) continue;
    seen.add(key);
    daily.push({ date: key, scans: scans.daily.get(key) ?? 0 });
  }

  const byQr = qrcodes
    .map((q) => ({ qrCodeId: q.id, code: q.code, label: q.label, scans: scans.perQr.get(q.id) ?? 0 }))
    .filter((q) => q.scans > 0)
    .sort((a, b) => b.scans - a.scans)
    .slice(0, 50);

  return apiJson({
    period: { from: periodStart.toISOString(), to: periodEnd.toISOString(), timezone: "Europe/Moscow" },
    scans: { total: scans.total, daily, topQrCodes: byQr },
    reviews: {
      total: reviewsTotal,
      negative,
      averageRating: reviewsTotal ? Math.round((ratingSum / reviewsTotal) * 100) / 100 : null,
      byRating: ratingCounts,
    },
  });
});
