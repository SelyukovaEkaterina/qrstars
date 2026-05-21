import { NextResponse } from "next/server";
import { collectClientInfo } from "@/lib/client-info";
import { sendBusinessCardContactNotification } from "@/lib/messenger-contact-notify";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();
  const { qrCode, guestName, message } = body as {
    qrCode?: string;
    guestName?: string;
    message?: string;
  };

  if (!qrCode?.trim()) {
    return NextResponse.json({ error: "QR-код не указан" }, { status: 400 });
  }

  const name = guestName?.trim();
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
    },
  });

  if (!qr || !qr.isActive || qr.mode !== "BUSINESS_CARD" || !qr.businessCard) {
    return NextResponse.json({ error: "Визитка не найдена" }, { status: 404 });
  }

  const card = qr.businessCard;

  if (!card.contactEnabled) {
    return NextResponse.json({ error: "Связь отключена" }, { status: 403 });
  }

  if (!card.contactMessenger) {
    return NextResponse.json({ error: "Канал связи не настроен" }, { status: 503 });
  }

  const client = await collectClientInfo(request);
  const qrLabel = qr.label?.trim() || qr.code;

  const sent = await sendBusinessCardContactNotification(card.contactMessenger, {
    qrLabel,
    guestName: name,
    message: text,
    client,
  });

  if (!sent) {
    return NextResponse.json({ error: "Не удалось отправить сообщение" }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
