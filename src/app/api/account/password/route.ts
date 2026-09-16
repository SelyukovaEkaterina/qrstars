import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireDbUserId } from "@/lib/session-user";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  const auth = await requireDbUserId();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { hashedPassword: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }
  return NextResponse.json({ hasPassword: Boolean(user.hashedPassword) });
}

export async function POST(request: Request) {
  const auth = await requireDbUserId();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const limited = rateLimit(`account-password:${auth.userId}`, 5, 15 * 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Слишком много попыток. Повторите позже." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const currentPassword =
    typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "Новый пароль должен содержать не менее 8 символов" },
      { status: 400 }
    );
  }
  if (newPassword.length > 128) {
    return NextResponse.json({ error: "Пароль слишком длинный" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { hashedPassword: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  if (user.hashedPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Укажите текущий пароль" }, { status: 400 });
    }
    const matches = await bcrypt.compare(currentPassword, user.hashedPassword);
    if (!matches) {
      return NextResponse.json({ error: "Текущий пароль указан неверно" }, { status: 400 });
    }
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: auth.userId },
    data: { hashedPassword },
  });

  return NextResponse.json({ ok: true, passwordCreated: !user.hashedPassword });
}
