import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseInboundEmail, supportBodyFromEmail } from "@/lib/inbound-email";
import { sendUserSupportMessage, uploadUserSupportAttachment } from "@/lib/support-service";
import type { SupportAttachmentMeta } from "@/lib/support-attachments";
import { notifyInboundEmailFromUnknown } from "@/lib/telegram-support";
import { logUserEvent } from "@/lib/user-events-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Свой секрет: им пользуется только скрипт Postfix на VPS (`deploy/mail/inbound-to-app.py`). */
function authorize(request: Request): boolean {
  const secret = process.env.INBOUND_EMAIL_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Порт 25 открыт всему интернету: ограничиваем, сколько писем с одного адреса попадёт в поддержку. */
const PER_SENDER_PER_HOUR = 10;
const UNKNOWN_PER_HOUR = 30;
const hits = new Map<string, number[]>();

function allow(key: string, limit: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5_000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < 3_600_000)) hits.delete(k);
  }
  return true;
}

/**
 * Входящее письмо (ответ на рассылку или уведомление). Письмо от email пользователя
 * становится сообщением в его чате поддержки (кабинет + тема в Telegram-форуме);
 * ответ оператора из Telegram уходит обратно письмом, как обычно.
 * Ответы: 200 — принято или сознательно отброшено (Postfix не повторяет),
 * 5xx — временная ошибка (скрипт вернёт Postfix EX_TEMPFAIL, письмо придёт повторно).
 */
export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = parseInboundEmail(raw);
  if (!email) {
    return NextResponse.json({ error: "Invalid email payload" }, { status: 400 });
  }

  if (email.automated) {
    console.info("Inbound email skipped: automated", { to: email.to });
    return NextResponse.json({ ok: true, skipped: "automated" });
  }
  if (!allow(`from:${email.from}`, PER_SENDER_PER_HOUR)) {
    console.warn("Inbound email skipped: rate limit", { to: email.to });
    return NextResponse.json({ ok: true, skipped: "rate_limited" });
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email.from, mode: "insensitive" } },
    select: { id: true },
  });

  if (!user) {
    if (!allow("unknown", UNKNOWN_PER_HOUR)) {
      return NextResponse.json({ ok: true, skipped: "rate_limited" });
    }
    await notifyInboundEmailFromUnknown({
      from: email.from,
      fromName: email.fromName,
      to: email.to,
      subject: email.subject,
      text: supportBodyFromEmail(email),
      attachments: email.attachments.length,
    });
    console.info("Inbound email from unknown sender forwarded");
    return NextResponse.json({ ok: true, delivered: "unknown_sender" });
  }

  // Вложения: первое — вместе с текстом, остальные — отдельными сообщениями (как в чате кабинета).
  const uploaded: SupportAttachmentMeta[] = [];
  const skippedFiles: string[] = [];
  for (const a of email.attachments) {
    try {
      const buffer = Buffer.from(a.dataBase64, "base64");
      uploaded.push(await uploadUserSupportAttachment(user.id, buffer, a.name, a.mime));
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "UNSUPPORTED_TYPE" || code === "TOO_LARGE") skippedFiles.push(a.name);
      else throw e;
    }
  }

  let body = supportBodyFromEmail(email);
  const toLocal = email.to?.split("@")[0]?.toLowerCase();
  if (email.to && toLocal && toLocal !== "support" && toLocal !== "noreply") {
    body = `(на ${email.to})\n${body}`;
  }
  if (skippedFiles.length > 0) {
    body += `\n\n(не сохранены вложения: ${skippedFiles.join(", ").slice(0, 300)})`;
  }

  await sendUserSupportMessage(user.id, { body, attachment: uploaded[0], source: "email" });
  for (const attachment of uploaded.slice(1)) {
    await sendUserSupportMessage(user.id, { body: "", attachment, source: "email" });
  }

  logUserEvent(user.id, "dash.email_reply", {
    to: email.to?.split("@")[0] ?? null,
    attachments: uploaded.length,
  });
  return NextResponse.json({ ok: true, delivered: "support_ticket" });
}
