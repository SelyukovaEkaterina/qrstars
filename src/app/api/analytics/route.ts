import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  establishmentAccessWhere,
  canAccessAnalytics,
  orphanQrcodeWhere,
  isOrphanEstablishmentFilter,
  ORPHAN_ESTABLISHMENT_FILTER,
  ORPHAN_ESTABLISHMENT_LABEL,
} from "@/lib/establishment-access";

/** Ключ даты YYYY-MM-DD в локальной TZ сервера (совпадает с графиками в UI). */
function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const { searchParams } = new URL(request.url);
  const estIdParam = searchParams.get("establishmentId");

  if (
    !(await canAccessAnalytics(
      userId,
      isOrphanEstablishmentFilter(estIdParam) ? null : estIdParam
    ))
  ) {
    return NextResponse.json({ error: "Требуется платный тариф PRO или Сеть" }, { status: 403 });
  }

  const periodParam = searchParams.get("period") || "30d";
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const qrCodeId = searchParams.get("qrCodeId");
  const estId = searchParams.get("establishmentId");

  let periodStart: Date;
  let periodEnd: Date;
  let days: number;

  if (fromParam && toParam) {
    periodStart = new Date(fromParam + "T00:00:00");
    periodEnd = new Date(toParam + "T23:59:59.999");
    days = Math.ceil(
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
    );
  } else {
    switch (periodParam) {
      case "7d":
        days = 7;
        break;
      case "90d":
        days = 90;
        break;
      case "all":
        days = 3650;
        break;
      default:
        days = 30;
    }
    periodEnd = new Date();
    periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days);
    periodStart.setHours(0, 0, 0, 0);
  }

  const prevPeriodStart = new Date(periodStart);
  prevPeriodStart.setDate(prevPeriodStart.getDate() - (days + 1));
  prevPeriodStart.setHours(0, 0, 0, 0);
  const prevPeriodEnd = new Date(periodStart.getTime() - 1);

  const establishments = await prisma.establishment.findMany({
    where: establishmentAccessWhere(userId),
    include: {
      reviews: { orderBy: { createdAt: "desc" } },
      qrcodes: true,
    },
  });

  const orphanQrcodes = await prisma.qRCode.findMany({
    where: orphanQrcodeWhere(userId),
    orderBy: { createdAt: "desc" },
  });

  const isOrphanFilter = isOrphanEstablishmentFilter(estId);
  const isAllFilter = !estId;

  const filteredEstablishments = isOrphanFilter
    ? []
    : estId
      ? establishments.filter((e) => e.id === estId)
      : establishments;

  const filteredOrphanQrs = isOrphanFilter || isAllFilter
    ? orphanQrcodes.filter((q) => !qrCodeId || q.id === qrCodeId)
    : [];

  const allReviews = filteredEstablishments.flatMap((e) =>
    qrCodeId
      ? e.reviews.filter((r) => r.qrCodeId === qrCodeId)
      : e.reviews
  );
  const allQrs = [
    ...filteredEstablishments.flatMap((e) =>
      e.qrcodes.filter((q) => !qrCodeId || q.id === qrCodeId)
    ),
    ...filteredOrphanQrs,
  ];
  const filteredQrIds = allQrs.map((q) => q.id);

  const [periodScanRecords, prevPeriodScanCount] = await Promise.all([
    filteredQrIds.length > 0
      ? prisma.qRScan.findMany({
          where: {
            qrCodeId: { in: filteredQrIds },
            createdAt: { gte: periodStart, lte: periodEnd },
          },
          orderBy: { createdAt: "desc" },
          include: {
            qrCode: { select: { code: true, label: true, mode: true } },
          },
        })
      : Promise.resolve([]),
    filteredQrIds.length > 0
      ? prisma.qRScan.count({
          where: {
            qrCodeId: { in: filteredQrIds },
            createdAt: { gte: prevPeriodStart, lte: prevPeriodEnd },
          },
        })
      : Promise.resolve(0),
  ]);

  const totalScans = periodScanRecords.length;
  const reviewCapableScans = periodScanRecords.filter(
    (s) => s.qrCode.mode === "REVIEW" || s.qrCode.mode === "LANDING"
  ).length;
  const otherScans = totalScans - reviewCapableScans;

  const currentReviews = allReviews.filter((r) => {
    const d = new Date(r.createdAt);
    return d >= periodStart && d <= periodEnd;
  });
  const prevReviews = allReviews.filter((r) => {
    const d = new Date(r.createdAt);
    return d >= prevPeriodStart && d <= prevPeriodEnd;
  });

  const stats = {
    totalReviews: currentReviews.length,
    avgRating:
      currentReviews.length > 0
        ? +(
            currentReviews.reduce((a, r) => a + r.rating, 0) /
            currentReviews.length
          ).toFixed(1)
        : 0,
    positiveCount: currentReviews.filter((r) => !r.isNegative).length,
    negativeCount: currentReviews.filter((r) => r.isNegative).length,
    negativePercent:
      currentReviews.length > 0
        ? +(
            (currentReviews.filter((r) => r.isNegative).length /
              currentReviews.length) *
            100
          ).toFixed(1)
        : 0,
    totalScans,
    reviewCapableScans,
    otherScans,
    conversionRate:
      reviewCapableScans > 0
        ? +((currentReviews.length / reviewCapableScans) * 100).toFixed(1)
        : 0,
  };

  const prevStats = {
    totalReviews: prevReviews.length,
    avgRating:
      prevReviews.length > 0
        ? +(
            prevReviews.reduce((a, r) => a + r.rating, 0) /
            prevReviews.length
          ).toFixed(1)
        : 0,
    negativePercent:
      prevReviews.length > 0
        ? +(
            (prevReviews.filter((r) => r.isNegative).length /
              prevReviews.length) *
            100
          ).toFixed(1)
        : 0,
  };

  const dailyMap: Record<
    string,
    { count: number; negative: number; ratingSum: number }
  > = {};
  for (let i = 0; i <= days; i++) {
    const d = new Date(periodStart);
    d.setDate(d.getDate() + i);
    const key = localDateKey(d);
    if (!dailyMap[key])
      dailyMap[key] = { count: 0, negative: 0, ratingSum: 0 };
  }
  currentReviews.forEach((r) => {
    const day = localDateKey(new Date(r.createdAt));
    if (!dailyMap[day])
      dailyMap[day] = { count: 0, negative: 0, ratingSum: 0 };
    dailyMap[day].count++;
    dailyMap[day].ratingSum += r.rating;
    if (r.isNegative) dailyMap[day].negative++;
  });

  const dailyReviews = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      count: d.count,
      negative: d.negative,
      avgRating: d.count > 0 ? +(d.ratingSum / d.count).toFixed(1) : 0,
    }));

  const dailyScanMap: Record<string, number> = {};
  for (let i = 0; i <= days; i++) {
    const d = new Date(periodStart);
    d.setDate(d.getDate() + i);
    dailyScanMap[localDateKey(d)] = 0;
  }
  periodScanRecords.forEach((s) => {
    const day = localDateKey(s.createdAt);
    dailyScanMap[day] = (dailyScanMap[day] ?? 0) + 1;
  });
  const dailyScans = Object.entries(dailyScanMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const scanDayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const scanDowMap: Record<number, number> = {};
  const scanHourMap: Record<number, number> = {};
  periodScanRecords.forEach((s) => {
    const dow = s.createdAt.getDay();
    const dowIdx = dow === 0 ? 6 : dow - 1;
    scanDowMap[dowIdx] = (scanDowMap[dowIdx] || 0) + 1;
    const hour = s.createdAt.getHours();
    scanHourMap[hour] = (scanHourMap[hour] || 0) + 1;
  });
  const scanDayOfWeekStats = scanDayNames.map((day, i) => ({
    day,
    count: scanDowMap[i] || 0,
  }));
  const scanHourStats = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    count: scanHourMap[hour] || 0,
  }));

  const ratingDistribution = [1, 2, 3, 4, 5].map((r) => ({
    rating: r,
    count: currentReviews.filter((rev) => rev.rating === r).length,
  }));

  const dayNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const dowMap: Record<number, number> = {};
  currentReviews.forEach((r) => {
    const dow = new Date(r.createdAt).getDay();
    dowMap[dow] = (dowMap[dow] || 0) + 1;
  });
  const dayOfWeekStats = Array.from({ length: 7 }, (_, i) => ({
    day: dayNames[i],
    count: dowMap[i] || 0,
  }));

  const topEstablishments = filteredEstablishments
    .map((e) => {
      const reviews = e.reviews.filter((r) => {
        const d = new Date(r.createdAt);
        return d >= periodStart && d <= periodEnd;
      });
      return {
        id: e.id,
        name: e.name,
        reviews: reviews.length,
        avgRating:
          reviews.length > 0
            ? +(
                reviews.reduce((a, r) => a + r.rating, 0) / reviews.length
              ).toFixed(1)
            : 0,
      };
    })
    .filter((e) => e.reviews > 0)
    .sort((a, b) => b.reviews - a.reviews);

  const recentReviews = currentReviews.slice(0, 50).map((r) => {
    const est = filteredEstablishments.find((e) => e.id === r.establishmentId);
    return {
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      guestName: r.guestName,
      isNegative: r.isNegative,
      createdAt: r.createdAt.toISOString(),
      establishmentName: est?.name || "",
    };
  });

  const periodReviews = currentReviews.map((r) => {
    const est = filteredEstablishments.find((e) => e.id === r.establishmentId);
    return {
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      guestName: r.guestName,
      isNegative: r.isNegative,
      createdAt: r.createdAt.toISOString(),
      establishmentName: est?.name || "",
    };
  });

  const qrcodes = [
    ...filteredEstablishments.flatMap((e) =>
      e.qrcodes
        .filter((q) => !qrCodeId || q.id === qrCodeId)
        .map((q) => ({
          id: q.id,
          code: q.code,
          label: q.label,
          mode: q.mode,
          establishmentId: e.id,
          establishmentName: e.name,
        }))
    ),
    ...filteredOrphanQrs.map((q) => ({
      id: q.id,
      code: q.code,
      label: q.label,
      mode: q.mode,
      establishmentId: ORPHAN_ESTABLISHMENT_FILTER,
      establishmentName: ORPHAN_ESTABLISHMENT_LABEL,
    })),
  ];

  const qrMeta = new Map(qrcodes.map((q) => [q.id, q]));

  const qrScanCounts: Record<string, number> = {};
  periodScanRecords.forEach((s) => {
    qrScanCounts[s.qrCodeId] = (qrScanCounts[s.qrCodeId] || 0) + 1;
  });

  const qrReviewCounts: Record<string, number> = {};
  currentReviews.forEach((r) => {
    if (r.qrCodeId) {
      qrReviewCounts[r.qrCodeId] = (qrReviewCounts[r.qrCodeId] || 0) + 1;
    }
  });

  const qrcodesWithStats = qrcodes.map((q) => {
    const scansCount = qrScanCounts[q.id] || 0;
    const reviewsCount = qrReviewCounts[q.id] || 0;
    return {
      ...q,
      scansCount,
      reviewsCount,
      conversionRate:
        scansCount > 0 && (q.mode === "REVIEW" || q.mode === "LANDING")
          ? +((reviewsCount / scansCount) * 100).toFixed(1)
          : 0,
    };
  });

  const establishmentScans = [
    ...filteredEstablishments.map((e) => {
      const estQrs = e.qrcodes.filter((q) => !qrCodeId || q.id === qrCodeId);
      const estQrIds = new Set(estQrs.map((q) => q.id));
      const estPeriodScans = periodScanRecords.filter((s) => estQrIds.has(s.qrCodeId));
      const estScans = estPeriodScans.length;
      const estReviewCapableScans = estPeriodScans.filter(
        (s) => s.qrCode.mode === "REVIEW" || s.qrCode.mode === "LANDING"
      ).length;
      const estReviews = currentReviews.filter((r) => r.establishmentId === e.id).length;
      return {
        id: e.id,
        name: e.name,
        scansCount: estScans,
        reviewsCount: estReviews,
        qrCount: estQrs.length,
        conversionRate:
          estReviewCapableScans > 0
            ? +((estReviews / estReviewCapableScans) * 100).toFixed(1)
            : 0,
      };
    }),
    ...(filteredOrphanQrs.length > 0
      ? [
          {
            id: ORPHAN_ESTABLISHMENT_FILTER,
            name: ORPHAN_ESTABLISHMENT_LABEL,
            scansCount: periodScanRecords.filter((s) =>
              filteredOrphanQrs.some((q) => q.id === s.qrCodeId)
            ).length,
            reviewsCount: 0,
            qrCount: filteredOrphanQrs.length,
            conversionRate: 0,
          },
        ]
      : []),
  ];

  const modeLabels: Record<string, string> = {
    LANDING: "Микро-лендинг",
    REVIEW: "Отзывы",
    MENU: "Меню",
    REDIRECT: "Редирект",
    BUSINESS_CARD: "Визитка",
    WIFI: "Wi-Fi",
    FILE: "Файл",
    TIPS: "Чаевые",
    FORM: "Форма",
    CUSTOM_SECTION: "Раздел",
  };
  const scansByMode = periodScanRecords.reduce<
    Record<string, { mode: string; label: string; scans: number; qrCount: number }>
  >((acc, s) => {
    const mode = s.qrCode.mode;
    if (!acc[mode]) {
      acc[mode] = {
        mode,
        label: modeLabels[mode] || mode,
        scans: 0,
        qrCount: 0,
      };
    }
    acc[mode].scans++;
    return acc;
  }, {});
  for (const q of allQrs) {
    if (!scansByMode[q.mode]) {
      scansByMode[q.mode] = {
        mode: q.mode,
        label: modeLabels[q.mode] || q.mode,
        scans: 0,
        qrCount: 0,
      };
    }
    scansByMode[q.mode].qrCount++;
  }

  const aggregateField = (field: "device" | "browser" | "region") => {
    const map: Record<string, number> = {};
    periodScanRecords.forEach((s) => {
      const value = (s[field] || "Неизвестно").trim() || "Неизвестно";
      map[value] = (map[value] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  };

  const periodScans = periodScanRecords.map((s) => {
    const meta = qrMeta.get(s.qrCodeId);
    return {
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      qrCodeId: s.qrCodeId,
      qrCode: s.qrCode.code,
      qrLabel: s.qrCode.label,
      mode: s.qrCode.mode,
      establishmentName: meta?.establishmentName || "",
      device: s.device || "Неизвестно",
      browser: s.browser || "Неизвестно",
      region: s.region || "Не определён",
    };
  });

  return NextResponse.json({
    period: { label: fromParam && toParam ? "custom" : periodParam, days },
    stats,
    previousPeriod: {
      ...prevStats,
      totalScans: prevPeriodScanCount,
    },
    dailyReviews,
    dailyScans,
    scanDayOfWeekStats,
    scanHourStats,
    ratingDistribution,
    dayOfWeekStats,
    topEstablishments,
    recentReviews,
    periodReviews,
    periodScans,
    deviceStats: aggregateField("device"),
    browserStats: aggregateField("browser"),
    regionStats: aggregateField("region"),
    qrcodes: qrcodesWithStats,
    establishmentScans,
    scansByMode: Object.values(scansByMode).sort((a, b) => b.scans - a.scans),
    establishments: [
      ...establishments.map((e) => ({
        id: e.id,
        name: e.name,
      })),
      ...(orphanQrcodes.length > 0
        ? [{ id: ORPHAN_ESTABLISHMENT_FILTER, name: ORPHAN_ESTABLISHMENT_LABEL }]
        : []),
    ],
  });
}
