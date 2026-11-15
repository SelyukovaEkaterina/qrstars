import { after, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { sendTelegramContactNotification } from "@/lib/telegram";
import { sendMaxMessage } from "@/lib/max";
import { getEmailTargets, getMaxTargets, getTelegramTargets } from "@/lib/owner-messenger-notify";
import {
  formatSubmissionForNotification,
  validateFieldValue,
  type FormFieldDef,
  type FormFieldType,
} from "@/lib/form-config";
import { formQuotaForOwner, isLimitExemptPreset } from "@/lib/form-limits";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { FORM_FREE_MONTHLY_SUBMISSIONS } from "@/lib/plans";

type RouteContext = { params: Promise<{ id: string }> };

/** Заявок с одного IP в одну форму в минуту: защита от накрутки и спама. */
const SUBMIT_LIMIT_PER_MINUTE = 30;

const PD_CONSENT_REQUIRED_ERROR =
  "Подтвердите согласие на обработку персональных данных — без него мы не можем принять телефон или email";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const guestIp = getClientIp(request).slice(0, 60) || null;

  const limited = rateLimit(`form-submit:${id}:${guestIp}`, SUBMIT_LIMIT_PER_MINUTE, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Слишком много отправок. Попробуйте через минуту." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const incomingValues =
    body?.values && typeof body.values === "object" && !Array.isArray(body.values)
      ? (body.values as Record<string, unknown>)
      : {};
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
    const result = validateFieldValue(f, incomingValues[f.id]);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    cleaned[f.id] = result.value;
  }

  const contactFilled = fields.some(
    (f) => (f.type === "phone" || f.type === "email") && typeof cleaned[f.id] === "string" && cleaned[f.id] !== ""
  );
  if (contactFilled && !pdConsentGiven) {
    return NextResponse.json({ error: PD_CONSENT_REQUIRED_ERROR }, { status: 400 });
  }

  // QR засчитываем, только если он ведёт на эту форму или из того же проекта.
  let resolvedQrId: string | null = null;
  if (qrCodeId) {
    const qr = await prisma.qRCode.findUnique({
      where: { id: qrCodeId },
      select: { id: true, formId: true, establishmentId: true },
    });
    if (qr && (qr.formId === form.id || qr.establishmentId === form.establishmentId)) {
      resolvedQrId = qr.id;
    }
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;

  const submission = await prisma.formSubmission.create({
    data: {
      form: { connect: { id } },
      ...(resolvedQrId ? { qrCode: { connect: { id: resolvedQrId } } } : {}),
      values: cleaned as Record<string, never>,
      guestIp,
      userAgent,
      ...(contactFilled ? { pdConsentAt: new Date(), pdConsentIp: guestIp } : {}),
    },
  });

  const est = form.establishment;
  const owner = est.user;
  const exempt = isLimitExemptPreset(form.preset);
  const quota = exempt ? null : await formQuotaForOwner(est.userId);
  const overLimit = !!quota && !quota.unlimited && quota.used > quota.limit;

  // Сверх лимита FREE содержимое заявки в уведомление не кладём — оно откроется на PRO.
  const textBody = overLimit
    ? `Заявка сохранена, но скрыта: на FREE доступно ${FORM_FREE_MONTHLY_SUBMISSIONS} заявок в месяц. Подключите PRO, чтобы открыть её в кабинете.`
    : formatSubmissionForNotification(fields, cleaned);
  const subject = `📩 Новая заявка — ${est.name} (${form.title})`;
  const cabinetUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/dashboard/projects/${est.id}/inbox`;

  const notifyFields = {
    userId: est.userId,
    notificationTelegramEnabled: est.notificationTelegramEnabled,
    notificationTelegramRequestsEnabled: est.notificationTelegramRequestsEnabled,
    notificationTelegramChatId: est.notificationTelegramChatId,
    notificationMaxEnabled: est.notificationMaxEnabled,
    notificationMaxRequestsEnabled: est.notificationMaxRequestsEnabled,
    notificationMaxUserId: est.notificationMaxUserId,
    notificationEmailEnabled: est.notificationEmailEnabled,
    notificationEmailRequestsEnabled: est.notificationEmailRequestsEnabled,
    notificationEmail: est.notificationEmail,
  };

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color:#4f46e5;">Новая заявка из формы</h2>
      <p><strong>Проект:</strong> ${escapeHtml(est.name)}</p>
      <p><strong>Форма:</strong> ${escapeHtml(form.title)}</p>
      <div style="background:#f9fafb;padding:16px;border-radius:8px;border-left:4px solid #4f46e5;white-space:pre-wrap;">${escapeHtml(textBody)}</div>
      <a href="${cabinetUrl}"
         style="display:inline-block;padding:12px 24px;background:#4f46e5;color:white;text-decoration:none;border-radius:8px;margin-top:16px;">
        Открыть в кабинете
      </a>
    </div>
  `;
  const messengerText = [
    `<b>📩 Новая заявка</b>`,
    `<b>${escapeHtml(est.name)}</b> — ${escapeHtml(form.title)}`,
    "",
    escapeHtml(textBody),
    "",
    `<a href="${cabinetUrl}">Открыть в кабинете</a>`,
  ].join("\n");

  // Гость не ждёт каналы уведомлений: заявка уже сохранена.
  after(async () => {
    const [emailTargets, tgTargets, maxTargets] = await Promise.all([
      getEmailTargets(notifyFields, "requests"),
      getTelegramTargets(notifyFields, "requests"),
      getMaxTargets(notifyFields, "requests"),
    ]);
    const emailTo = emailTargets[0] ?? owner.email;
    await Promise.allSettled([
      emailTo ? sendMail(emailTo, subject, html) : Promise.resolve(),
      ...tgTargets.map((chatId) => sendTelegramContactNotification(chatId, messengerText)),
      ...maxTargets.map((maxUserId) => sendMaxMessage(maxUserId, messengerText, "html")),
    ]).then((results) => {
      for (const r of results) {
        if (r.status === "rejected") console.error("Form notification error", r.reason);
      }
    });
  });

  return NextResponse.json({
    ok: true,
    submissionId: submission.id,
    successMessage: form.successMessage,
  });
}
