import { NextResponse } from "next/server";
import { runLifecycleEmailBatch } from "@/lib/lifecycle-emails";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

/** Ежедневная lifecycle-рассылка. Вызывается cron-ом в 10:00 МСК. */
export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runLifecycleEmailBatch();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Batch failed", sent: result.sent, skipped: result.skipped, failed: result.failed },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    sentCount: result.sent.length,
    skippedCount: result.skipped.length,
    failedCount: result.failed.length,
    sent: result.sent,
    skipped: result.skipped,
    failed: result.failed,
  });
}

export async function GET(request: Request) {
  return POST(request);
}
