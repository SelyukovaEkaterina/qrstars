import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const establishments = await prisma.establishment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, email: true, name: true } },
      _count: { select: { reviews: true, qrcodes: true, promocodes: true } },
      qrcodes: { select: { scansCount: true } },
    },
  });

  const result = establishments.map((e) => ({
    ...e,
    totalScans: e.qrcodes.reduce((a, q) => a + q.scansCount, 0),
    qrcodes: undefined,
  }));

  return NextResponse.json({ establishments: result });
}
