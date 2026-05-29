import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import {
  Users,
  Store,
  Star,
  CreditCard,
  TrendingUp,
  TrendingDown,
  QrCode,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { estimateSubscriptionMonthlyRevenue } from "@/lib/plans";

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") redirect("/admin/login");

  const [
    totalUsers,
    totalEstablishments,
    totalReviews,
    totalQRCodes,
    activeSubscriptions,
    negativeReviews,
    avgRatingResult,
    recentUsers,
    subscriptions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.establishment.count(),
    prisma.review.count(),
    prisma.qRCode.count(),
    prisma.subscription.count({
      where: { status: "ACTIVE", plan: { in: ["PRO", "NETWORK"] } },
    }),
    prisma.review.count({ where: { isNegative: true } }),
    prisma.review.aggregate({ _avg: { rating: true } }),
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true, createdAt: true },
    }),
    prisma.subscription.findMany({
      where: { status: "ACTIVE", plan: { in: ["PRO", "NETWORK"] } },
      include: {
        user: { include: { _count: { select: { establishments: true } } } },
      },
    }),
  ]);

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date(thirtyDaysAgo);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 30);

  const [usersLast30, usersPrev30, reviewsLast30, reviewsPrev30] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    prisma.review.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.review.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
  ]);

  const avgRating = avgRatingResult._avg.rating ? +avgRatingResult._avg.rating.toFixed(1) : null;
  const monthlyRevenue = subscriptions.reduce(
    (sum, s) =>
      sum +
      estimateSubscriptionMonthlyRevenue(
        s.plan,
        s.user._count.establishments
      ),
    0
  );

  const pct = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const stats = [
    {
      label: "Пользователи",
      value: totalUsers,
      icon: Users,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
      change: pct(usersLast30, usersPrev30),
      sub: `+${usersLast30} за 30 д.`,
    },
    {
      label: "Заведения",
      value: totalEstablishments,
      icon: Store,
      color: "text-green-400",
      bg: "bg-green-400/10",
      change: null,
      sub: "Всего",
    },
    {
      label: "Отзывы",
      value: totalReviews,
      icon: Star,
      color: "text-yellow-400",
      bg: "bg-yellow-400/10",
      change: pct(reviewsLast30, reviewsPrev30),
      sub: `+${reviewsLast30} за 30 д.`,
    },
    {
      label: "QR-коды",
      value: totalQRCodes,
      icon: QrCode,
      color: "text-purple-400",
      bg: "bg-purple-400/10",
      change: null,
      sub: "Создано всего",
    },
    {
      label: "PRO подписки",
      value: activeSubscriptions,
      icon: CreditCard,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
      change: null,
      sub: `${monthlyRevenue.toLocaleString("ru-RU")} ₽/мес`,
    },
    {
      label: "Ср. оценка",
      value: avgRating || "—",
      icon: Star,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      change: null,
      sub: "По всем отзывам",
    },
    {
      label: "Жалобы",
      value: negativeReviews,
      icon: AlertTriangle,
      color: "text-red-400",
      bg: "bg-red-400/10",
      change: null,
      sub: totalReviews > 0 ? `${Math.round((negativeReviews / totalReviews) * 100)}% от всех` : "—",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Обзор</h1>
            <p className="text-gray-400 mt-1">
              Добро пожаловать, {session.user.name || "Админ"}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-lg ${s.bg}`}>
                      <Icon className={`w-5 h-5 ${s.color}`} />
                    </div>
                    {s.change !== null && (
                      <span
                        className={`text-xs font-semibold flex items-center gap-0.5 ${
                          s.change >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {s.change >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {s.change >= 0 ? "+" : ""}
                        {s.change}%
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{s.sub}</p>
                  <p className="text-xs text-gray-600 mt-1">{s.label}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">
                  Новые пользователи
                </h2>
                <Link
                  href="/admin/users"
                  className="text-sm text-amber-400 hover:text-amber-300"
                >
                  Все →
                </Link>
              </div>
              <div className="space-y-3">
                {recentUsers.length === 0 ? (
                  <p className="text-gray-500 text-sm">Пока никого нет</p>
                ) : (
                  recentUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">
                          {u.name || "Без имени"}
                        </p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                      <p className="text-xs text-gray-600">
                        {new Date(u.createdAt).toLocaleDateString("ru-RU")}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Быстрые ссылки
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { href: "/admin/users", label: "Пользователи", icon: Users },
                  { href: "/admin/payments", label: "Подписки", icon: CreditCard },
                  { href: "/admin/reviews", label: "Отзывы", icon: Star },
                  { href: "/admin/establishments", label: "Заведения", icon: Store },
                ].map((l) => {
                  const Icon = l.icon;
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg text-gray-300 hover:text-white hover:bg-gray-750 transition-colors border border-gray-700"
                    >
                      <Icon className="w-5 h-5 text-amber-400" />
                      <span className="text-sm font-medium">{l.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
  );
}
