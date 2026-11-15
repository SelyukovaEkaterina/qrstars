import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { establishmentAccessWhere } from "@/lib/establishment-access";
import { submissionsToCsv, type FormFieldType } from "@/lib/form-config";
import { ownerHasUnlimitedForms } from "@/lib/form-limits";
import { logUserEvent } from "@/lib/user-events-server";

type RouteContext = { params: Promise<{ id: string }> };

const EXPORT_MAX_ROWS = 10_000;

/** Выгрузка заявок формы в CSV (Excel). Только PRO / «Сеть» владельца проекта. */
export async function GET(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as Record<string, unknown>).id as string;
  const { id } = await context.params;

  const form = await prisma.form.findFirst({
    where: { id, establishment: establishmentAccessWhere(userId) },
    include: {
      fields: { orderBy: { order: "asc" }, select: { id: true, label: true, type: true } },
      establishment: { select: { userId: true } },
    },
  });
  if (!form) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!(await ownerHasUnlimitedForms(form.establishment.userId))) {
    return NextResponse.json(
      { error: "Выгрузка заявок в CSV доступна на PRO", upgradeRequired: "PRO" },
      { status: 403 }
    );
  }

  const submissions = await prisma.formSubmission.findMany({
    where: { formId: id },
    orderBy: { createdAt: "asc" },
    take: EXPORT_MAX_ROWS,
    select: { createdAt: true, values: true, qrCode: { select: { label: true, code: true } } },
  });

  const csv = submissionsToCsv(
    form.fields.map((f) => ({ ...f, type: f.type as FormFieldType })),
    submissions.map((s) => ({
      createdAt: s.createdAt,
      values: (s.values ?? {}) as Record<string, unknown>,
      qrLabel: s.qrCode ? s.qrCode.label || s.qrCode.code : null,
    }))
  );

  logUserEvent(userId, "dash.form_exported", { formId: id, rows: submissions.length });

  const filename = `zayavki-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
