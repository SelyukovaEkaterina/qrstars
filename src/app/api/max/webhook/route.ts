import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendMaxMessage } from "@/lib/max";

const MAX_SECRET = process.env.MAX_WEBHOOK_SECRET;

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
    const userId = getMaxUserId(body);
    if (!userId) return NextResponse.json({ ok: true });

    await sendMaxMessage(
      userId,
      `<b>QrStars.ru</b>\n\n` +
        `Отправьте код привязки из личного кабинета:\n\n` +
        `• <code>SR-…</code> — уведомления о негативных отзывах заведения\n` +
        `• <code>MC-…</code> — контакт для сообщений с QR-визитки`
    );

    return NextResponse.json({ ok: true });
  }

  if (update_type === "message_created") {
    const text = getMessageText(body);
    const userId = getMaxUserId(body);

    if (!userId || !text) return NextResponse.json({ ok: true });

    const link = parseLinkCode(text);

    if (!link) {
      await sendMaxMessage(
        userId,
        `Не распознан код привязки.\n\n` +
          `Скопируйте код из QrStars.ru и отправьте одним сообщением:\n` +
          `<code>SR-…</code> или <code>MC-…</code>`
      );
      return NextResponse.json({ ok: true });
    }

    if (link.kind === "mc") {
      const user = await prisma.user.findUnique({
        where: { id: link.id },
        select: { id: true, name: true, email: true },
      });

      if (!user) {
        await sendMaxMessage(
          userId,
          "❌ Аккаунт не найден. Проверьте код привязки в личном кабинете."
        );
        return NextResponse.json({ ok: true });
      }

      const contact = await prisma.messengerContact.upsert({
        where: {
          userId_provider_externalId: {
            userId: link.id,
            provider: "MAX",
            externalId: userId,
          },
        },
        create: {
          userId: link.id,
          provider: "MAX",
          externalId: userId,
          label: "MAX",
        },
        update: {},
      });

      await sendMaxMessage(
        userId,
        `✅ <b>MAX-контакт добавлен!</b>\n\n` +
          `Контакт: <b>${escapeHtml(contact.label || "MAX")}</b>\n\n` +
          `Выберите его в настройках QR-визитки в разделе «Связь».`
      );
    } else {
      const establishment = await prisma.establishment.findUnique({
        where: { id: link.id },
        select: { id: true, name: true },
      });

      if (!establishment) {
        await sendMaxMessage(
          userId,
          "❌ Заведение не найдено. Проверьте код привязки в настройках."
        );
        return NextResponse.json({ ok: true });
      }

      await prisma.establishment.update({
        where: { id: link.id },
        data: {
          notificationMaxUserId: userId,
          notificationMaxEnabled: true,
        },
      });

      await sendMaxMessage(
        userId,
        `✅ <b>MAX-уведомления привязаны!</b>\n\n` +
          `Заведение: <b>${escapeHtml(establishment.name)}</b>\n\n` +
          `Негативные отзывы (1–3 ★) будут приходить сюда.`
      );
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
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

function parseLinkCode(message: string): { kind: "mc" | "sr"; id: string } | null {
  const trimmed = message.trim();
  const upper = trimmed.toUpperCase();
  if (upper.startsWith("MC-")) return { kind: "mc", id: trimmed.slice(3) };
  if (upper.startsWith("SR-")) return { kind: "sr", id: trimmed.slice(3) };
  return null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
