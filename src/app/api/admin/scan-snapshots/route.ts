import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";

/**
 * Readonly-инспекция дневных снапшотов сканов (DailyScanStat) для дебага.
 * Доступ: только ADMIN.
 * Параметры: `qrCodeId` (последние N строк конкретного QR) или `date` (ISO полночь МСК)
 *            или `days=7` — последние N дней по всем QR (агрегат по дате).
 */
export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const qrCodeId = searchParams.get("qrCodeId");
  const dateIso = searchParams.get("date");
  const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10) || 30, 200);

  if (qrCodeId) {
    const rows = await prisma.dailyScanStat.findMany({
      where: { qrCodeId },
      orderBy: { date: "desc" },
      take: limit,
    });
    return NextResponse.json({ qrCodeId, rows });
  }

  if (dateIso) {
    const date = new Date(dateIso);
    const rows = await prisma.dailyScanStat.findMany({
      where: { date },
      orderBy: { count: "desc" },
      take: limit,
    });
    return NextResponse.json({ date: dateIso, rows });
  }

  // По умолчанию: агрегат сканов по дням за последние N дней (сумма count).
  const days = Math.min(parseInt(searchParams.get("days") || "14", 10) || 14, 90);
  const from = new Date(Date.now() - days * 86_400_000);
  const groups = await prisma.dailyScanStat.groupBy({
    by: ["date"],
    where: { date: { gte: from } },
    _sum: { count: true },
    orderBy: { date: "desc" },
    take: days,
  });
  return NextResponse.json({ days, groups });
}
