import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const batch = await prisma.activationBatch.findUnique({
    where: { id },
    include: {
      qrcodes: {
        select: { id: true, code: true, serialCode: true, isActive: true },
        orderBy: { serialCode: "asc" },
      },
    },
  });

  if (!batch) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ batch });
}
