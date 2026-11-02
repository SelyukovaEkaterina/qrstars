import { NextResponse } from "next/server";
import { collectClientInfo } from "@/lib/client-info";
import { sendBusinessCardContactNotification } from "@/lib/messenger-contact-notify";
import prisma from "@/lib/prisma";
import { saveBusinessCardLead } from "@/lib/business-card-leads";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  // Rate limit: 5 сообщений в 10 минут с одного IP
  const ip = getClientIp(request);
  const rl = rateLimit(`bcard-contact:${ip}`, 5, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком много сообщений. Попробуйте позже." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const body = await request.json();
  const { qrCode, guestName, guestPhone, message, pdConsentGiven } = body as {
    qrCode?: string;
    guestName?: string;
    guestPhone?: string;
    message?: string;
    pdConsentGiven?: boolean;
  };

  if (!qrCode?.trim()) {
    return NextResponse.json({ error: "QR-код не указан" }, { status: 400 });
  }

  const name = guestName?.trim();
  const phone = typeof guestPhone === "string" ? guestPhone.trim().slice(0, 40) : "";
  const text = message?.trim();

  if (!name) {
    return NextResponse.json({ error: "Укажите ваше имя" }, { status: 400 });
  }

  if (!text || text.length < 2) {
    return NextResponse.json({ error: "Сообщение слишком короткое" }, { status: 400 });
  }

  if (text.length > 2000) {
    return NextResponse.json({ error: "Сообщение слишком длинное (макс. 2000 символов)" }, { status: 400 });
  }

  const qr = await prisma.qRCode.findUnique({
    where: { code: qrCode.trim() },
    include: {
      businessCard: {
        include: { contactMessenger: true },
      },
      establishment: {
        select: { id: true, businessCard: { include: { contactMessenger: true } } },
      },
    },
  });

  // Как на странице скана (resolveBusinessCard): визитка проекта, иначе legacy-визитка QR.
  const card = qr?.establishment?.businessCard ?? qr?.businessCard ?? null;

  if (!qr || !qr.isActive || qr.mode !== "BUSINESS_CARD" || !card) {
    return NextResponse.json({ error: "Визитка не найдена" }, { status: 404 });
  }

  if (!card.contactEnabled) {
    return NextResponse.json({ error: "Связь отключена" }, { status: 403 });
  }

  if (!card.contactMessenger) {
    return NextResponse.json({ error: "Канал связи не настроен" }, { status: 503 });
  }

  const client = await collectClientInfo(request);
  const qrLabel = qr.label?.trim() || qr.code;

  // Сначала сохраняем в кабинет: если Telegram/MAX/SMTP недоступны, заявка не теряется.
  let savedLeadId: string | null = null;
  if (qr.establishment?.id) {
    try {
      const xff = request.headers.get("x-forwarded-for") ?? "";
      savedLeadId = await saveBusinessCardLead({
        establishmentId: qr.establishment.id,
        qrCodeId: qr.id,
        guestName: name.slice(0, 100),
        guestPhone: phone || null,
        message: text,
        guestIp: xff.split(",")[0]?.trim().slice(0, 60) || null,
        userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
        pdConsentGiven: pdConsentGiven === true,
      });
    } catch (err) {
      console.error("Business card lead save failed", err);
    }
  }

  const sent = await sendBusinessCardContactNotification(card.contactMessenger, {
    qrLabel,
    guestName: name,
    guestPhone: phone || undefined,
    message: text,
    client,
  });

  if (!sent) {
    if (savedLeadId) {
      console.error("Business card lead notification failed", { leadId: savedLeadId, qr: qr.code });
    } else {
      return NextResponse.json({ error: "Не удалось отправить сообщение" }, { status: 502 });
    }
  }

  return NextResponse.json({ success: true });
}
