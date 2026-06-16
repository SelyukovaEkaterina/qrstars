import prisma from "@/lib/prisma";
import type { BillingPeriod, PlanId } from "@/lib/plans";

const PARTNER_COMMISSION_RATE = 0.15;
const HOLD_DAYS = 30;

export function subscriptionPeriodMs(billing: BillingPeriod | string | undefined): number {
  if (billing === "yearly") return 365 * 24 * 60 * 60 * 1000;
  return 30 * 24 * 60 * 60 * 1000;
}

export async function createPartnerEarning(params: {
  userId: string;
  plan: PlanId;
  paymentAmount: number;
  paymentId: string;
}) {
  const payingUser = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { referredById: true },
  });

  if (!payingUser?.referredById) return;

  const commissionAmount =
    Math.round(params.paymentAmount * PARTNER_COMMISSION_RATE * 100) / 100;
  const availableAt = new Date(Date.now() + HOLD_DAYS * 24 * 60 * 60 * 1000);
  const planLabel = params.plan === "NETWORK" ? "Сеть" : "PRO";

  await prisma.partnerEarning.create({
    data: {
      amount: commissionAmount,
      paymentAmount: params.paymentAmount,
      status: "PENDING",
      availableAt,
      paymentId: params.paymentId,
      description: `15% от оплаты подписки ${planLabel} (${params.paymentAmount} ₽)`,
      partner: { connect: { id: payingUser.referredById } },
      referralUser: { connect: { id: params.userId } },
    },
  });
}

export async function activateSubscription(params: {
  userId: string;
  plan: PlanId;
  billing: BillingPeriod;
  invoiceId: number;
  amount: number;
}) {
  const periodEnd = new Date(Date.now() + subscriptionPeriodMs(params.billing));

  await prisma.subscription.create({
    data: {
      plan: params.plan,
      status: "ACTIVE",
      userId: params.userId,
      invoiceId: params.invoiceId,
      parentInvoiceId: params.invoiceId,
      billing: params.billing,
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      renewalAttempts: 0,
      renewalNoticeSentAt: null,
      priceChangeNoticeSentAt: null,
    },
  });

  await createPartnerEarning({
    userId: params.userId,
    plan: params.plan,
    paymentAmount: params.amount,
    paymentId: String(params.invoiceId),
  });
}

export async function renewSubscription(params: {
  subscriptionId: string;
  invoiceId: number;
  amount: number;
  billing: BillingPeriod;
  plan: PlanId;
  userId: string;
}) {
  const sub = await prisma.subscription.findUnique({
    where: { id: params.subscriptionId },
  });
  if (!sub) return;

  const base =
    sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()
      ? sub.currentPeriodEnd
      : new Date();
  const periodEnd = new Date(base.getTime() + subscriptionPeriodMs(params.billing));

  await prisma.subscription.update({
    where: { id: params.subscriptionId },
    data: {
      status: "ACTIVE",
      invoiceId: params.invoiceId,
      billing: params.billing,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      renewalAttempts: 0,
      renewalNoticeSentAt: null,
      priceChangeNoticeSentAt: null,
    },
  });

  await createPartnerEarning({
    userId: params.userId,
    plan: params.plan,
    paymentAmount: params.amount,
    paymentId: String(params.invoiceId),
  });
}

export async function handlePaidPaymentOrder(invId: number) {
  const order = await prisma.paymentOrder.findUnique({ where: { invId } });
  if (!order || order.status === "PAID") {
    return order;
  }

  await prisma.paymentOrder.update({
    where: { invId },
    data: { status: "PAID", paidAt: new Date() },
  });

  const amount = Number(order.amount);
  const billing = order.billing as BillingPeriod;
  const plan = order.plan as PlanId;

  if (order.kind === "INITIAL") {
    const existing = await prisma.subscription.findFirst({
      where: { userId: order.userId, status: "ACTIVE", plan: { not: "FREE" } },
    });
    if (existing) {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: { status: "CANCELED", cancelAtPeriodEnd: false },
      });
    }
    await activateSubscription({
      userId: order.userId,
      plan,
      billing,
      invoiceId: invId,
      amount,
    });
  } else {
    const sub = await prisma.subscription.findFirst({
      where: {
        userId: order.userId,
        status: { in: ["ACTIVE", "PAST_DUE"] },
        parentInvoiceId: order.parentInvId ?? undefined,
      },
      orderBy: { createdAt: "desc" },
    });
    if (sub) {
      await renewSubscription({
        subscriptionId: sub.id,
        invoiceId: invId,
        amount,
        billing,
        plan,
        userId: order.userId,
      });
    }
  }

  return order;
}
