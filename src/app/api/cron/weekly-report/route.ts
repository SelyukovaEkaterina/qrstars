import { NextResponse } from "next/server";
import { sendWeeklyReport } from "@/lib/admin-weekly-report";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

/** Еженедельный отчёт в Telegram. Вызывается cron-ом по понедельникам. */
export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendWeeklyReport();
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Send failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    period: {
      from: result.metrics?.range.labelFrom,
      to: result.metrics?.range.labelTo,
    },
    scans: result.metrics?.scans.current,
    registrations: result.metrics?.registrations.current,
  });
}

export async function GET(request: Request) {
  return POST(request);
}
