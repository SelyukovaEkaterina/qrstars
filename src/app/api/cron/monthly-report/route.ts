import { NextResponse } from "next/server";
import { sendOwnerMonthlyReports } from "@/lib/owner-monthly-report";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

/**
 * Ежемесячный отчёт владельцу (email/Telegram/MAX). Вызывается cron-ом
 * 1-го числа каждого месяца за прошлый календарный месяц (МСК).
 *
 * Поддерживаемые query-параметры:
 *  - ?periodMonth=YYYY-MM — посчитать за произвольный месяц (бэкфилл).
 *  - ?userId=… — отправить только одному владельцу (ручная/тестовая отправка).
 *  - ?force=1 — игнорировать идемпотентность (переотправка).
 */
export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const periodMonth = url.searchParams.get("periodMonth") ?? undefined;
  const userId = url.searchParams.get("userId") ?? undefined;
  const force = url.searchParams.get("force") === "1";

  let result;
  try {
    result = await sendOwnerMonthlyReports({ periodMonth, userId, force });
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_PERIOD_MONTH") {
      return NextResponse.json(
        { error: "Invalid periodMonth, expected YYYY-MM" },
        { status: 400 }
      );
    }
    throw err;
  }

  return NextResponse.json({
    ok: result.ok,
    periodKey: result.periodKey,
    sentCount: result.sent.length,
    skippedCount: result.skipped.length,
    failedCount: result.failed.length,
    ...(result.error ? { error: result.error } : {}),
  });
}

export async function GET(request: Request) {
  return POST(request);
}
