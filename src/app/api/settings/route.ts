import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendMail } from "@/lib/mailer";
import { sendMaxMessage } from "@/lib/max";
import prisma from "@/lib/prisma";
import { getMaxTargets, getTelegramTargets } from "@/lib/owner-messenger-notify";
import { reviewRoutingToJson, parseReviewRouting } from "@/lib/review-routing";
import { parseWorkingHours } from "@/lib/working-hours";
import {
  establishmentAccessWhere,
  establishmentHasPaidFeatures,
} from "@/lib/establishment-access";

const establishmentSelect = {
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
  reviewRouting: true,
  notificationEmail: true,
  notificationEmailEnabled: true,
  notificationEmailRequestsEnabled: true,
  notificationTelegramChatId: true,
  notificationTelegramEnabled: true,
  notificationTelegramRequestsEnabled: true,
  notificationMaxUserId: true,
  notificationMaxEnabled: true,
  notificationMaxRequestsEnabled: true,
  legalName: true,
  inn: true,
  workingHours: true,
} as const;

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
      where: { id: establishmentId, ...establishmentAccessWhere(userId) },
      select: establishmentSelect,
    });

    if (!establishment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ establishment });
  }

  const establishments = await prisma.establishment.findMany({
    where: establishmentAccessWhere(userId),
    select: establishmentSelect,
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
    where: { id: body.id, ...establishmentAccessWhere(userId) },
  });

  if (!establishment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isPro = await establishmentHasPaidFeatures(body.id);

  if (body.reviewRouting !== undefined && !isPro) {
    return NextResponse.json(
      { error: "Настройка сценариев по звёздам доступна на PRO-тарифе" },
      { status: 403 }
    );
  }

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.address !== undefined) data.address = body.address || null;
  if (body.workingHours !== undefined) {
    data.workingHours = body.workingHours === null ? null : parseWorkingHours(body.workingHours);
  }
  if (body.phone !== undefined) data.phone = body.phone || null;
  if (body.legalName !== undefined) data.legalName = body.legalName || null;
  if (body.inn !== undefined) data.inn = body.inn || null;
  if (body.yandexMapsUrl !== undefined) data.yandexMapsUrl = body.yandexMapsUrl || null;
  if (body.twoGisUrl !== undefined) data.twoGisUrl = body.twoGisUrl || null;
  if (body.avitoUrl !== undefined) data.avitoUrl = body.avitoUrl || null;
  if (body.platformRotation !== undefined) data.platformRotation = body.platformRotation;
  if (body.watermarkEnabled !== undefined) data.watermarkEnabled = body.watermarkEnabled;
  if (body.tipsEnabled !== undefined) data.tipsEnabled = body.tipsEnabled;
  if (body.notificationEmail !== undefined) data.notificationEmail = body.notificationEmail || null;
  if (body.notificationEmailEnabled !== undefined) {
    data.notificationEmailEnabled = body.notificationEmailEnabled;
  }
  if (body.notificationEmailRequestsEnabled !== undefined) {
    data.notificationEmailRequestsEnabled = body.notificationEmailRequestsEnabled;
  }
  if (body.notificationTelegramChatId !== undefined) {
    data.notificationTelegramChatId = body.notificationTelegramChatId || null;
  }
  if (body.notificationTelegramEnabled !== undefined) {
    data.notificationTelegramEnabled = body.notificationTelegramEnabled;
  }
  if (body.notificationTelegramRequestsEnabled !== undefined) {
    data.notificationTelegramRequestsEnabled = body.notificationTelegramRequestsEnabled;
  }
  if (body.notificationMaxUserId !== undefined) {
    data.notificationMaxUserId = body.notificationMaxUserId || null;
  }
  if (body.notificationMaxEnabled !== undefined) {
    data.notificationMaxEnabled = body.notificationMaxEnabled;
  }
  if (body.notificationMaxRequestsEnabled !== undefined) {
    data.notificationMaxRequestsEnabled = body.notificationMaxRequestsEnabled;
  }
  if (isPro && body.reviewRouting !== undefined) {
    data.reviewRouting = reviewRoutingToJson(parseReviewRouting(body.reviewRouting));
  }

  const updated = await prisma.establishment.update({
    where: { id: body.id },
    data,
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

    const userId = (session.user as Record<string, unknown>).id as string;
    let chatId = body.chatId as string | undefined;

    if (body.establishmentId) {
      const establishment = await prisma.establishment.findFirst({
        where: { id: body.establishmentId, ...establishmentAccessWhere(userId) },
        select: {
          userId: true,
          notificationTelegramEnabled: true,
          notificationTelegramRequestsEnabled: true,
          notificationTelegramChatId: true,
          notificationMaxEnabled: true,
          notificationMaxRequestsEnabled: true,
          notificationMaxUserId: true,
          notificationEmailEnabled: true,
          notificationEmailRequestsEnabled: true,
          notificationEmail: true,
        },
      });
      if (!establishment) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const targets = await getTelegramTargets(establishment);
      chatId = targets[0];
    }

    if (!chatId) {
      return NextResponse.json({ error: "Telegram не подключён в настройках аккаунта" }, { status: 400 });
    }

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "✅ Тестовое уведомление QrStars.ru\n\nTelegram подключён. Жалобы по этому заведению будут приходить сюда, если включены в настройках.",
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
    const userId = (session.user as Record<string, unknown>).id as string;
    let maxUserId = body.userId as string | undefined;

    if (body.establishmentId) {
      const establishment = await prisma.establishment.findFirst({
        where: { id: body.establishmentId, ...establishmentAccessWhere(userId) },
        select: {
          userId: true,
          notificationTelegramEnabled: true,
          notificationTelegramRequestsEnabled: true,
          notificationTelegramChatId: true,
          notificationMaxEnabled: true,
          notificationMaxRequestsEnabled: true,
          notificationMaxUserId: true,
          notificationEmailEnabled: true,
          notificationEmailRequestsEnabled: true,
          notificationEmail: true,
        },
      });
      if (!establishment) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const targets = await getMaxTargets(establishment);
      maxUserId = targets[0];
    }

    if (!maxUserId) {
      return NextResponse.json({ error: "MAX не подключён в настройках аккаунта" }, { status: 400 });
    }

    const sent = await sendMaxMessage(
      maxUserId,
      `✅ <b>Тестовое уведомление QrStars.ru</b>\n\nMAX подключён. Жалобы по этому заведению будут приходить сюда, если включены в настройках.`
    );
    if (sent) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Не удалось отправить сообщение в MAX" }, { status: 500 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
