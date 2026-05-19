import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendMail } from "@/lib/mailer";
import { sendMaxMessage } from "@/lib/max";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { searchParams } = new URL(request.url);
  const establishmentId = searchParams.get("id");

  if (establishmentId) {
    const establishment = await prisma.establishment.findFirst({
      where: { id: establishmentId, userId },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        yandexMapsUrl: true,
        twoGisUrl: true,
        avitoUrl: true,
        platformRotation: true,
        watermarkEnabled: true,
        tipsEnabled: true,
        notificationEmail: true,
        notificationEmailEnabled: true,
        notificationTelegramChatId: true,
        notificationTelegramEnabled: true,
        notificationMaxUserId: true,
        notificationMaxEnabled: true,
      },
    });

    if (!establishment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ establishment });
  }

  const establishments = await prisma.establishment.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      yandexMapsUrl: true,
      twoGisUrl: true,
      avitoUrl: true,
      platformRotation: true,
      watermarkEnabled: true,
      tipsEnabled: true,
      notificationEmail: true,
      notificationEmailEnabled: true,
      notificationTelegramChatId: true,
      notificationTelegramEnabled: true,
      notificationMaxUserId: true,
      notificationMaxEnabled: true,
    },
  });

  return NextResponse.json({ establishments });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();

  const establishment = await prisma.establishment.findFirst({
    where: { id: body.id, userId },
  });

  if (!establishment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.establishment.update({
    where: { id: body.id },
    data: {
      name: body.name,
      address: body.address || null,
      phone: body.phone || null,
      yandexMapsUrl: body.yandexMapsUrl || null,
      twoGisUrl: body.twoGisUrl || null,
      avitoUrl: body.avitoUrl || null,
      platformRotation: body.platformRotation ?? false,
      watermarkEnabled: body.watermarkEnabled ?? true,
      tipsEnabled: body.tipsEnabled ?? false,
      notificationEmail: body.notificationEmail || null,
      notificationEmailEnabled: body.notificationEmailEnabled ?? false,
      notificationTelegramChatId: body.notificationTelegramChatId || null,
      notificationTelegramEnabled: body.notificationTelegramEnabled ?? false,
      notificationMaxUserId: body.notificationMaxUserId || null,
      notificationMaxEnabled: body.notificationMaxEnabled ?? false,
    },
  });

  return NextResponse.json({ establishment: updated });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body;

  if (action === "test-telegram") {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN не настроен" }, { status: 400 });
    }

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: body.chatId,
            text: "✅ Тестовое уведомление QrStars.ru\n\nTelegram-уведомления настроены правильно. Теперь негативные отзывы будут приходить сюда.",
            parse_mode: "HTML",
          }),
        }
      );
      const result = await res.json();
      if (!result.ok) {
        return NextResponse.json({ error: result.description || "Ошибка Telegram API" }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "Не удалось отправить сообщение" }, { status: 500 });
    }
  }

  if (action === "test-email") {
    try {
      await sendMail(
        body.email,
        `Тестовое уведомление QrStars.ru — ${body.establishmentName}`,
        `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4f46e5;">Тестовое уведомление</h2>
          <p>Email-уведомления настроены правильно для заведения <strong>${body.establishmentName}</strong>.</p>
          <p>Теперь негативные отзывы будут приходить на этот адрес.</p>
        </div>
        `
      );
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "Не удалось отправить письмо" }, { status: 500 });
    }
  }

  if (action === "test-max") {
    const sent = await sendMaxMessage(
      body.userId,
      `✅ <b>Тестовое уведомление QrStars.ru</b>\n\nMAX-уведомления настроены правильно. Негативные отзывы будут приходить сюда.`
    );
    if (sent) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Не удалось отправить сообщение в MAX" }, { status: 500 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
