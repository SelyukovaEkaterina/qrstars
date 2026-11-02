import prisma from "@/lib/prisma";

/**
 * Заявки с QR-визитки хранятся как FormSubmission системной формы проекта:
 * так они попадают в «Обратная связь → Заявки и вопросы» и в счётчик непрочитанных
 * без отдельной таблицы. Форма выключена (`enabled: false`) — публично её отправить нельзя,
 * и в списках форм редактора микросайта она не показывается.
 */
export const BUSINESS_CARD_LEAD_FORM_PRESET = "business_card_contact";

const FIELDS = [
  { key: "name", label: "Имя", type: "text" },
  { key: "phone", label: "Телефон", type: "phone" },
  { key: "message", label: "Сообщение", type: "textarea" },
] as const;

type LeadFieldKey = (typeof FIELDS)[number]["key"];

async function ensureLeadForm(establishmentId: string) {
  const existing = await prisma.form.findFirst({
    where: { establishmentId, preset: BUSINESS_CARD_LEAD_FORM_PRESET },
    include: { fields: { orderBy: { order: "asc" } } },
  });
  if (existing && existing.fields.length >= FIELDS.length) return existing;
  if (existing) await prisma.form.delete({ where: { id: existing.id } });
  return prisma.form.create({
    data: {
      establishmentId,
      title: "Заявки с визитки",
      preset: BUSINESS_CARD_LEAD_FORM_PRESET,
      enabled: false,
      fields: {
        create: FIELDS.map((f, order) => ({ label: f.label, type: f.type, order })),
      },
    },
    include: { fields: { orderBy: { order: "asc" } } },
  });
}

export async function saveBusinessCardLead(input: {
  establishmentId: string;
  qrCodeId: string;
  guestName: string;
  guestPhone: string | null;
  message: string;
  guestIp: string | null;
  userAgent: string | null;
  pdConsentGiven: boolean;
}): Promise<string> {
  const form = await ensureLeadForm(input.establishmentId);
  const byKey: Record<LeadFieldKey, string | null> = {
    name: input.guestName,
    phone: input.guestPhone,
    message: input.message,
  };
  const values: Record<string, string> = {};
  FIELDS.forEach((f, i) => {
    const v = byKey[f.key];
    const field = form.fields[i];
    if (v && field) values[field.id] = v;
  });
  const submission = await prisma.formSubmission.create({
    data: {
      formId: form.id,
      qrCodeId: input.qrCodeId,
      values,
      guestIp: input.guestIp,
      userAgent: input.userAgent,
      ...(input.pdConsentGiven && input.guestPhone
        ? { pdConsentAt: new Date(), pdConsentIp: input.guestIp }
        : {}),
    },
  });
  return submission.id;
}
