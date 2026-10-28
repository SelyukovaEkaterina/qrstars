import { NextResponse } from "next/server";
import {
  uploadPendingEstablishmentConversions,
  uploadPendingPaymentConversions,
} from "@/lib/metrika-offline";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

/** Загрузка offline-конверсий в Метрику (раз в сутки): establishment_created и payment_success. */
export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const establishments = await uploadPendingEstablishmentConversions();
  const payments = await uploadPendingPaymentConversions();
  const failed = [establishments, payments].filter((r) => !r.ok && !r.skipped);
  if (failed.length > 0) {
    return NextResponse.json(
      { error: failed.map((r) => r.error ?? "Upload failed").join("; "), establishments, payments },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    skipped: (establishments.skipped && payments.skipped) ?? false,
    uploaded: establishments.uploaded ?? 0,
    uploadId: establishments.uploadId,
    payments: {
      skipped: payments.skipped ?? false,
      uploaded: payments.uploaded ?? 0,
      uploadId: payments.uploadId,
    },
  });
}

export async function GET(request: Request) {
  return POST(request);
}
