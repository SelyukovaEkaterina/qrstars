import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifySignedUserToken } from "@/lib/signed-user-token";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const verified = verifySignedUserToken(token, "unsubscribe");
  if (!verified) {
    return NextResponse.redirect(
      new URL("/login?error=unsubscribe_invalid", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000")
    );
  }

  // type=reports — отписка от ежемесячных отчётов (из footer письма-отчёта).
  const isReports = url.searchParams.get("type") === "reports";

  if (isReports) {
    await prisma.user.update({
      where: { id: verified.userId },
      data: { reportsEmailEnabled: false },
    });
  } else {
    await prisma.user.update({
      where: { id: verified.userId },
      data: { marketingEmailsEnabled: false },
    });
  }

  const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://app.qrstars.ru").replace(/\/$/, "");
  const heading = isReports ? "Вы отписались от ежемесячных отчётов" : "Вы отписались от подсказок";
  const description = isReports
    ? "Мы больше не будем присылать ежемесячные сводки на email. Отчёты в Telegram/MAX и важные уведомления (жалобы гостей, сброс пароля) продолжат приходить. Включить отчёты обратно можно в настройках кабинета."
    : "Мы больше не будем присылать onboarding-письма. Важные уведомления (жалобы гостей, сброс пароля) продолжат приходить.";
  const html = `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><title>Отписка — QrStars</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:48px auto;padding:24px;text-align:center;color:#374151;">
  <h1 style="color:#111827;">${heading}</h1>
  <p>${description}</p>
  <p><a href="${base}/dashboard/settings" style="color:#4f46e5;">Настройки кабинета</a> · <a href="${base}/dashboard" style="color:#4f46e5;">Вернуться в кабинет</a></p>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  return GET(request);
}
