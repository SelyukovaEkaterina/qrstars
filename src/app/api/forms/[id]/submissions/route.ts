import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { establishmentAccessWhere } from "@/lib/establishment-access";
import { lockedSubmissionIds, maskLockedSubmission } from "@/lib/form-limits";

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
    include: {
      fields: { orderBy: { order: "asc" } },
      establishment: { select: { userId: true } },
    },
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

  const locked = await lockedSubmissionIds(
    form.establishment.userId,
    submissions.map((s) => ({ id: s.id, createdAt: s.createdAt, formPreset: form.preset }))
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { establishment, ...formPublic } = form;

  return NextResponse.json({
    form: formPublic,
    submissions: submissions.map((s) => maskLockedSubmission(s, locked)),
  });
}
