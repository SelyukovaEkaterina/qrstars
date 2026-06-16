import prisma from "@/lib/prisma";
import {
  calcSubscriptionAmount,
  formatPlanLabel,
  type BillingPeriod,
  type PlanId,
} from "@/lib/plans";
import { countUserEstablishments } from "@/lib/subscription-utils";
import { createRecurringPayment } from "@/lib/robokassa";
import {
  sendRenewalFailedEmail,
  sendRenewalNoticeEmail,
  sendPriceChangeNoticeEmail,
  sendPlatformTariffChangeEmail,
} from "@/lib/subscription-renewal-emails";
import {
  calcUpcomingRenewalAmount,
  getLastPaidSubscriptionAmount,
  priceChangeNoticeWindow,
} from "@/lib/subscription-billing-utils";
import {
  getPlatformTariffChangeBanner,
  tariffChangeEmailWindow,
  TARIFF_CHANGE_EFFECTIVE_KEY,
  TARIFF_CHANGE_EMAILS_SENT_KEY,
  TARIFF_CHANGE_MESSAGE_KEY,
} from "@/lib/tariff-change-notice";

const MAX_RENEWAL_ATTEMPTS = 3;
const NOTICE_DAYS_BEFORE = 3;
const MS_DAY = 24 * 60 * 60 * 1000;

export interface RenewalBatchResult {
  noticesSent: number;
  priceChangeNoticesSent: number;
  platformTariffEmailsSent: number;
  expired: number;
  renewalsInitiated: number;
  renewalsFailed: number;
  canceled: number;
}

export async function runSubscriptionRenewalBatch(): Promise<RenewalBatchResult> {
  const result: RenewalBatchResult = {
    noticesSent: 0,
    priceChangeNoticesSent: 0,
    platformTariffEmailsSent: 0,
    expired: 0,
    renewalsInitiated: 0,
    renewalsFailed: 0,
    canceled: 0,
  };

  const now = new Date();

  const toExpire = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      currentPeriodEnd: { lt: now },
      OR: [{ cancelAtPeriodEnd: true }, { parentInvoiceId: null }],
    },
    include: { user: { select: { email: true } } },
  });

  for (const sub of toExpire) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "CANCELED" },
    });
    result.expired++;
  }

  await sendPlatformTariffChangeEmails(now, result);

  const priceWindow = priceChangeNoticeWindow(now);
  const forPriceChange = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      parentInvoiceId: { not: null },
      currentPeriodEnd: { gte: priceWindow.start, lte: priceWindow.end },
      priceChangeNoticeSentAt: null,
    },
    include: { user: { select: { email: true } } },
  });

  for (const sub of forPriceChange) {
    if (!sub.currentPeriodEnd || !sub.billing || !sub.user.email) continue;
    const plan = sub.plan as PlanId;
    if (plan !== "PRO" && plan !== "NETWORK") continue;

    const newAmount = await calcUpcomingRenewalAmount(sub);
    if (newAmount == null) continue;

    const previousAmount = await getLastPaidSubscriptionAmount(sub.userId);
    if (
      previousAmount == null ||
      Math.abs(newAmount - previousAmount) < 0.01
    ) {
      continue;
    }

    await sendPriceChangeNoticeEmail({
      to: sub.user.email,
      previousAmount,
      newAmount,
      chargeDate: sub.currentPeriodEnd,
      planLabel: formatPlanLabel(plan),
    });

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { priceChangeNoticeSentAt: now },
    });
    result.priceChangeNoticesSent++;
  }

  const noticeWindowStart = new Date(now.getTime() + (NOTICE_DAYS_BEFORE - 1) * MS_DAY);
  const noticeWindowEnd = new Date(now.getTime() + (NOTICE_DAYS_BEFORE + 1) * MS_DAY);

  const forNotice = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      parentInvoiceId: { not: null },
      currentPeriodEnd: { gte: noticeWindowStart, lte: noticeWindowEnd },
      renewalNoticeSentAt: null,
    },
    include: { user: { select: { email: true } } },
  });

  for (const sub of forNotice) {
    if (!sub.currentPeriodEnd || !sub.billing || !sub.user.email) continue;
    const plan = sub.plan as PlanId;
    if (plan !== "PRO" && plan !== "NETWORK") continue;
    const billing = sub.billing as BillingPeriod;
    const estCount = await countUserEstablishments(sub.userId);
    const amount = calcSubscriptionAmount(plan, billing, estCount);

    await sendRenewalNoticeEmail({
      to: sub.user.email,
      amount,
      chargeDate: sub.currentPeriodEnd,
      planLabel: formatPlanLabel(plan),
    });

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { renewalNoticeSentAt: now },
    });
    result.noticesSent++;
  }

  const dueSubs = await prisma.subscription.findMany({
    where: {
      status: { in: ["ACTIVE", "PAST_DUE"] },
      cancelAtPeriodEnd: false,
      parentInvoiceId: { not: null },
      currentPeriodEnd: { lte: new Date(now.getTime() + MS_DAY) },
    },
    include: { user: { select: { email: true } } },
  });

  for (const sub of dueSubs) {
    if (!sub.parentInvoiceId || !sub.billing) continue;

    const pendingRenewal = await prisma.paymentOrder.findFirst({
      where: {
        userId: sub.userId,
        kind: "RENEWAL",
        status: "PENDING",
        parentInvId: sub.parentInvoiceId,
      },
    });
    if (pendingRenewal) continue;

    const plan = sub.plan as PlanId;
    if (plan !== "PRO" && plan !== "NETWORK") continue;
    const billing = sub.billing as BillingPeriod;
    const estCount = await countUserEstablishments(sub.userId);
    const amount = calcSubscriptionAmount(plan, billing, estCount);
    const planLabel = formatPlanLabel(plan);
    const periodLabel = billing === "yearly" ? "1 год" : "1 месяц";

    const order = await prisma.paymentOrder.create({
      data: {
        kind: "RENEWAL",
        parentInvId: sub.parentInvoiceId,
        userId: sub.userId,
        plan,
        billing,
        amount,
        status: "PENDING",
      },
    });

    try {
      const rk = await createRecurringPayment({
        invId: order.invId,
        previousInvId: sub.parentInvoiceId,
        amount,
        description: `QrStars ${planLabel} — продление на ${periodLabel}`,
        plan,
        billing,
        userId: sub.userId,
      });

      if (!rk.ok) {
        await prisma.paymentOrder.update({
          where: { id: order.id },
          data: { status: "FAILED" },
        });
        await handleRenewalFailure(sub.id, sub.user.email, planLabel, result);
      } else {
        result.renewalsInitiated++;
      }
    } catch {
      await prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: "FAILED" },
      });
      await handleRenewalFailure(sub.id, sub.user.email, planLabel, result);
    }
  }

  const staleCutoff = new Date(now.getTime() - 2 * MS_DAY);
  const staleOrders = await prisma.paymentOrder.findMany({
    where: {
      kind: "RENEWAL",
      status: "PENDING",
      createdAt: { lt: staleCutoff },
    },
  });

  for (const order of staleOrders) {
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { status: "FAILED" },
    });
    const sub = await prisma.subscription.findFirst({
      where: { userId: order.userId, parentInvoiceId: order.parentInvId ?? undefined },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true } } },
    });
    if (sub) {
      await handleRenewalFailure(
        sub.id,
        sub.user.email,
        formatPlanLabel(order.plan as PlanId),
        result
      );
    }
  }

  return result;
}

async function sendPlatformTariffChangeEmails(
  now: Date,
  result: RenewalBatchResult
) {
  const effectiveMeta = await prisma.platformMeta.findUnique({
    where: { key: TARIFF_CHANGE_EFFECTIVE_KEY },
  });
  if (!effectiveMeta?.value) return;

  const effectiveAt = new Date(effectiveMeta.value);
  if (Number.isNaN(effectiveAt.getTime()) || effectiveAt <= now) return;

  const window = tariffChangeEmailWindow(now);
  if (effectiveAt < window.start || effectiveAt > window.end) return;

  const sentMeta = await prisma.platformMeta.findUnique({
    where: { key: TARIFF_CHANGE_EMAILS_SENT_KEY },
  });
  if (sentMeta?.value === effectiveMeta.value) return;

  const messageMeta = await prisma.platformMeta.findUnique({
    where: { key: TARIFF_CHANGE_MESSAGE_KEY },
  });

  const subs = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      parentInvoiceId: { not: null },
      plan: { in: ["PRO", "NETWORK"] },
    },
    include: { user: { select: { email: true } } },
  });

  for (const sub of subs) {
    if (!sub.user.email || !sub.billing) continue;
    const plan = sub.plan as "PRO" | "NETWORK";
    const billing = sub.billing as BillingPeriod;
    const estCount = await countUserEstablishments(sub.userId);
    const amount = calcSubscriptionAmount(plan, billing, estCount);

    await sendPlatformTariffChangeEmail({
      to: sub.user.email,
      planLabel: formatPlanLabel(plan),
      amount,
      effectiveDate: effectiveAt,
      message: messageMeta?.value ?? null,
    });
    result.platformTariffEmailsSent++;
  }

  await prisma.platformMeta.upsert({
    where: { key: TARIFF_CHANGE_EMAILS_SENT_KEY },
    create: { key: TARIFF_CHANGE_EMAILS_SENT_KEY, value: effectiveMeta.value },
    update: { value: effectiveMeta.value },
  });
}

async function handleRenewalFailure(
  subscriptionId: string,
  email: string | null | undefined,
  planLabel: string,
  result: RenewalBatchResult
) {
  const sub = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { renewalAttempts: { increment: 1 } },
  });

  result.renewalsFailed++;

  if (sub.renewalAttempts >= MAX_RENEWAL_ATTEMPTS) {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: "CANCELED" },
    });
    result.canceled++;
    if (email) {
      await sendRenewalFailedEmail({ to: email, planLabel });
    }
  } else {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: "PAST_DUE" },
    });
  }
}
