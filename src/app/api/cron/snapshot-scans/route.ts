import { NextResponse } from "next/server";
import { takeDailyScanSnapshot } from "@/lib/daily-scan-snapshot";

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
 * Дневной снапшот scansCount → DailyScanStat (за вчера, МСК).
 * Вызывается cron-ом раз в сутки (deploy/snapshot-scans.sh) ПОСЛЕ flush-scans
 * и ДО дневного отчёта: даёт агрегаты сканов для всех тарифов (не только PRO).
 */
export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const referenceIso = url.searchParams.get("referenceDate");
  const referenceDate = referenceIso ? new Date(referenceIso) : new Date();
  const period = url.searchParams.get("period") === "today" ? "today" : "yesterday";

  const result = await takeDailyScanSnapshot(referenceDate, { period });

  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return POST(request);
}
