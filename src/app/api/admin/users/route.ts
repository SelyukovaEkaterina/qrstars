import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        establishments: {
          select: { id: true, name: true, _count: { select: { reviews: true, qrcodes: true } } },
        },
        subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { establishments: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const result = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    role: u.role,
    createdAt: u.createdAt,
    establishmentsCount: u._count.establishments,
    establishments: u.establishments,
    subscription: u.subscriptions[0] || null,
  }));

  return NextResponse.json({ users: result, total, page, pages: Math.ceil(total / limit) });
}
