import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DEMO_ESTABLISHMENT_ID, demo2EstablishmentId } from "@/lib/demo-qrcodes";
import { sendNegativeReviewNotification } from "@/lib/mailer";
import { sendTelegramNotification } from "@/lib/telegram";
import { sendMaxNotification } from "@/lib/max";

export async function POST(request: Request) {
  const body = await request.json();
  const { establishmentId, qrCodeId, rating, comment, guestName, guestPhone, isNegative } = body;

  if (!establishmentId || !rating) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (establishmentId === DEMO_ESTABLISHMENT_ID || establishmentId === demo2EstablishmentId) {
    return NextResponse.json({ success: true, demo: true });
  }

  const review = await prisma.review.create({
    data: {
      establishment: { connect: { id: establishmentId } },
      ...(qrCodeId ? { qrCode: { connect: { id: qrCodeId } } } : {}),
      rating,
      comment: comment || null,
      guestName: guestName || null,
      guestPhone: guestPhone || null,
      isNegative,
    },
    include: { establishment: { include: { user: true } } },
  });

  if (isNegative) {
    const { establishment } = review;
    const owner = establishment.user;

    if (establishment.notificationEmailEnabled && establishment.notificationEmail) {
      await sendNegativeReviewNotification(
        establishment.notificationEmail,
        establishment.name,
        rating,
        comment || "",
        guestName || undefined
      );
    } else {
      await sendNegativeReviewNotification(
        owner.email,
        establishment.name,
        rating,
        comment || "",
        guestName || undefined
      );
    }

    if (establishment.notificationTelegramEnabled && establishment.notificationTelegramChatId) {
      await sendTelegramNotification(
        establishment.notificationTelegramChatId,
        establishment.name,
        rating,
        comment || "",
        guestName || undefined
      );
    }

    if (establishment.notificationMaxEnabled && establishment.notificationMaxUserId) {
      await sendMaxNotification(
        establishment.notificationMaxUserId,
        establishment.name,
        rating,
        comment || "",
        guestName || undefined
      );
    }

    if (process.env.SMS_RU_API_KEY && owner.phone) {
      try {
        await fetch("https://sms.ru/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            api_id: process.env.SMS_RU_API_KEY,
            to: owner.phone,
            msg: `QrStars.ru: Негативный отзыв (${rating}★) от ${establishment.name}. Проверьте почту.`,
            json: "1",
          }),
        });
      } catch {}
    }
  }

  return NextResponse.json({ success: true, reviewId: review.id });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const establishmentId = searchParams.get("establishmentId");
  const limit = parseInt(searchParams.get("limit") || "20");
  const pageParam = parseInt(searchParams.get("page") || "1");
  const offset = parseInt(searchParams.get("offset") || String((pageParam - 1) * limit));
  const negative = searchParams.get("negative");
  const rating = searchParams.get("rating");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const search = searchParams.get("search");

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let establishmentIds: string[] | undefined;

  if (establishmentId) {
    const est = await prisma.establishment.findFirst({
      where: { id: establishmentId, userId: session.user.id },
    });
    if (!est) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    establishmentIds = [establishmentId];
  } else {
    const userEstablishments = await prisma.establishment.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    });
    establishmentIds = userEstablishments.map((e) => e.id);
  }

  const where: Record<string, unknown> = { establishmentId: { in: establishmentIds } };
  if (rating) where.rating = parseInt(rating);
  if (negative === "true") where.isNegative = true;
  if (negative === "false") where.isNegative = false;

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
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        establishment: { select: { id: true, name: true } },
        qrCode: { select: { id: true, code: true, label: true } },
      },
    }),
    prisma.review.count({ where }),
  ]);

  const page = Math.floor(offset / limit) + 1;
  return NextResponse.json({ reviews, total, page, pages: Math.ceil(total / limit) });
}
