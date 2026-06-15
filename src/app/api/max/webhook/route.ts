import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseMessengerLinkCode } from "@/lib/messenger-linking";
import { sendMaxMessage } from "@/lib/max";
import { enableReviewNotificationsForProvider } from "@/lib/owner-messenger-notify";

const MAX_SECRET = process.env.MAX_WEBHOOK_SECRET;

const LINK_HELP =
  `Отправьте код привязки из личного кабинета QrStars.ru:\n` +
  `<code>MC-…</code>\n\n` +
  `Подключение одно на аккаунт. Что получать (жалобы, визитка) — в настройках кабинета.`;

export async function POST(request: Request) {
  if (MAX_SECRET) {
    const secretHeader = request.headers.get("X-Max-Bot-Api-Secret");
    if (secretHeader !== MAX_SECRET) {
      return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
    }
  }

  const body = await request.json();
  const { update_type } = body;

  if (update_type === "bot_started") {
    const maxUserId = getMaxUserId(body);
    if (!maxUserId) return NextResponse.json({ ok: true });

    const payload = getStartPayload(body);
    if (payload) {
      const linked = await handleLinkPayload(maxUserId, payload);
      if (linked) return NextResponse.json({ ok: true });
    }

    await sendMaxMessage(maxUserId, `<b>QrStars.ru</b>\n\n${LINK_HELP}`);
    return NextResponse.json({ ok: true });
  }

  if (update_type === "message_created") {
    const text = getMessageText(body);
    const userId = getMaxUserId(body);

    if (!userId || !text) return NextResponse.json({ ok: true });

    const link = parseMessengerLinkCode(text);
    if (!link) {
      await sendMaxMessage(
        userId,
        `Не распознан код привязки.\n\n${LINK_HELP}`
      );
      return NextResponse.json({ ok: true });
    }

    if (link.kind === "mc") {
      await linkMcContact(userId, link.id);
    } else {
      await linkLegacyEstablishmentMax(userId, link.id);
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

async function handleLinkPayload(maxUserId: string, payload: string): Promise<boolean> {
  const link = parseMessengerLinkCode(payload);
  if (link?.kind === "mc") {
    await linkMcContact(maxUserId, link.id);
    return true;
  }
  if (link?.kind === "sr") {
    await linkLegacyEstablishmentMax(maxUserId, link.id);
    return true;
  }
  return false;
}

async function linkMcContact(maxUserId: string, accountUserId: string) {
  const user = await prisma.user.findUnique({
    where: { id: accountUserId },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    await sendMaxMessage(
      maxUserId,
      "❌ Аккаунт не найден. Проверьте код привязки в личном кабинете."
    );
    return;
  }

  const contact = await prisma.messengerContact.upsert({
    where: {
      userId_provider_externalId: {
        userId: accountUserId,
        provider: "MAX",
        externalId: maxUserId,
      },
    },
    create: {
      user: { connect: { id: accountUserId } },
      provider: "MAX",
      externalId: maxUserId,
      label: "MAX",
    },
    update: {},
  });

  const enabledCount = await enableReviewNotificationsForProvider(accountUserId, "MAX");

  const reviewHint =
    enabledCount > 0
      ? `Жалобы 1–3★ включены для ${enabledCount === 1 ? "вашего заведения" : `всех ${enabledCount} заведений`}.\n` +
        `Отключить — «Моя страница» → вкладка «Отзывы».`
      : `Когда появится заведение, жалобы 1–3★ будут приходить сюда.\n` +
        `Отключить — «Моя страница» → «Отзывы».`;

  await sendMaxMessage(
    maxUserId,
    `✅ <b>MAX подключён к аккаунту!</b>\n\n` +
      `Контакт: <b>${escapeHtml(contact.label || "MAX")}</b>\n\n` +
      reviewHint
  );
}

/** Старый код SR-…: привязка аккаунта + включение MAX для заведения. */
async function linkLegacyEstablishmentMax(maxUserId: string, establishmentId: string) {
  const establishment = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    select: { id: true, name: true, userId: true },
  });

  if (!establishment) {
    await sendMaxMessage(maxUserId, "❌ Заведение не найдено. Используйте код из настроек аккаунта.");
    return;
  }

  await linkMcContact(maxUserId, establishment.userId);

  await prisma.establishment.update({
    where: { id: establishmentId },
    data: { notificationMaxEnabled: true },
  });

  await sendMaxMessage(
    maxUserId,
    `✅ <b>MAX подключён!</b>\n\n` +
      `Заведение «${escapeHtml(establishment.name)}»: жалобы 1–3★ включены.\n` +
      `Остальное — в настройках кабинета.`
  );
}

type MaxUserLike = { user_id?: number; id?: number; userId?: number };

function getMaxUserId(body: {
  user?: MaxUserLike;
  message?: { sender?: MaxUserLike; user?: MaxUserLike };
}): string | null {
  const candidates = [
    body.user?.user_id,
    body.user?.id,
    body.message?.sender?.user_id,
    body.message?.sender?.userId,
    body.message?.sender?.id,
    body.message?.user?.user_id,
  ];

  for (const id of candidates) {
    if (id != null) return String(id);
  }
  return null;
}

function getMessageText(body: { message?: { body?: { text?: string } } }): string {
  return body.message?.body?.text?.trim() ?? "";
}

function getStartPayload(body: { payload?: string | null }): string {
  return body.payload?.trim() ?? "";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
