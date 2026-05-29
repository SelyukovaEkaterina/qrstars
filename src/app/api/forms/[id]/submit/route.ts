import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { sendTelegramContactNotification } from "@/lib/telegram";
import { sendMaxMessage } from "@/lib/max";
import {
  formatSubmissionForNotification,
  type FormFieldDef,
  type FormFieldType,
} from "@/lib/form-config";

type RouteContext = { params: Promise<{ id: string }> };

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function coerceValue(type: FormFieldType, raw: unknown): unknown {
  if (raw === undefined || raw === null) return null;
  if (type === "checkbox") return !!raw;
  if (type === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof raw === "string") return raw.trim().slice(0, 2000);
  return raw;
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const incomingValues = (body?.values ?? {}) as Record<string, unknown>;
  const qrCodeId =
    typeof body?.qrCodeId === "string" && body.qrCodeId.length > 0 ? body.qrCodeId : null;
  const pdConsentGiven = body?.pdConsentGiven === true;

  const form = await prisma.form.findUnique({
    where: { id },
    include: {
      fields: { orderBy: { order: "asc" } },
      establishment: { include: { user: true } },
    },
  });
  if (!form || !form.enabled) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fields: FormFieldDef[] = form.fields.map((f) => ({
    id: f.id,
    label: f.label,
    placeholder: f.placeholder,
    helpText: f.helpText,
    type: (f.type as FormFieldType) ?? "text",
    required: f.required,
    options: Array.isArray(f.options) ? (f.options as string[]) : null,
    order: f.order,
  }));

  const cleaned: Record<string, unknown> = {};
  for (const f of fields) {
    const v = coerceValue(f.type, incomingValues[f.id]);
    if (f.required && (v === null || v === "" || v === false)) {
      return NextResponse.json(
        { error: `Поле «${f.label}» обязательно` },
        { status: 400 }
      );
    }
    cleaned[f.id] = v;
  }

  let resolvedQrId: string | null = null;
  if (qrCodeId) {
    const qr = await prisma.qRCode.findUnique({ where: { id: qrCodeId } });
    if (qr) resolvedQrId = qr.id;
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;
  const xff = request.headers.get("x-forwarded-for") ?? "";
  const guestIp = xff.split(",")[0]?.trim().slice(0, 60) || null;

  const hasSensitiveFields = form.fields.some((f) => f.type === "phone" || f.type === "email");
  const submission = await prisma.formSubmission.create({
    data: {
      form: { connect: { id } },
      ...(resolvedQrId ? { qrCode: { connect: { id: resolvedQrId } } } : {}),
      values: cleaned as Record<string, never>,
      guestIp,
      userAgent,
      ...(pdConsentGiven && hasSensitiveFields ? { pdConsentAt: new Date(), pdConsentIp: guestIp } : {}),
    },
  });

  const est = form.establishment;
  const owner = est.user;
  const textBody = formatSubmissionForNotification(fields, cleaned);
  const subject = `📩 Новая заявка — ${est.name} (${form.title})`;

  const emailTo =
    est.notificationEmailEnabled && est.notificationEmail ? est.notificationEmail : owner.email;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color:#4f46e5;">Новая заявка из формы</h2>
      <p><strong>Заведение:</strong> ${escapeHtml(est.name)}</p>
      <p><strong>Форма:</strong> ${escapeHtml(form.title)}</p>
      <div style="background:#f9fafb;padding:16px;border-radius:8px;border-left:4px solid #4f46e5;white-space:pre-wrap;">${escapeHtml(textBody)}</div>
      <a href="${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/dashboard/my-page"
         style="display:inline-block;padding:12px 24px;background:#4f46e5;color:white;text-decoration:none;border-radius:8px;margin-top:16px;">
        Открыть кабинет
      </a>
    </div>
  `;
  try {
    await sendMail(emailTo, subject, html);
  } catch (e) {
    console.error("Form email error", e);
  }

  if (est.notificationTelegramEnabled && est.notificationTelegramChatId) {
    const tg = [
      `<b>📩 Новая заявка</b>`,
      `<b>${escapeHtml(est.name)}</b> — ${escapeHtml(form.title)}`,
      "",
      escapeHtml(textBody),
    ].join("\n");
    await sendTelegramContactNotification(est.notificationTelegramChatId, tg);
  }

  if (est.notificationMaxEnabled && est.notificationMaxUserId) {
    const mx = [
      `<b>📩 Новая заявка</b>`,
      `<b>${escapeHtml(est.name)}</b> — ${escapeHtml(form.title)}`,
      "",
      escapeHtml(textBody),
    ].join("\n");
    await sendMaxMessage(est.notificationMaxUserId, mx, "html");
  }

  return NextResponse.json({
    ok: true,
    submissionId: submission.id,
    successMessage: form.successMessage,
  });
}
