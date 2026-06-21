import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { analyticsCohortUserWhere } from "@/lib/analytics-exclusion";
import { estimateSubscriptionMonthlyRevenue } from "@/lib/plans";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const cohortUserWhere = analyticsCohortUserWhere();

  const [
    totalUsers,
    totalEstablishments,
    totalReviews,
    totalQRCodes,
    negativeReviews,
    recentUsers,
    paidSubscriptions,
  ] = await Promise.all([
    prisma.user.count({ where: cohortUserWhere }),
    prisma.establishment.count(),
    prisma.review.count(),
    prisma.qRCode.count(),
    prisma.review.count({ where: { isNegative: true } }),
    prisma.user.findMany({
      where: cohortUserWhere,
      take: 10,
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true, createdAt: true, role: true },
    }),
    prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        plan: { in: ["PRO", "NETWORK"] },
      },
      include: {
        user: {
          include: {
            _count: { select: { establishments: true } },
          },
        },
      },
    }),
  ]);

  const activeSubscriptions = paidSubscriptions.length;
  const monthlyRevenue = paidSubscriptions.reduce(
    (sum, s) =>
      sum +
      estimateSubscriptionMonthlyRevenue(
        s.plan,
        s.user._count.establishments
      ),
    0
  );

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date(thirtyDaysAgo);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 30);

  const [usersLast30, usersPrev30, reviewsLast30, reviewsPrev30] = await Promise.all([
    prisma.user.count({ where: { ...cohortUserWhere, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.user.count({
      where: { ...cohortUserWhere, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
    }),
    prisma.review.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.review.count({
      where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
    }),
  ]);

  const avgRating = await prisma.review.aggregate({ _avg: { rating: true } });

  return NextResponse.json({
    totalUsers,
    totalEstablishments,
    totalReviews,
    totalQRCodes,
    activeSubscriptions,
    negativeReviews,
    avgRating: avgRating._avg.rating ? +avgRating._avg.rating.toFixed(1) : null,
    usersLast30,
    usersPrev30,
    reviewsLast30,
    reviewsPrev30,
    recentUsers,
    monthlyRevenue,
  });
}
