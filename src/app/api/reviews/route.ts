import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DEMO_ESTABLISHMENT_ID, demo2EstablishmentId } from "@/lib/demo-qrcodes";
import { sendNegativeReviewNotification } from "@/lib/mailer";
import { sendTelegramNotification } from "@/lib/telegram";
import { sendMaxNotification } from "@/lib/max";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { establishmentAccessWhere } from "@/lib/establishment-access";
import { getEmailTargets, getMaxTargets, getTelegramTargets } from "@/lib/owner-messenger-notify";

export async function POST(request: Request) {
  // Rate limit: 10 отзывов в минуту с одного IP
  const ip = getClientIp(request);
  const rl = rateLimit(`review:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком много запросов. Попробуйте позже." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const body = await request.json();
  const { establishmentId, qrCodeId, rating, comment, guestName, guestPhone, isNegative, pdConsentGiven } = body;

  if (!establishmentId || !rating) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Валидация rating
  if (typeof rating !== "number" || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Неверная оценка" }, { status: 400 });
  }

  if (establishmentId === DEMO_ESTABLISHMENT_ID || establishmentId === demo2EstablishmentId) {
    return NextResponse.json({ success: true, demo: true });
  }

  // Проверяем что заведение существует (защита от спама на несуществующие ID)
  const establishment = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    select: { id: true },
  });
  if (!establishment) {
    return NextResponse.json({ error: "Заведение не найдено" }, { status: 404 });
  }

  // Если передан qrCodeId — проверяем что он принадлежит этому заведению
  if (qrCodeId) {
    const qr = await prisma.qRCode.findFirst({
      where: { id: qrCodeId, establishmentId },
      select: { id: true },
    });
    if (!qr) {
      return NextResponse.json({ error: "QR-код не найден" }, { status: 404 });
    }
  }

  const consentIp = getClientIp(request);
  const review = await prisma.review.create({
    data: {
      establishment: { connect: { id: establishmentId } },
      ...(qrCodeId ? { qrCode: { connect: { id: qrCodeId } } } : {}),
      rating,
      comment: comment || null,
      guestName: guestName || null,
      guestPhone: guestPhone || null,
      isNegative,
      ...(pdConsentGiven && guestPhone ? { pdConsentAt: new Date(), pdConsentIp: consentIp } : {}),
    },
    include: { establishment: { include: { user: true } } },
  });

  if (isNegative) {
    const { establishment } = review;
    const owner = establishment.user;

    const notifyFields = {
      userId: establishment.userId,
      notificationTelegramEnabled: establishment.notificationTelegramEnabled,
      notificationTelegramRequestsEnabled: establishment.notificationTelegramRequestsEnabled,
      notificationTelegramChatId: establishment.notificationTelegramChatId,
      notificationMaxEnabled: establishment.notificationMaxEnabled,
      notificationMaxRequestsEnabled: establishment.notificationMaxRequestsEnabled,
      notificationMaxUserId: establishment.notificationMaxUserId,
      notificationEmailEnabled: establishment.notificationEmailEnabled,
      notificationEmailRequestsEnabled: establishment.notificationEmailRequestsEnabled,
      notificationEmail: establishment.notificationEmail,
    };

    const emailTargets = await getEmailTargets(notifyFields, "reviews");
    const emailTo = emailTargets[0] ?? owner.email;
    if (emailTo) {
      await sendNegativeReviewNotification(
        emailTo,
        establishment.name,
        rating,
        comment || "",
        guestName || undefined
      );
    }

    for (const chatId of await getTelegramTargets(notifyFields, "reviews")) {
      await sendTelegramNotification(
        chatId,
        establishment.name,
        rating,
        comment || "",
        guestName || undefined
      );
    }

    for (const maxUserId of await getMaxTargets(notifyFields, "reviews")) {
      await sendMaxNotification(
        maxUserId,
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
      where: { id: establishmentId, ...establishmentAccessWhere(session.user.id) },
    });
    if (!est) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    establishmentIds = [establishmentId];
  } else {
    const userEstablishments = await prisma.establishment.findMany({
      where: establishmentAccessWhere(session.user.id),
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
