import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { establishmentAccessWhere } from "@/lib/establishment-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

  const form = await prisma.form.findFirst({
    where: { id, establishment: establishmentAccessWhere(userId) },
    include: { fields: { orderBy: { order: "asc" } } },
  });
  if (!form) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const submissions = await prisma.formSubmission.findMany({
    where: { formId: id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { qrCode: { select: { id: true, code: true, label: true } } },
  });

  return NextResponse.json({ form, submissions });
}
