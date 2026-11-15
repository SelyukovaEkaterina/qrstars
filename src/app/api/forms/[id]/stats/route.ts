import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { establishmentAccessWhere } from "@/lib/establishment-access";
import type { FormFieldType } from "@/lib/form-config";
import { ownerHasUnlimitedForms } from "@/lib/form-limits";
import { dailyCounts, parseStatsPeriod, scanConversion, summarizeFormAnswers } from "@/lib/form-stats";

type RouteContext = { params: Promise<{ id: string }> };

/** Сколько ответов периода берём в разбивку по вопросам — защита от тяжёлых форм. */
const BREAKDOWN_MAX_ROWS = 5_000;

/**
 * Сводка по форме за 7 / 30 / 90 дней. FREE — число ответов, сравнение с прошлым
 * периодом и конверсия «скан → ответ»; PRO — ещё график по дням и разбивка по вопросам
 * (средняя оценка, NPS, варианты). Содержимое текстовых ответов сюда не попадает.
 */
export async function GET(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as Record<string, unknown>).id as string;
  const { id } = await context.params;
  const days = parseStatsPeriod(new URL(request.url).searchParams.get("days"));

  const form = await prisma.form.findFirst({
    where: { id, establishment: establishmentAccessWhere(userId) },
    include: {
      fields: { orderBy: { order: "asc" }, select: { id: true, label: true, type: true, options: true } },
      establishment: { select: { userId: true } },
    },
  });
  if (!form) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  const from = new Date(now.getTime() - days * 86_400_000);
  const prevFrom = new Date(from.getTime() - days * 86_400_000);

  const [total, current, previous, qrAgg, unlimited] = await Promise.all([
    prisma.formSubmission.count({ where: { formId: id } }),
    prisma.formSubmission.count({ where: { formId: id, createdAt: { gte: from } } }),
    prisma.formSubmission.count({ where: { formId: id, createdAt: { gte: prevFrom, lt: from } } }),
    prisma.qRCode.aggregate({ where: { formId: id }, _sum: { scansCount: true }, _count: true }),
    ownerHasUnlimitedForms(form.establishment.userId),
  ]);

  const scans = qrAgg._sum.scansCount ?? 0;
  const base = {
    days,
    total,
    current,
    previous,
    qrCount: qrAgg._count,
    scans,
    conversion: scanConversion(total, scans),
    unlimited,
  };

  if (!unlimited) {
    return NextResponse.json({ ...base, byDay: null, fields: null });
  }

  const rows = await prisma.formSubmission.findMany({
    where: { formId: id, createdAt: { gte: from } },
    orderBy: { createdAt: "desc" },
    take: BREAKDOWN_MAX_ROWS,
    select: { createdAt: true, values: true },
  });

  return NextResponse.json({
    ...base,
    byDay: dailyCounts(
      rows.map((r) => r.createdAt),
      days,
      now
    ),
    fields: summarizeFormAnswers(
      form.fields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type as FormFieldType,
        options: Array.isArray(f.options) ? (f.options as string[]) : null,
      })),
      rows.map((r) => (r.values ?? {}) as Record<string, unknown>)
    ),
    truncated: rows.length >= BREAKDOWN_MAX_ROWS,
  });
}
