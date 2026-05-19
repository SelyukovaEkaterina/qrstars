import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_BASE_URL not set" }, { status: 400 });
  }

  const webhookUrl = `${baseUrl}/api/telegram/webhook`;

  const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message"],
    }),
  });

  const result = await res.json();

  if (result.ok) {
    return NextResponse.json({ ok: true, webhookUrl, description: result.description });
  }

  return NextResponse.json({ error: result.description }, { status: 500 });
}
