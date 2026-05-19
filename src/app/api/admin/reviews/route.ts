import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;
  const rating = searchParams.get("rating");
  const negative = searchParams.get("negative");
  const establishmentId = searchParams.get("establishmentId");
  const qrCodeId = searchParams.get("qrCodeId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (rating) where.rating = parseInt(rating);
  if (negative === "true") where.isNegative = true;
  if (negative === "false") where.isNegative = false;
  if (establishmentId) where.establishmentId = establishmentId;
  if (qrCodeId) where.qrCodeId = qrCodeId;

  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {};
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
      { comment: { contains: search, mode: "insensitive" } },
      { guestName: { contains: search, mode: "insensitive" } },
      { guestPhone: { contains: search, mode: "insensitive" } },
    ];
  }

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        establishment: { select: { id: true, name: true, user: { select: { id: true, email: true, name: true } } } },
        qrCode: { select: { id: true, code: true, label: true } },
      },
    }),
    prisma.review.count({ where }),
  ]);

  return NextResponse.json({ reviews, total, page, pages: Math.ceil(total / limit) });
}
