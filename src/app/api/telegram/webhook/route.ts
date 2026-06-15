import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseMessengerLinkCode } from "@/lib/messenger-linking";
import { enableReviewNotificationsForProvider } from "@/lib/owner-messenger-notify";

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
        { command: "start", description: "Подключить аккаунт" },
        { command: "stop", description: "Отключить канал" },
        { command: "status", description: "Статус подключения" },
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

    if (payload) {
      const handled = await handleStartPayload(chatId, payload, chat);
      if (handled) return NextResponse.json({ ok: true });
    }

    await sendMessage(
      chatId,
      `👋 <b>QrStars.ru</b>\n\n` +
        `Подключите Telegram к аккаунту:\n\n` +
        `1️⃣ Откройте <b>Настройки</b> в личном кабинете\n` +
        `2️⃣ Скопируйте код <code>MC-…</code> и отправьте боту\n\n` +
        `Один раз на аккаунт. Жалобы, визитка и др. — включаются в кабинете.\n\n` +
        `/status — статус\n` +
        `/stop — отключить этот чат`,
      "HTML"
    );

    return NextResponse.json({ ok: true });
  }

  const textLink = parseMessengerLinkCode(incomingText);
  if (textLink) {
    if (textLink.kind === "mc") {
      await linkMcContact(chatId, textLink.id, chat);
    } else {
      await linkLegacyEstablishmentTelegram(chatId, textLink.id, chat);
    }
    return NextResponse.json({ ok: true });
  }

  if (incomingText === "/status") {
    const contact = await prisma.messengerContact.findFirst({
      where: { provider: "TELEGRAM", externalId: String(chatId) },
      select: {
        label: true,
        user: {
          select: {
            email: true,
            establishments: {
              select: { name: true, notificationTelegramEnabled: true },
              take: 5,
            },
          },
        },
      },
    });

    if (!contact) {
      await sendMessage(
        chatId,
        "📭 Telegram не подключён к аккаунту QrStars.ru.\n\nКод привязки — в настройках кабинета."
      );
    } else {
      const enabled = contact.user.establishments.filter((e) => e.notificationTelegramEnabled);
      const lines =
        enabled.length > 0
          ? enabled.map((e) => `• ${escapeHtml(e.name)} — жалобы ✅`).join("\n")
          : "Жалобы по заведениям пока не включены — в настройках заведения.";
      await sendMessage(
        chatId,
        `📋 <b>Подключено к аккаунту</b>\n\n` +
          `${escapeHtml(contact.user.email)}\n\n` +
          `${lines}`,
        "HTML"
      );
    }

    return NextResponse.json({ ok: true });
  }

  if (incomingText === "/stop") {
    const deleted = await prisma.messengerContact.deleteMany({
      where: { provider: "TELEGRAM", externalId: String(chatId) },
    });

    if (deleted.count === 0) {
      await sendMessage(chatId, "📭 Этот чат не был подключён.");
    } else {
      await sendMessage(
        chatId,
        `⏸ Telegram отключён от аккаунта QrStars.ru.\n\nПодключить снова — код в настройках кабинета.`
      );
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

async function handleStartPayload(
  chatId: number,
  payload: string,
  chat: { first_name?: string; last_name?: string; username?: string }
): Promise<boolean> {
  if (payload.startsWith("link_mc_")) {
    await linkMcContact(chatId, payload.replace("link_mc_", ""), chat);
    return true;
  }

  if (payload.startsWith("link_")) {
    const id = payload.replace("link_", "");
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (user) {
      await linkMcContact(chatId, id, chat);
      return true;
    }
    await linkLegacyEstablishmentTelegram(chatId, id, chat);
    return true;
  }

  const parsed = parseMessengerLinkCode(payload);
  if (parsed?.kind === "mc") {
    await linkMcContact(chatId, parsed.id, chat);
    return true;
  }
  if (parsed?.kind === "sr") {
    await linkLegacyEstablishmentTelegram(chatId, parsed.id, chat);
    return true;
  }

  return false;
}

async function linkMcContact(
  chatId: number,
  userId: string,
  chat: { first_name?: string; last_name?: string; username?: string }
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user) {
    await sendMessage(
      chatId,
      "❌ Аккаунт не найден. Откройте привязку заново в личном кабинете QrStars.ru."
    );
    return;
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
      user: { connect: { id: userId } },
      provider: "TELEGRAM",
      externalId: String(chatId),
      label,
    },
    update: { label },
  });

  const enabledCount = await enableReviewNotificationsForProvider(userId, "TELEGRAM");

  const reviewHint =
    enabledCount > 0
      ? `Жалобы 1–3★ включены для ${enabledCount === 1 ? "вашего заведения" : `всех ${enabledCount} заведений`}.\n` +
        `Отключить — «Моя страница» → вкладка «Отзывы».`
      : `Когда появится заведение, жалобы 1–3★ будут приходить сюда.\n` +
        `Отключить — «Моя страница» → «Отзывы».`;

  await sendMessage(
    chatId,
    `✅ <b>Telegram подключён к аккаунту!</b>\n\n` +
      `Контакт: <b>${escapeHtml(contact.label || label)}</b>\n\n` +
      reviewHint,
    "HTML"
  );
}

async function linkLegacyEstablishmentTelegram(
  chatId: number,
  establishmentId: string,
  chat: { first_name?: string; last_name?: string; username?: string }
) {
  const establishment = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    select: { id: true, name: true, userId: true },
  });

  if (!establishment) {
    await sendMessage(
      chatId,
      "❌ Заведение не найдено. Используйте код из настроек аккаунта."
    );
    return;
  }

  await linkMcContact(chatId, establishment.userId, chat);

  await prisma.establishment.update({
    where: { id: establishmentId },
    data: { notificationTelegramEnabled: true },
  });

  await sendMessage(
    chatId,
    `✅ Жалобы для «<b>${escapeHtml(establishment.name)}</b>» включены.\n\n` +
      `Остальные уведомления — в настройках кабинета.`,
    "HTML"
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
