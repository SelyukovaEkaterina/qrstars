import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = process.env.MAX_BOT_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "MAX_BOT_ACCESS_TOKEN not set" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_BASE_URL not set" }, { status: 400 });
  }

  const webhookUrl = `${baseUrl}/api/max/webhook`;
  const secret = process.env.MAX_WEBHOOK_SECRET;

  const body: Record<string, unknown> = {
    url: webhookUrl,
    update_types: ["bot_started", "message_created"],
  };

  if (secret) {
    body.secret = secret;
  }

  const res = await fetch("https://platform-api.max.ru/subscriptions", {
    method: "POST",
    headers: {
      Authorization: accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result = await res.json();

  if (result.success) {
    return NextResponse.json({ ok: true, webhookUrl });
  }

  return NextResponse.json({ error: result.message || "Webhook setup failed" }, { status: 500 });
}
