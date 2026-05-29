import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { establishmentAccessWhere } from "@/lib/establishment-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { id: establishmentId } = await context.params;

  const est = await prisma.establishment.findFirst({
    where: { id: establishmentId, ...establishmentAccessWhere(userId) },
    select: { id: true, name: true },
  });
  if (!est) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const formId = searchParams.get("formId");
  const unreadOnly = searchParams.get("unread") === "true";
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const search = searchParams.get("search")?.trim();
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const pageParam = parseInt(searchParams.get("page") || "1");
  const offset = (pageParam - 1) * limit;

  const where: Prisma.FormSubmissionWhereInput = {
    form: { establishmentId },
  };

  if (formId) where.formId = formId;
  if (unreadOnly) where.isRead = false;

  if (dateFrom || dateTo) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (dateFrom) createdAt.gte = new Date(dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      createdAt.lte = to;
    }
    where.createdAt = createdAt;
  }

  if (search) {
    where.OR = [
      { guestIp: { contains: search, mode: "insensitive" } },
      { form: { title: { contains: search, mode: "insensitive" } } },
      {
        qrCode: {
          OR: [
            { label: { contains: search, mode: "insensitive" } },
            { code: { contains: search, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  const [submissions, total, unreadCount, forms] = await Promise.all([
    prisma.formSubmission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        form: {
          select: {
            id: true,
            title: true,
            fields: { orderBy: { order: "asc" }, select: { id: true, label: true } },
          },
        },
        qrCode: { select: { id: true, code: true, label: true } },
      },
    }),
    prisma.formSubmission.count({ where }),
    prisma.formSubmission.count({
      where: { form: { establishmentId }, isRead: false },
    }),
    prisma.form.findMany({
      where: { establishmentId },
      select: { id: true, title: true, _count: { select: { submissions: true } } },
      orderBy: { title: "asc" },
    }),
  ]);

  const page = pageParam;
  return NextResponse.json({
    submissions,
    total,
    unreadCount,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    forms,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { id: establishmentId } = await context.params;
  const body = await request.json();
  const { submissionIds, markAllRead } = body as {
    submissionIds?: string[];
    markAllRead?: boolean;
  };

  const est = await prisma.establishment.findFirst({
    where: { id: establishmentId, ...establishmentAccessWhere(userId) },
    select: { id: true },
  });
  if (!est) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (markAllRead) {
    await prisma.formSubmission.updateMany({
      where: { form: { establishmentId }, isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ ok: true });
  }

  if (!submissionIds?.length) {
    return NextResponse.json({ error: "submissionIds required" }, { status: 400 });
  }

  await prisma.formSubmission.updateMany({
    where: {
      id: { in: submissionIds },
      form: { establishmentId },
    },
    data: { isRead: true },
  });

  return NextResponse.json({ ok: true });
}
