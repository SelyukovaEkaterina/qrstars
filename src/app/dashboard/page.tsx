import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Sidebar from "@/components/dashboard/Sidebar";
import OverviewTabs from "@/components/dashboard/OverviewTabs";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Link from "next/link";
import { Star, MessageSquare, QrCode, TrendingUp, TrendingDown, ArrowUpRight, BarChart3, Store } from "lucide-react";
import {
  establishmentAccessWhere,
  canAccessAnalytics,
  orphanQrcodeWhere,
} from "@/lib/establishment-access";
import PlanBadge from "@/components/dashboard/PlanBadge";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as Record<string, unknown>).id as string;

  const [establishments, orphanQrcodes, subscription, analyticsAccess] = await Promise.all([
    prisma.establishment.findMany({
      where: establishmentAccessWhere(userId),
      include: {
        reviews: { orderBy: { createdAt: "desc" }, take: 5 },
        qrcodes: { select: { id: true, scansCount: true, label: true, isActive: true, code: true } },
        _count: { select: { reviews: true } },
      },
    }),
    prisma.qRCode.findMany({
      where: orphanQrcodeWhere(userId),
      select: { id: true, scansCount: true, label: true, isActive: true, code: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.subscription.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    }),
    canAccessAnalytics(userId),
  ]);

  const plan =
    subscription?.status === "ACTIVE" ? subscription.plan : "FREE";
  const isPro = analyticsAccess;

  const establishmentScans = establishments.reduce(
    (acc, e) => acc + e.qrcodes.reduce((a, q) => a + q.scansCount, 0),
    0
  );
  const orphanScans = orphanQrcodes.reduce((a, q) => a + q.scansCount, 0);
  const totalScans = establishmentScans + orphanScans;
  const totalReviews = establishments.reduce((acc, e) => acc + e._count.reviews, 0);

  const recentReviews = establishments.flatMap((e) =>
    e.reviews.map((r) => ({ ...r, establishmentName: e.name }))
  );

  const allReviews = establishments.flatMap((e) => e.reviews);
  const avgRating =
    totalReviews > 0
      ? (
          allReviews.reduce((acc, r) => acc + r.rating, 0) /
          allReviews.length
        ).toFixed(1)
      : "—";

  let reviewsLast30 = 0;
  let prevReviewsLast30 = 0;
  let avgRatingLast30 = "—";
  let prevAvgRating = 0;

  if (isPro) {
    const allReviewsFull = await prisma.review.findMany({
      where: {
        establishment: establishmentAccessWhere(userId),
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(thirtyDaysAgo);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 30);

    const last30 = allReviewsFull.filter(
      (r) => new Date(r.createdAt) >= thirtyDaysAgo
    );
    const prev30 = allReviewsFull.filter(
      (r) =>
        new Date(r.createdAt) >= sixtyDaysAgo &&
        new Date(r.createdAt) < thirtyDaysAgo
    );

    reviewsLast30 = last30.length;
    prevReviewsLast30 = prev30.length;
    avgRatingLast30 =
      last30.length > 0
        ? (
            last30.reduce((a, r) => a + r.rating, 0) / last30.length
          ).toFixed(1)
        : "—";
    prevAvgRating =
      prev30.length > 0
        ? prev30.reduce((a, r) => a + r.rating, 0) / prev30.length
        : 0;
  }

  const estStats = establishments.map((e) => {
    const eReviews = e.reviews;
    const eAvg =
      eReviews.length > 0
        ? (eReviews.reduce((a, r) => a + r.rating, 0) / eReviews.length).toFixed(1)
        : "—";
    const eScans = e.qrcodes.reduce((a, q) => a + q.scansCount, 0);
    const activeQRCodes = e.qrcodes.filter((q) => q.isActive);
    return {
      id: e.id,
      name: e.name,
      reviewsCount: e._count.reviews,
      avgRating: eAvg,
      scansCount: eScans,
      qrcodesCount: e.qrcodes.length,
      activeQRCodesCount: activeQRCodes.length,
      qrcodes: e.qrcodes,
    };
  });

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <OverviewTabs />

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Сводка</h1>
              <p className="text-gray-500 mt-1">
                Добро пожаловать, {session.user.name || "Владелец"}!
              </p>
            </div>
            <div className="flex items-center gap-3">
              <PlanBadge plan={plan} showChangeLink />
              {!isPro && (
                <Link
                  href="/dashboard/subscription"
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Сменить тариф
                </Link>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <QrCode className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totalScans}</p>
                  <p className="text-sm text-gray-500">Сканирований</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <Star className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{avgRating}</p>
                  <p className="text-sm text-gray-500">Средняя оценка</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totalReviews}</p>
                  <p className="text-sm text-gray-500">Отзывов</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Store className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{establishments.length}</p>
                  <p className="text-sm text-gray-500">Заведений</p>
                </div>
              </div>
            </Card>
          </div>

          {isPro && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Отзывов за 30 дней</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {reviewsLast30}
                    </p>
                  </div>
                  {prevReviewsLast30 > 0 && (
                    (() => {
                      const change = +(
                        ((reviewsLast30 - prevReviewsLast30) /
                          prevReviewsLast30) *
                        100
                      ).toFixed(0);
                      const isUp = change >= 0;
                      return (
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-0.5 ${
                            isUp
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {isUp ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {isUp ? "+" : ""}
                          {change}%
                        </span>
                      );
                    })()
                  )}
                </div>
              </Card>
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">
                      Ср. оценка (30 д.)
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold text-gray-900">
                        {avgRatingLast30}
                      </p>
                      {prevAvgRating > 0 && avgRatingLast30 !== "—" && (
                        (() => {
                          const diff = +(
                            parseFloat(String(avgRatingLast30)) - prevAvgRating
                          ).toFixed(1);
                          if (diff === 0) return null;
                          const isUp = diff > 0;
                          return (
                            <span
                              className={`text-xs font-semibold flex items-center gap-0.5 ${
                                isUp ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {isUp ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              {isUp ? "+" : ""}
                              {diff}
                            </span>
                          );
                        })()
                      )}
                    </div>
                  </div>
                </div>
              </Card>
              <Card className="flex items-center justify-center">
                <Link
                  href="/dashboard/analytics"
                  className="flex items-center gap-2 text-indigo-600 font-semibold hover:text-indigo-800 transition-colors"
                >
                  <BarChart3 className="w-5 h-5" />
                  Подробная аналитика &rarr;
                </Link>
              </Card>
            </div>
          )}

          {establishments.length === 0 && orphanQrcodes.length === 0 ? (
            <Card className="text-center py-12 space-y-4">
              <div className="text-5xl mb-2">📋</div>
              <h2 className="text-xl font-semibold text-gray-900">Пока нет заведений</h2>
              <p className="text-gray-500 max-w-md mx-auto">
                За пару минут создайте заведение и QR для сбора отзывов — без физической таблички.
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Link
                  href="/dashboard/start"
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  Настроить первый QR
                </Link>
              </div>
            </Card>
          ) : (
            <>
              {establishments.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Заведения</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {estStats.map((est) => (
                    <Card key={est.id}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Store className="w-5 h-5 text-indigo-600" />
                          <h3 className="font-semibold text-gray-900">{est.name}</h3>
                        </div>
                        <Link
                          href={`/dashboard/settings`}
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </Link>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-lg font-bold text-gray-900">{est.reviewsCount}</p>
                          <p className="text-xs text-gray-500">Отзывов</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-gray-900">{est.avgRating}</p>
                          <p className="text-xs text-gray-500">Ср. оценка</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-gray-900">{est.activeQRCodesCount}/{est.qrcodesCount}</p>
                          <p className="text-xs text-gray-500">QR-кодов</p>
                        </div>
                      </div>
                      {est.qrcodes.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs text-gray-400 mb-2">QR-коды:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {est.qrcodes.map((q) => (
                              <span
                                key={q.id}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                                  q.isActive
                                    ? "bg-green-50 text-green-700"
                                    : "bg-gray-50 text-gray-500"
                                }`}
                              >
                                {q.label || q.code}
                                <span className="text-[10px] opacity-70">
                                  ({q.scansCount})
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
              )}

              {orphanQrcodes.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">QR без заведения</h2>
                  <Card>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <QrCode className="w-5 h-5 text-indigo-600" />
                        <h3 className="font-semibold text-gray-900">Отдельные QR-коды</h3>
                      </div>
                      <Link
                        href="/dashboard/qrcodes"
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-center mb-3">
                      <div>
                        <p className="text-lg font-bold text-gray-900">{orphanScans}</p>
                        <p className="text-xs text-gray-500">Сканирований</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900">
                          {orphanQrcodes.filter((q) => q.isActive).length}/{orphanQrcodes.length}
                        </p>
                        <p className="text-xs text-gray-500">QR-кодов</p>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-400 mb-2">QR-коды:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {orphanQrcodes.map((q) => (
                          <span
                            key={q.id}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                              q.isActive
                                ? "bg-green-50 text-green-700"
                                : "bg-gray-50 text-gray-500"
                            }`}
                          >
                            {q.label || q.code}
                            <span className="text-[10px] opacity-70">
                              ({q.scansCount})
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {recentReviews.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Последние отзывы
                  </h2>
                  <Card padding="sm">
                    <div className="divide-y divide-gray-100">
                      {recentReviews.slice(0, 5).map((review) => (
                        <div key={review.id} className="px-4 py-3 flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-semibold text-sm">{review.rating}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 truncate">
                              {review.comment || "Без комментария"}
                            </p>
                            <p className="text-xs text-gray-400">
                              {review.establishmentName} &middot;{" "}
                              {new Date(review.createdAt).toLocaleDateString("ru-RU")}
                            </p>
                          </div>
                          <Badge variant={review.isNegative ? "danger" : "success"}>
                            {review.isNegative ? "Жалоба" : "Позитив"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
