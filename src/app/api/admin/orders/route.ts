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
  const status = searchParams.get("status");
  const establishmentId = searchParams.get("establishmentId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const search = searchParams.get("search");
  const stats = searchParams.get("stats");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (establishmentId) where.establishmentId = establishmentId;

  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {};
    if (dateFrom) createdAt.gte = new Date(dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      createdAt.lte = to;
    }
    where.createdAt = createdAt;
  }

  if (search) {
    where.OR = [
      { guestName: { contains: search, mode: "insensitive" } },
      { guestPhone: { contains: search, mode: "insensitive" } },
      { guestEmail: { contains: search, mode: "insensitive" } },
      { comment: { contains: search, mode: "insensitive" } },
    ];
  }

  if (stats === "true") {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalOrders, newOrders, completedOrders, cancelledOrders, recentOrdersCount, recentOrders, topEstablishments] = await Promise.all([
      prisma.menuOrder.count({ where }),
      prisma.menuOrder.count({ where: { ...where, status: "NEW" } }),
      prisma.menuOrder.count({ where: { ...where, status: "COMPLETED" } }),
      prisma.menuOrder.count({ where: { ...where, status: "CANCELLED" } }),
      prisma.menuOrder.count({ where: { ...where, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.menuOrder.findMany({
        where: { ...where, createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true, total: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.menuOrder.groupBy({
        by: ["establishmentId"],
        where: { ...where, createdAt: { gte: thirtyDaysAgo } },
        _count: { id: true },
        _sum: { total: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
    ]);

    const estIds = topEstablishments.map((t) => t.establishmentId);
    const estNames = await prisma.establishment.findMany({
      where: { id: { in: estIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(estNames.map((e) => [e.id, e.name]));

    const dailyMap = new Map<string, { count: number; revenue: number }>();
    for (const o of recentOrders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      const d = dailyMap.get(key) || { count: 0, revenue: 0 };
      d.count++;
      d.revenue += o.total || 0;
      dailyMap.set(key, d);
    }

    const chartData = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { count, revenue }]) => ({ date, count, revenue: Math.round(revenue * 100) / 100 }));

    const topEst = topEstablishments.map((t) => ({
      establishmentId: t.establishmentId,
      name: nameMap.get(t.establishmentId) || "—",
      orderCount: t._count.id,
      revenue: t._sum.total || 0,
    }));

    const totalRevenueResult = await prisma.menuOrder.aggregate({
      where: { ...where, total: { not: null } },
      _sum: { total: true },
    });

    return NextResponse.json({
      stats: {
        totalOrders,
        newOrders,
        completedOrders,
        cancelledOrders,
        recentOrders: recentOrdersCount,
        totalRevenue: totalRevenueResult._sum.total || 0,
        chartData,
        topEstablishments: topEst,
      },
    });
  }

  const [orders, total] = await Promise.all([
    prisma.menuOrder.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        establishment: { select: { id: true, name: true, user: { select: { id: true, email: true, name: true } } } },
        qrCode: { select: { id: true, code: true, label: true } },
      },
    }),
    prisma.menuOrder.count({ where }),
  ]);

  return NextResponse.json({ orders, total, page, pages: Math.ceil(total / limit) });
}

export async function PATCH(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const { id, status } = body as { id?: string; status?: string };

  if (!id) return NextResponse.json({ error: "ID заказа обязателен" }, { status: 400 });

  const validStatuses = ["NEW", "ACCEPTED", "COMPLETED", "CANCELLED"];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Некорректный статус" }, { status: 400 });
  }

  const order = await prisma.menuOrder.update({
    where: { id },
    data: { status: status as "NEW" | "ACCEPTED" | "COMPLETED" | "CANCELLED" },
  });

  return NextResponse.json({ order });
}
