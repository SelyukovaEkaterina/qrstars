import { NextResponse } from "next/server";
import { sendDailyReport } from "@/lib/admin-weekly-report";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

/** Дневной отчёт в Telegram. Вызывается cron-ом ежедневно за вчера (МСК). */
export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const period = url.searchParams.get("period");
  const result = await sendDailyReport({
    period: period === "today" ? "today" : "yesterday",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Send failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    period: result.metrics?.range.labelFrom,
    scans: result.metrics?.scans.current,
    registrations: result.metrics?.registrations.current,
    qrcodes: result.metrics?.qrcodes.current,
  });
}

export async function GET(request: Request) {
  return POST(request);
}
