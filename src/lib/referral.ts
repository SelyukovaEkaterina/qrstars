/**
 * «Приведи друга» (с 2026-11-15, заменила денежную партнёрку 15%).
 *
 * Первая оплата PRO или «Сети» приглашённым (`User.referredById`) даёт:
 * - другу — +REFERRAL_BONUS_DAYS к только что оплаченному периоду;
 * - пригласившему — +REFERRAL_BONUS_DAYS PRO: продление текущей платной
 *   подписки (автосписание сдвигается) или подарочная подписка без списаний
 *   (`Subscription.giftReason = "referral"`), если он на FREE.
 *
 * Награда одна на друга: `ReferralReward.friendId` unique.
 */
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { hasPaidFeatures, type PlanId } from "@/lib/plans";
import { sendMail } from "@/lib/mailer";
import { renderEmailLayout } from "@/lib/email-layout";
import { logUserEvent } from "@/lib/user-events-server";
import { getAppBaseUrl } from "@/lib/utils";
import { normalizeInviteEmail } from "@/lib/establishment-access";
import { REFERRAL_BONUS_DAYS } from "@/lib/referral-shared";

export { REFERRAL_BONUS_DAYS };
export { maskEmail, giftRemainingMs } from "@/lib/referral-shared";
export const REFERRAL_GIFT_REASON = "referral";

const MS_DAY = 24 * 60 * 60 * 1000;

/** Пригласивший по реферальному коду; сам себя пригласить нельзя. */
export async function findReferrerId(
  referralCode: string | null | undefined,
  newUserEmail: string,
): Promise<string | null> {
  if (!referralCode) return null;
  const referrer = await prisma.user.findUnique({
    where: { referralCode },
    select: { id: true, email: true },
  });
  if (!referrer) return null;
  if (normalizeInviteEmail(referrer.email) === normalizeInviteEmail(newUserEmail)) return null;
  return referrer.id;
}

function addDays(base: Date | null, days: number, now: Date): Date {
  const from = base && base > now ? base : now;
  return new Date(from.getTime() + days * MS_DAY);
}

/**
 * Начисляет награды за первую оплату приглашённого. Вызывается после
 * активации подписки друга (`handlePaidPaymentOrder`, kind INITIAL).
 * Никогда не бросает: сбой бонуса не должен ломать вебхук оплаты.
 */
export async function grantReferralRewards(params: {
  friendId: string;
  plan: PlanId;
  invId: number;
}): Promise<{ granted: boolean; referrerId?: string }> {
  try {
    return await grantReferralRewardsUnsafe(params);
  } catch (err) {
    console.error("grantReferralRewards:", err);
    return { granted: false };
  }
}

async function grantReferralRewardsUnsafe(params: {
  friendId: string;
  plan: PlanId;
  invId: number;
}): Promise<{ granted: boolean; referrerId?: string }> {
  if (!hasPaidFeatures(params.plan)) return { granted: false };

  const friend = await prisma.user.findUnique({
    where: { id: params.friendId },
    select: { referredById: true },
  });
  const referrerId = friend?.referredById;
  if (!referrerId || referrerId === params.friendId) return { granted: false };

  const now = new Date();
  let referrerUntil: Date;
  try {
    referrerUntil = await prisma.$transaction(async (tx) => {
      await tx.referralReward.create({
        data: {
          referrerId,
          friendId: params.friendId,
          invId: params.invId,
          plan: params.plan,
          referrerDays: REFERRAL_BONUS_DAYS,
          friendDays: REFERRAL_BONUS_DAYS,
        },
      });

      // Друг: +дни к подписке, созданной этой оплатой.
      const friendSub = await tx.subscription.findFirst({
        where: { userId: params.friendId, status: "ACTIVE", invoiceId: params.invId },
        orderBy: { createdAt: "desc" },
      });
      if (friendSub) {
        await tx.subscription.update({
          where: { id: friendSub.id },
          data: { currentPeriodEnd: addDays(friendSub.currentPeriodEnd, REFERRAL_BONUS_DAYS, now) },
        });
      }

      // Пригласивший: продлеваем действующую платную подписку или дарим PRO.
      const active = await tx.subscription.findMany({
        where: { userId: referrerId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      });
      const paid = active.find((s) => hasPaidFeatures(s.plan));
      if (paid) {
        const until = addDays(paid.currentPeriodEnd, REFERRAL_BONUS_DAYS, now);
        await tx.subscription.update({
          where: { id: paid.id },
          // Сдвинутая дата списания — напоминания должны уйти заново под новую дату.
          data: { currentPeriodEnd: until, renewalNoticeSentAt: null, priceChangeNoticeSentAt: null },
        });
        return until;
      }
      const until = addDays(now, REFERRAL_BONUS_DAYS, now);
      await tx.subscription.create({
        data: {
          userId: referrerId,
          plan: "PRO",
          status: "ACTIVE",
          giftReason: REFERRAL_GIFT_REASON,
          currentPeriodStart: now,
          currentPeriodEnd: until,
        },
      });
      // Микросайт, созданный за подарочный месяц, остаётся опубликованным после него.
      await tx.user.updateMany({
        where: { id: referrerId, firstPaidAccessAt: null },
        data: { firstPaidAccessAt: now },
      });
      return until;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { granted: false, referrerId };
    }
    throw err;
  }

  logUserEvent(referrerId, "dash.referral_rewarded", {
    role: "referrer",
    plan: params.plan,
    days: REFERRAL_BONUS_DAYS,
  });
  logUserEvent(params.friendId, "dash.referral_rewarded", {
    role: "friend",
    plan: params.plan,
    days: REFERRAL_BONUS_DAYS,
  });

  void sendReferrerRewardEmail(referrerId, referrerUntil).catch((err) =>
    console.error("sendReferrerRewardEmail:", err)
  );

  return { granted: true, referrerId };
}

async function sendReferrerRewardEmail(referrerId: string, until: Date) {
  const user = await prisma.user.findUnique({
    where: { id: referrerId },
    select: { email: true },
  });
  if (!user?.email) return;
  const base = getAppBaseUrl();
  const untilText = until.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow",
  });
  const html = renderEmailLayout({
    userId: referrerId,
    showUnsubscribe: false,
    preheader: `Друг оплатил PRO — дарим вам месяц PRO`,
    title: "Ваш друг подключил PRO — месяц PRO вам в подарок",
    bodyHtml: `<p style="margin:0 0 12px;font-size:16px;">Спасибо, что рекомендуете QrStars! Человек, которого вы пригласили, оплатил тариф.</p>
      <p style="margin:0 0 12px;font-size:16px;">Мы добавили вам <strong>${REFERRAL_BONUS_DAYS} дней PRO</strong>: доступ действует до <strong>${untilText}</strong>. Если у вас подписка с автопродлением, следующее списание сдвинулось на эту дату.</p>
      <p style="margin:0;font-size:16px;">Каждый следующий друг — ещё месяц.</p>`,
    cta: { label: "Пригласить ещё", href: `${base}/dashboard/partner` },
  });
  await sendMail(user.email, "Месяц PRO в подарок за приглашённого друга", html, {
    kind: "other",
  });
}
