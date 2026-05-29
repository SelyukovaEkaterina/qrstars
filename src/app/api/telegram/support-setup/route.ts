import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  const botToken = process.env.TELEGRAM_SUPPORT_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_SUPPORT_BOT_TOKEN not set" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_BASE_URL not set" }, { status: 400 });
  }

  const webhookUrl = `${baseUrl}/api/telegram/support-webhook`;

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
    return NextResponse.json({
      ok: true,
      webhookUrl,
      groupConfigured: Boolean(process.env.TELEGRAM_SUPPORT_GROUP_ID),
      maxMirrorConfigured: Boolean(process.env.MAX_SUPPORT_ADMIN_USER_ID),
      description: result.description,
    });
  }

  return NextResponse.json({ error: result.description }, { status: 500 });
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  return NextResponse.json({
    botConfigured: Boolean(process.env.TELEGRAM_SUPPORT_BOT_TOKEN),
    groupConfigured: Boolean(process.env.TELEGRAM_SUPPORT_GROUP_ID),
    maxMirrorConfigured: Boolean(process.env.MAX_SUPPORT_ADMIN_USER_ID),
  });
}
