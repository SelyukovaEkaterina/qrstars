import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  establishmentAccessWhere,
  canAccessAnalytics,
} from "@/lib/establishment-access";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const { searchParams } = new URL(request.url);
  const estIdParam = searchParams.get("establishmentId");

  if (!(await canAccessAnalytics(userId, estIdParam))) {
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

  const filteredEstablishments = estId
    ? establishments.filter((e) => e.id === estId)
    : establishments;

  const allReviews = filteredEstablishments.flatMap((e) =>
    qrCodeId
      ? e.reviews.filter((r) => r.qrCodeId === qrCodeId)
      : e.reviews
  );
  const allQrs = filteredEstablishments.flatMap((e) =>
    e.qrcodes.filter((q) => !qrCodeId || q.id === qrCodeId)
  );
  const totalScans = allQrs.reduce((a, q) => a + q.scansCount, 0);
  const reviewCapableScans = allQrs
    .filter((q) => q.mode === "REVIEW" || q.mode === "LANDING")
    .reduce((a, q) => a + q.scansCount, 0);
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
    const key = d.toISOString().split("T")[0];
    if (!dailyMap[key])
      dailyMap[key] = { count: 0, negative: 0, ratingSum: 0 };
  }
  currentReviews.forEach((r) => {
    const day = new Date(r.createdAt).toISOString().split("T")[0];
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

  const recentReviews = currentReviews.slice(0, 20).map((r) => {
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

  const qrcodes = filteredEstablishments.flatMap((e) =>
    e.qrcodes
      .filter((q) => !qrCodeId || q.id === qrCodeId)
      .map((q) => ({
        id: q.id,
        code: q.code,
        label: q.label,
        mode: q.mode,
        establishmentId: e.id,
        establishmentName: e.name,
        scansCount: q.scansCount,
      }))
  );

  const qrReviewCounts: Record<string, number> = {};
  allReviews.forEach((r) => {
    if (r.qrCodeId) {
      qrReviewCounts[r.qrCodeId] = (qrReviewCounts[r.qrCodeId] || 0) + 1;
    }
  });

  const qrcodesWithStats = qrcodes.map((q) => ({
    ...q,
    reviewsCount: qrReviewCounts[q.id] || 0,
    conversionRate:
      q.scansCount > 0
        ? +(((qrReviewCounts[q.id] || 0) / q.scansCount) * 100).toFixed(1)
        : 0,
  }));

  const establishmentScans = filteredEstablishments.map((e) => {
    const estQrs = e.qrcodes.filter((q) => !qrCodeId || q.id === qrCodeId);
    const estScans = estQrs.reduce((a, q) => a + q.scansCount, 0);
    const estReviewCapableScans = estQrs
      .filter((q) => q.mode === "REVIEW" || q.mode === "LANDING")
      .reduce((a, q) => a + q.scansCount, 0);
    const estReviews = allReviews.filter((r) => r.establishmentId === e.id).length;
    return {
      id: e.id,
      name: e.name,
      scansCount: estScans,
      reviewsCount: estReviews,
      qrCount: estQrs.length,
      conversionRate:
        estReviewCapableScans > 0 ? +((estReviews / estReviewCapableScans) * 100).toFixed(1) : 0,
    };
  });

  const modeLabels: Record<string, string> = {
    REVIEW: "Отзывы",
    REDIRECT: "Редирект",
    BUSINESS_CARD: "Визитка",
    WIFI: "Wi-Fi",
    FILE: "Файл",
  };
  const scansByMode = allQrs.reduce<Record<string, { mode: string; label: string; scans: number; qrCount: number }>>((acc, q) => {
    if (!acc[q.mode]) {
      acc[q.mode] = { mode: q.mode, label: modeLabels[q.mode] || q.mode, scans: 0, qrCount: 0 };
    }
    acc[q.mode].scans += q.scansCount;
    acc[q.mode].qrCount++;
    return acc;
  }, {});

  return NextResponse.json({
    period: { label: fromParam && toParam ? "custom" : periodParam, days },
    stats,
    previousPeriod: prevStats,
    dailyReviews,
    ratingDistribution,
    dayOfWeekStats,
    topEstablishments,
    recentReviews,
    qrcodes: qrcodesWithStats,
    establishmentScans,
    scansByMode: Object.values(scansByMode).sort((a, b) => b.scans - a.scans),
    establishments: filteredEstablishments.map((e) => ({
      id: e.id,
      name: e.name,
    })),
  });
}
