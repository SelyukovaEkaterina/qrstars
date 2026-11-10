import { after, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
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
import { parseReviewInput } from "@/lib/review-input";
import { getAppBaseUrl } from "@/lib/utils";

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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const parsed = parseReviewInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { establishmentId, qrCodeId, rating, comment, guestName, guestPhone, isNegative, pdConsentGiven } =
    parsed.data;

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
  let qrLabel: string | null = null;
  if (qrCodeId) {
    const qr = await prisma.qRCode.findFirst({
      where: { id: qrCodeId, establishmentId },
      select: { id: true, label: true, code: true },
    });
    if (!qr) {
      return NextResponse.json({ error: "QR-код не найден" }, { status: 404 });
    }
    qrLabel = qr.label || qr.code;
  }

  const consentIp = getClientIp(request);
  const review = await prisma.review.create({
    data: {
      establishment: { connect: { id: establishmentId } },
      ...(qrCodeId ? { qrCode: { connect: { id: qrCodeId } } } : {}),
      rating,
      comment,
      guestName,
      guestPhone,
      isNegative,
      ...(pdConsentGiven && guestPhone ? { pdConsentAt: new Date(), pdConsentIp: consentIp } : {}),
    },
    include: { establishment: { include: { user: true } } },
  });

  // Уведомления — после ответа: раньше гость ждал письмо, Telegram (2–8 с на
  // подключение), MAX и SMS по очереди и видел «Отправляем…» до 10+ секунд.
  // Жалоба к этому моменту уже в кабинете, сбой канала её не теряет.
  if (isNegative) {
    after(() =>
      notifyOwnerAboutComplaint(review, { rating, comment, guestName, guestPhone, qrLabel }).catch((err) =>
        console.error("Complaint notification failed", { reviewId: review.id, err })
      )
    );
  }

  return NextResponse.json({ success: true, reviewId: review.id });
}

type ReviewWithOwner = Prisma.ReviewGetPayload<{ include: { establishment: { include: { user: true } } } }>;

async function notifyOwnerAboutComplaint(
  review: ReviewWithOwner,
  details: {
    rating: number;
    comment: string | null;
    guestName: string | null;
    guestPhone: string | null;
    qrLabel: string | null;
  }
) {
  const { establishment } = review;
  const owner = establishment.user;
  const { rating, comment, guestName, guestPhone, qrLabel } = details;

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

  const messengerExtra = {
    guestContact: guestPhone || undefined,
    qrLabel: qrLabel || undefined,
    inboxUrl: `${getAppBaseUrl()}/dashboard/projects/${establishment.id}/inbox`,
  };

  const [emailTargets, telegramTargets, maxTargets] = await Promise.all([
    getEmailTargets(notifyFields, "reviews"),
    getTelegramTargets(notifyFields, "reviews"),
    getMaxTargets(notifyFields, "reviews"),
  ]);
  const emailTo = [...new Set((emailTargets.length ? emailTargets : [owner.email]).filter(Boolean))];

  const jobs: Promise<unknown>[] = [
    ...emailTo.map(async (to) => {
      const sent = await sendNegativeReviewNotification(
        to,
        establishment.name,
        rating,
        comment || "",
        guestName || undefined,
        guestPhone || undefined
      );
      if (!sent) {
        console.error("Complaint email was not delivered", {
          to,
          establishmentId: establishment.id,
          reviewId: review.id,
        });
      }
    }),
    ...telegramTargets.map((chatId) =>
      sendTelegramNotification(chatId, establishment.name, rating, comment || "", guestName || undefined, messengerExtra)
    ),
    ...maxTargets.map((maxUserId) =>
      sendMaxNotification(maxUserId, establishment.name, rating, comment || "", guestName || undefined, messengerExtra)
    ),
  ];

  if (process.env.SMS_RU_API_KEY && owner.phone) {
    jobs.push(
      fetch("https://sms.ru/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          api_id: process.env.SMS_RU_API_KEY,
          to: owner.phone,
          msg: `QrStars.ru: Негативный отзыв (${rating}★) от ${establishment.name}. Проверьте почту.`,
          json: "1",
        }),
      })
    );
  }

  await Promise.allSettled(jobs);
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

  const [reviews, total, ratingAgg, negativeTotal] = await Promise.all([
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
    prisma.review.aggregate({ where, _avg: { rating: true } }),
    negative === "false"
      ? Promise.resolve(0)
      : prisma.review.count({ where: { ...where, isNegative: true } }),
  ]);

  const page = Math.floor(offset / limit) + 1;
  const avg = ratingAgg._avg.rating;
  return NextResponse.json({
    reviews,
    total,
    page,
    pages: Math.ceil(total / limit),
    // Итоги по всему фильтру (а не по текущей странице)
    avgRating: avg == null ? null : Math.round(avg * 10) / 10,
    negativeTotal,
  });
}
