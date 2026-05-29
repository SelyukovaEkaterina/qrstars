import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const [subscriptions, total, totalActivePro] = await Promise.all([
    prisma.subscription.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    }),
    prisma.subscription.count(),
    prisma.subscription.count({ where: { plan: "PRO", status: "ACTIVE" } }),
  ]);

  return NextResponse.json({
    subscriptions,
    total,
    page,
    pages: Math.ceil(total / limit),
    totalActivePro,
    totalRevenue: totalActivePro * 990,
  });
}
