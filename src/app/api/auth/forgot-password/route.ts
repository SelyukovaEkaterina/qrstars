import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizeInviteEmail } from "@/lib/establishment-access";

export async function POST(request: Request) {
  // Rate limit: 5 запросов в 10 минут с одного IP
  const ip = getClientIp(request);
  const rl = rateLimit(`forgot-password:${ip}`, 5, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком много запросов. Попробуйте позже." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email обязателен" }, { status: 400 });
  }

  const normalizedEmail = normalizeInviteEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    return NextResponse.json({ success: true });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  const created = await prisma.passwordResetToken.create({
    data: { token, user: { connect: { id: user.id } }, expiresAt },
  });

  const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/reset-password?token=${token}`;
  const sent = await sendPasswordResetEmail(email, resetUrl);
  if (!sent) {
    // Прежние ссылки не трогаем: письмо не ушло, а у человека может быть рабочая
    // ссылка, выданная вручную (восстановление после аварии Beget).
    await prisma.passwordResetToken.delete({ where: { id: created.id } }).catch(() => {});
    return NextResponse.json(
      { error: "Не удалось отправить письмо: почта временно не работает. Напишите в поддержку — поможем войти." },
      { status: 503 }
    );
  }

  // Гасим прежние ссылки только после того, как новая действительно отправлена.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() }, id: { not: created.id } },
    data: { usedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
