import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_ESTABLISHMENT_ID } from "@/lib/demo-qrcodes";
import { sendNegativeReviewNotification } from "@/lib/mailer";
import { sendTelegramNotification } from "@/lib/telegram";
import { sendMaxNotification } from "@/lib/max";

export async function POST(request: Request) {
  const body = await request.json();
  const { establishmentId, qrCodeId, rating, comment, guestName, guestPhone, isNegative } = body;

  if (!establishmentId || !rating) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (establishmentId === DEMO_ESTABLISHMENT_ID) {
    return NextResponse.json({ success: true, demo: true });
  }

  const review = await prisma.review.create({
    data: {
      establishmentId,
      qrCodeId: qrCodeId || null,
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
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId required" }, { status: 400 });
  }

  const reviews = await prisma.review.findMany({
    where: { establishmentId },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  const total = await prisma.review.count({ where: { establishmentId } });

  return NextResponse.json({ reviews, total });
}
