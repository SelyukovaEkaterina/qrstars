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

  // REJECTED и PAID — финальные: после отказа начисления уже вернулись
  // партнёру, повторное «одобрение» вывело бы их дважды.
  const NEXT: Record<string, string[]> = {
    PENDING: ["APPROVED", "REJECTED", "PAID"],
    APPROVED: ["REJECTED", "PAID"],
  };

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.partnerWithdrawal.findUnique({ where: { id }, select: { status: true } });
    if (!current) return { error: "Заявка не найдена", status: 404 } as const;
    if (!(NEXT[current.status] ?? []).includes(status)) {
      return { error: `Нельзя перевести заявку из ${current.status} в ${status}`, status: 409 } as const;
    }
    const updated = await tx.partnerWithdrawal.updateMany({
      where: { id, status: current.status },
      data: { status, adminComment: adminComment || null },
    });
    if (updated.count !== 1) return { error: "Заявка уже изменена — обновите страницу", status: 409 } as const;
    if (status === "REJECTED") {
      // Отказ — деньги снова доступны партнёру.
      await tx.partnerEarning.updateMany({
        where: { withdrawalId: id },
        data: { status: "AVAILABLE", withdrawalId: null },
      });
    }
    return { withdrawal: await tx.partnerWithdrawal.findUnique({ where: { id } }) } as const;
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ withdrawal: result.withdrawal });
}
