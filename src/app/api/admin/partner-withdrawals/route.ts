import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const skip = (page - 1) * limit;
  const statusFilter = searchParams.get("status") || "";

  const where = statusFilter ? { status: statusFilter as "PENDING" | "APPROVED" | "REJECTED" | "PAID" } : {};

  const [withdrawals, total, pendingCount] = await Promise.all([
    prisma.partnerWithdrawal.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    }),
    prisma.partnerWithdrawal.count({ where }),
    prisma.partnerWithdrawal.count({ where: { status: "PENDING" } }),
  ]);

  return NextResponse.json({ withdrawals, total, pages: Math.ceil(total / limit), pendingCount });
}

export async function PATCH(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const { id, status, adminComment } = body;

  if (!id || !status) {
    return NextResponse.json({ error: "id and status are required" }, { status: 400 });
  }

  const allowed = ["APPROVED", "REJECTED", "PAID"];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const withdrawal = await prisma.partnerWithdrawal.update({
    where: { id },
    data: { status, adminComment: adminComment || null },
  });

  return NextResponse.json({ withdrawal });
}
