import prisma from "@/lib/prisma";
import { hasPaidFeatures } from "@/lib/plans";

export const PRO_TRIAL_DAYS = 14;

/** За сколько дней до конца триала предупреждаем письмом. */
export const PRO_TRIAL_NOTICE_DAYS = 3;

const MS_DAY = 24 * 60 * 60 * 1000;

export type ProTrialState = {
  /** Триал идёт сейчас. */
  active: boolean;
  /** Триал уже выдавали — повторно нельзя. */
  used: boolean;
  /** Можно запустить триал прямо сейчас. */
  eligible: boolean;
  endsAt: Date | null;
  daysLeft: number | null;
};

export type StartProTrialResult =
  | { ok: true; endsAt: Date }
  | { ok: false; error: string; status: number };

/** Дней до конца триала, минимум 0 (начатый день считается целым). */
export function proTrialDaysLeft(endsAt: Date | null | undefined, now: Date = new Date()): number {
  if (!endsAt) return 0;
  const ms = endsAt.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / MS_DAY);
}

export function proTrialEndDate(startedAt: Date = new Date()): Date {
  return new Date(startedAt.getTime() + PRO_TRIAL_DAYS * MS_DAY);
}

export async function getProTrialState(userId: string): Promise<ProTrialState> {
  const [user, subs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { proTrialStartedAt: true },
    }),
    prisma.subscription.findMany({
      where: { userId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: { plan: true, isTrial: true, currentPeriodEnd: true },
    }),
  ]);

  const used = !!user?.proTrialStartedAt;
  const activeTrial = subs.find((s) => s.isTrial) ?? null;
  const hasPaidSubscription = subs.some((s) => !s.isTrial && hasPaidFeatures(s.plan));

  return {
    active: !!activeTrial,
    used,
    eligible: !used && !hasPaidSubscription,
    endsAt: activeTrial?.currentPeriodEnd ?? null,
    daysLeft: activeTrial?.currentPeriodEnd
      ? proTrialDaysLeft(activeTrial.currentPeriodEnd)
      : null,
  };
}

/**
 * Запускает пробный PRO на {@link PRO_TRIAL_DAYS} дней без оплаты и без карты.
 * Подписка создаётся с `parentInvoiceId = null`, поэтому cron продления её не
 * списывает, а только переводит в `CANCELED` по истечении срока.
 */
export async function startProTrial(userId: string): Promise<StartProTrialResult> {
  const state = await getProTrialState(userId);

  if (state.active) {
    return { ok: false, error: "Пробный период уже активен", status: 409 };
  }
  if (state.used) {
    return { ok: false, error: "Пробный период уже был использован", status: 409 };
  }
  if (!state.eligible) {
    return { ok: false, error: "У вас уже подключён платный тариф", status: 409 };
  }

  const startedAt = new Date();
  const endsAt = proTrialEndDate(startedAt);

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.user.updateMany({
        where: { id: userId, proTrialStartedAt: null },
        data: { proTrialStartedAt: startedAt },
      });
      if (claimed.count === 0) {
        throw new Error("TRIAL_ALREADY_CLAIMED");
      }

      await tx.user.updateMany({
        where: { id: userId, firstPaidAccessAt: null },
        data: { firstPaidAccessAt: startedAt },
      });

      await tx.subscription.create({
        data: {
          plan: "PRO",
          status: "ACTIVE",
          isTrial: true,
          billing: null,
          currentPeriodStart: startedAt,
          currentPeriodEnd: endsAt,
          cancelAtPeriodEnd: false,
          user: { connect: { id: userId } },
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "TRIAL_ALREADY_CLAIMED") {
      return { ok: false, error: "Пробный период уже был использован", status: 409 };
    }
    throw err;
  }

  return { ok: true, endsAt };
}
