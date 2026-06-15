import { NextResponse } from "next/server";
import { flushScanStats } from "@/lib/scan-stats";
import { startScanFlushInterval } from "@/lib/scan-stats";

function authorizeCron(request: Request): boolean {
  if (process.env.E2E_TESTING === "true") return true;
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

/**
 * Батчевый flush статистики сканов из Redis в БД.
 * Вызывается cron-ом раз в минуту (deploy/flush-scans.sh).
 * Также запускает in-process setInterval при первом вызове.
 */
export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  startScanFlushInterval();
  const result = await flushScanStats();

  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return POST(request);
}
