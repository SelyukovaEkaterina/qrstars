import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendMail } from "@/lib/mailer";
import { recordEmailDelivery, waitForSmtpBounce } from "@/lib/email-delivery";
import { sendMaxMessage } from "@/lib/max";
import prisma from "@/lib/prisma";
import { getMaxTargets, getTelegramTargets } from "@/lib/owner-messenger-notify";
import { reviewRoutingToJson, parseReviewRouting } from "@/lib/review-routing";
import { parseWorkingHours } from "@/lib/working-hours";
import { normalizeYandexMapsUrl, yandexMapsUrlError } from "@/lib/yandex-maps-url";
import {
  establishmentAccessWhere,
  establishmentHasPaidFeatures,
} from "@/lib/establishment-access";
import { getOwnerReportFlags } from "@/lib/owner-messenger-notify";
import { ownerHasMessengerProvider } from "@/lib/owner-messenger-notify";
import { rateLimit } from "@/lib/rate-limit";
import { parseEstablishmentIndustry } from "@/lib/establishment-industry";

const establishmentSelect = {
  id: true,
  name: true,
  industry: true,
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

  const [reportFlags, hasTelegram, hasMax] = await Promise.all([
    getOwnerReportFlags(userId),
    ownerHasMessengerProvider(userId, "TELEGRAM"),
    ownerHasMessengerProvider(userId, "MAX"),
  ]);

  return NextResponse.json({
    establishments,
    reportSettings: {
      ...reportFlags,
      hasTelegramContact: hasTelegram,
      hasMaxContact: hasMax,
    },
  });
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

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.industry !== undefined) {
    const industry = body.industry ? parseEstablishmentIndustry(body.industry) : null;
    if (body.industry && !industry) {
      return NextResponse.json({ error: "Некорректная отрасль" }, { status: 400 });
    }
    data.industry = industry;
  }
  if (body.address !== undefined) data.address = body.address || null;
  if (body.workingHours !== undefined) {
    data.workingHours = body.workingHours === null ? null : parseWorkingHours(body.workingHours);
  }
  if (body.phone !== undefined) data.phone = body.phone || null;
  if (body.legalName !== undefined) data.legalName = body.legalName || null;
  if (body.inn !== undefined) data.inn = body.inn || null;
  if (body.yandexMapsUrl !== undefined) {
    const trimmed = typeof body.yandexMapsUrl === "string" ? body.yandexMapsUrl.trim() : "";
    if (!trimmed) {
      data.yandexMapsUrl = null;
    } else {
      const yandexError = yandexMapsUrlError(trimmed);
      if (yandexError) {
        return NextResponse.json({ error: yandexError }, { status: 400 });
      }
      data.yandexMapsUrl = normalizeYandexMapsUrl(trimmed);
    }
  }
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

  if (body.reviewRouting !== undefined) {
    if (isPro) {
      data.reviewRouting = reviewRoutingToJson(parseReviewRouting(body.reviewRouting));
    } else if (Object.keys(data).length === 0) {
      // Явно меняют только сценарии — на FREE нельзя.
      // Если вместе с именем/адресом прилетел reviewRouting «эхом» с GET — игнорируем.
      return NextResponse.json(
        { error: "Настройка сценариев по звёздам доступна на PRO-тарифе" },
        { status: 403 }
      );
    }
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
    const userId = (session.user as Record<string, unknown>).id as string;
    const establishmentId =
      typeof body.establishmentId === "string" ? body.establishmentId : "";
    const contactId = typeof body.contactId === "string" ? body.contactId : "";
    if (!establishmentId || !contactId) {
      return NextResponse.json({ error: "Не выбран email-канал" }, { status: 400 });
    }

    const limited = rateLimit(`test-email:${userId}`, 5, 60 * 60_000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Лимит тестовых писем исчерпан. Повторите позже." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
      );
    }

    const [establishment, contact] = await Promise.all([
      prisma.establishment.findFirst({
        where: { id: establishmentId, ...establishmentAccessWhere(userId) },
        select: { name: true },
      }),
      prisma.messengerContact.findFirst({
        where: { id: contactId, userId, provider: "EMAIL" },
        select: { externalId: true },
      }),
    ]);
    if (!establishment || !contact) {
      return NextResponse.json({ error: "Email-канал не найден" }, { status: 404 });
    }

    const safeName = establishment.name
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    try {
      const sent = await sendMail(
        contact.externalId,
        `Тестовое уведомление QrStars.ru — ${establishment.name}`,
        `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4f46e5;">Тестовое уведомление</h2>
          <p>Email-уведомления настроены правильно для заведения <strong>${safeName}</strong>.</p>
          <p>Теперь негативные отзывы будут приходить на этот адрес.</p>
        </div>
        `,
        { kind: "test" }
      );
      if (!sent) {
        return NextResponse.json({ error: "Почтовый сервер не принял письмо" }, { status: 502 });
      }
      const bounce = await waitForSmtpBounce(contact.externalId, 8_000);
      if (bounce) {
        await recordEmailDelivery({
          to: contact.externalId,
          status: "bounced",
          kind: "test",
          error: bounce,
        });
        return NextResponse.json(
          { error: `Письмо не доставлено: ${bounce}` },
          { status: 502 }
        );
      }
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

  if (action === "update-report-settings") {
    const userId = (session.user as Record<string, unknown>).id as string;
    const data: { reportsEmailEnabled?: boolean; reportsTelegramEnabled?: boolean; reportsMaxEnabled?: boolean } = {};
    if (typeof body.reportsEmailEnabled === "boolean") data.reportsEmailEnabled = body.reportsEmailEnabled;
    if (typeof body.reportsTelegramEnabled === "boolean") data.reportsTelegramEnabled = body.reportsTelegramEnabled;
    if (typeof body.reportsMaxEnabled === "boolean") data.reportsMaxEnabled = body.reportsMaxEnabled;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    await prisma.user.update({ where: { id: userId }, data });
    const flags = await getOwnerReportFlags(userId);
    return NextResponse.json({ ok: true, reportSettings: flags });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
