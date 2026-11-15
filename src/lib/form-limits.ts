/**
 * Лимит заявок из форм на FREE (`FORM_FREE_MONTHLY_SUBMISSIONS` в месяц МСК на владельца).
 *
 * Гость отправляет форму всегда — заявка сохраняется. Сверх лимита она скрыта в кабинете
 * (значения не отдаются API), пока у владельца нет PRO; после оплаты открывается сама,
 * без миграций и пересчётов. Заявки с визитки (системная форма) в лимит не входят.
 */
import prisma from "@/lib/prisma";
import { FORM_FREE_MONTHLY_SUBMISSIONS, hasPaidFeatures } from "@/lib/plans";
import { findActiveSubscription } from "@/lib/subscription-utils";
import { BUSINESS_CARD_LEAD_FORM_PRESET } from "@/lib/business-card-leads";
import { MSK_OFFSET_MS } from "@/lib/report-formatting";

export const LOCKED_SUBMISSION_HINT = `На FREE доступно ${FORM_FREE_MONTHLY_SUBMISSIONS} заявок в месяц. Подключите PRO, чтобы открыть эту заявку.`;

export function isLimitExemptPreset(preset: string | null | undefined): boolean {
  return preset === BUSINESS_CARD_LEAD_FORM_PRESET;
}

/** Начало и конец календарного месяца МСК, в который попадает `date`. */
export function mskMonthRange(date: Date): { start: Date; end: Date; key: string } {
  const msk = new Date(date.getTime() + MSK_OFFSET_MS);
  const y = msk.getUTCFullYear();
  const m = msk.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1) - MSK_OFFSET_MS);
  const end = new Date(Date.UTC(y, m + 1, 1) - MSK_OFFSET_MS);
  return { start, end, key: `${y}-${String(m + 1).padStart(2, "0")}` };
}

function countableWhere(ownerUserId: string, start: Date, end: Date) {
  return {
    createdAt: { gte: start, lt: end },
    form: {
      establishment: { userId: ownerUserId },
      OR: [{ preset: null }, { preset: { not: BUSINESS_CARD_LEAD_FORM_PRESET } }],
    },
  };
}

export async function ownerHasUnlimitedForms(ownerUserId: string): Promise<boolean> {
  const sub = await findActiveSubscription(ownerUserId);
  return hasPaidFeatures(sub?.plan);
}

export interface FormQuota {
  unlimited: boolean;
  limit: number;
  used: number;
  /** Сколько заявок этого месяца скрыто (FREE сверх лимита). */
  locked: number;
}

export async function formQuotaForOwner(ownerUserId: string, now = new Date()): Promise<FormQuota> {
  const unlimited = await ownerHasUnlimitedForms(ownerUserId);
  const { start, end } = mskMonthRange(now);
  const used = await prisma.formSubmission.count({ where: countableWhere(ownerUserId, start, end) });
  return {
    unlimited,
    limit: FORM_FREE_MONTHLY_SUBMISSIONS,
    used,
    locked: unlimited ? 0 : Math.max(0, used - FORM_FREE_MONTHLY_SUBMISSIONS),
  };
}

/**
 * Какие из переданных заявок скрыты: владелец на FREE, заявка не с визитки и в своём
 * месяце она дальше `FORM_FREE_MONTHLY_SUBMISSIONS`-й по времени.
 */
export async function lockedSubmissionIds(
  ownerUserId: string,
  submissions: { id: string; createdAt: Date; formPreset?: string | null }[]
): Promise<Set<string>> {
  const locked = new Set<string>();
  const candidates = submissions.filter((s) => !isLimitExemptPreset(s.formPreset));
  if (candidates.length === 0) return locked;
  if (await ownerHasUnlimitedForms(ownerUserId)) return locked;

  const byMonth = new Map<string, { start: Date; end: Date; ids: string[] }>();
  for (const s of candidates) {
    const range = mskMonthRange(s.createdAt);
    const bucket = byMonth.get(range.key) ?? { start: range.start, end: range.end, ids: [] };
    bucket.ids.push(s.id);
    byMonth.set(range.key, bucket);
  }

  for (const { start, end, ids } of byMonth.values()) {
    const allowed = await prisma.formSubmission.findMany({
      where: countableWhere(ownerUserId, start, end),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: FORM_FREE_MONTHLY_SUBMISSIONS,
      select: { id: true },
    });
    const allowedIds = new Set(allowed.map((a) => a.id));
    for (const id of ids) if (!allowedIds.has(id)) locked.add(id);
  }
  return locked;
}

/** Заявка для API кабинета: у скрытой значения вырезаны. */
export function maskLockedSubmission<T extends { id: string; values: unknown }>(
  submission: T,
  locked: Set<string>
): T & { locked: boolean } {
  if (!locked.has(submission.id)) return { ...submission, locked: false };
  return { ...submission, values: {}, locked: true };
}
