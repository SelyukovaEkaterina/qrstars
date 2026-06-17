import { NextResponse } from "next/server";
import { uploadPendingEstablishmentConversions } from "@/lib/metrika-offline";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

/** Загрузка offline-конверсий «establishment_created» в Метрику (раз в сутки). */
export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await uploadPendingEstablishmentConversions();
  if (!result.ok && !result.skipped) {
    return NextResponse.json({ error: result.error ?? "Upload failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    skipped: result.skipped ?? false,
    uploaded: result.uploaded ?? 0,
    uploadId: result.uploadId,
  });
}

export async function GET(request: Request) {
  return POST(request);
}
