import { NextResponse } from "next/server";
import { handleTelegramSupportGroupMessage } from "@/lib/telegram-support";

export async function POST(request: Request) {
  if (!process.env.TELEGRAM_SUPPORT_BOT_TOKEN) {
    return NextResponse.json({ error: "Bot not configured" }, { status: 500 });
  }

  const body = await request.json();

  if (body.message) {
    await handleTelegramSupportGroupMessage(body.message);
  }

  return NextResponse.json({ ok: true });
}
