import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { calcSubscriptionAmount } from "@/lib/plans";

export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const [subscriptions, total, activeProByBilling] = await Promise.all([
    prisma.subscription.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    }),
    prisma.subscription.count(),
    prisma.subscription.groupBy({
      by: ["billing"],
      where: { plan: "PRO", status: "ACTIVE" },
      _count: { _all: true },
    }),
  ]);

  const totalActivePro = activeProByBilling.reduce((sum, g) => sum + g._count._all, 0);
  const totalRevenue = activeProByBilling.reduce(
    (sum, g) =>
      sum + g._count._all * calcSubscriptionAmount("PRO", g.billing === "halfyear" ? "halfyear" : "yearly", 1),
    0
  );

  return NextResponse.json({
    subscriptions,
    total,
    page,
    pages: Math.ceil(total / limit),
    totalActivePro,
    totalRevenue,
  });
}
