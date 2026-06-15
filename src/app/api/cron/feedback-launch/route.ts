import { NextResponse } from "next/server";
import { runFeedbackLaunch } from "@/lib/feedback-launch";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

/** Одноразовая рассылка feedback legacy-юзерам после выливки lifecycle. Идемпотентна. */
export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runFeedbackLaunch();
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Launch failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    sentCount: result.sentCount,
    skippedCount: result.skippedCount,
    failedCount: result.failedCount,
  });
}

export async function GET(request: Request) {
  return POST(request);
}
