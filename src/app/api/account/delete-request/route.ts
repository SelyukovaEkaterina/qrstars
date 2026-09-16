import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireDbUserId } from "@/lib/session-user";
import { rateLimit } from "@/lib/rate-limit";
import { sendUserSupportMessage } from "@/lib/support-service";

const REQUEST_MARKER = "Запрос на удаление аккаунта";

export async function POST() {
  const auth = await requireDbUserId();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const limited = rateLimit(`account-delete-request:${auth.userId}`, 2, 24 * 60 * 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Запрос уже отправлен. Поддержка ответит в разделе «Поддержка»." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const existing = await prisma.supportMessage.findFirst({
    where: {
      ticket: { userId: auth.userId },
      body: { startsWith: REQUEST_MARKER },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, alreadyRequested: true });
  }

  await sendUserSupportMessage(auth.userId, {
    body:
      `${REQUEST_MARKER}\n\n` +
      "Прошу удалить аккаунт и связанные персональные данные. " +
      "Перед удалением необходимо подтвердить запрос и проверить активную подписку/обязательства.",
  });

  return NextResponse.json({ ok: true, alreadyRequested: false });
}
