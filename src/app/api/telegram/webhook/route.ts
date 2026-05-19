import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function verifyTelegramWebhook() {
  return BOT_TOKEN;
}

async function sendMessage(chatId: number | string, text: string, parseMode?: string) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(parseMode ? { parse_mode: parseMode } : {}),
    }),
  });
}

async function setMyCommands() {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      commands: [
        { command: "start", description: "Привязать заведение" },
        { command: "stop", description: "Отвязать уведомления" },
        { command: "status", description: "Статус привязки" },
      ],
    }),
  });
}

export async function POST(request: Request) {
  if (!verifyTelegramWebhook()) {
    return NextResponse.json({ error: "Bot not configured" }, { status: 500 });
  }

  const body = await request.json();

  if (!body.message) {
    return NextResponse.json({ ok: true });
  }

  const { chat, text } = body.message;
  const chatId = chat.id;
  const incomingText = (text || "").trim();

  if (incomingText.startsWith("/start")) {
    await setMyCommands();
    const parts = incomingText.split(" ");
    const payload = parts[1];

    if (payload && payload.startsWith("link_mc_")) {
      const userId = payload.replace("link_mc_", "");

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true },
      });

      if (!user) {
        await sendMessage(
          chatId,
          "❌ Аккаунт не найден. Откройте привязку заново в личном кабинете QrStars.ru."
        );
        return NextResponse.json({ ok: true });
      }

      const label =
        [chat.first_name, chat.last_name].filter(Boolean).join(" ").trim() ||
        (chat.username ? `@${chat.username}` : "Telegram");

      const contact = await prisma.messengerContact.upsert({
        where: {
          userId_provider_externalId: {
            userId,
            provider: "TELEGRAM",
            externalId: String(chatId),
          },
        },
        create: {
          userId,
          provider: "TELEGRAM",
          externalId: String(chatId),
          label,
        },
        update: { label },
      });

      await sendMessage(
        chatId,
        `✅ <b>Telegram-контакт добавлен!</b>\n\n` +
          `Контакт: <b>${escapeHtml(contact.label || label)}</b>\n\n` +
          `Выберите его в настройках QR-визитки в разделе «Связь».`,
        "HTML"
      );
    } else if (payload && payload.startsWith("link_")) {
      const establishmentId = payload.replace("link_", "");

      const establishment = await prisma.establishment.findUnique({
        where: { id: establishmentId },
        select: { id: true, name: true },
      });

      if (!establishment) {
        await sendMessage(
          chatId,
          "❌ Заведение не найдено. Возможно, ссылка устарела. Попробуйте привязать заново через настройки."
        );
        return NextResponse.json({ ok: true });
      }

      await prisma.establishment.update({
        where: { id: establishmentId },
        data: {
          notificationTelegramChatId: String(chatId),
          notificationTelegramEnabled: true,
        },
      });

      await sendMessage(
        chatId,
        `✅ <b>Telegram-уведомления привязаны!</b>\n\n` +
        `Заведение: <b>${escapeHtml(establishment.name)}</b>\n\n` +
        `Теперь негативные отзывы (1–3 ★) будут приходить сюда.\n` +
        `Чтобы отвязать — отправьте /stop`,
        "HTML"
      );
    } else {
      await sendMessage(
        chatId,
        `👋 <b>QrStars.ru — уведомления об отзывах</b>\n\n` +
        `Чтобы привязать Telegram-уведомления к вашему заведению:\n\n` +
        `1️⃣ Откройте настройки заведения в личном кабинете QrStars.ru\n` +
        `2️⃣ Нажмите «Привязать Telegram»\n` +
        `3️⃣ Бот автоматически привяжется\n\n` +
        `Команды:\n` +
        `/status — проверить статус привязки\n` +
        `/stop — отвязать уведомления`,
        "HTML"
      );
    }

    return NextResponse.json({ ok: true });
  }

  if (incomingText === "/status") {
    const establishment = await prisma.establishment.findFirst({
      where: { notificationTelegramChatId: String(chatId) },
      select: { name: true, notificationTelegramEnabled: true },
    });

    if (!establishment) {
      await sendMessage(
        chatId,
        "📭 Telegram не привязан ни к одному заведению.\n\nПривяжите через настройки в личном кабинете QrStars.ru."
      );
    } else {
      const status = establishment.notificationTelegramEnabled ? "✅ Включены" : "⏸ Отключены";
      await sendMessage(
        chatId,
        `📋 <b>Статус привязки</b>\n\n` +
        `Заведение: <b>${escapeHtml(establishment.name)}</b>\n` +
        `Уведомления: ${status}`,
        "HTML"
      );
    }

    return NextResponse.json({ ok: true });
  }

  if (incomingText === "/stop") {
    const establishment = await prisma.establishment.findFirst({
      where: { notificationTelegramChatId: String(chatId) },
      select: { id: true, name: true },
    });

    if (!establishment) {
      await sendMessage(chatId, "📭 Telegram не привязан к заведению.");
    } else {
      await prisma.establishment.update({
        where: { id: establishment.id },
        data: {
          notificationTelegramEnabled: false,
        },
      });
      await sendMessage(
        chatId,
        `⏸ Уведомления отключены для <b>${escapeHtml(establishment.name)}</b>.\n\nЧтобы включить обратно — откройте настройки заведения.`
      );
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
