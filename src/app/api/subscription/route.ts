import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createPayment } from "@/lib/yookassa";
import {
  calcSubscriptionAmount,
  formatRub,
  hasPaidFeatures,
  PLANS,
  type BillingPeriod,
  type PlanId,
} from "@/lib/plans";
import {
  buildSubscriptionContext,
  countUserEstablishments,
  findLatestSubscription,
  findActiveSubscription,
} from "@/lib/subscription-utils";
import { notifyPaymentAttempt } from "@/lib/telegram-support";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const [activeSubscription, latestSubscription, establishmentCount] = await Promise.all([
    findActiveSubscription(userId),
    findLatestSubscription(userId),
    countUserEstablishments(userId),
  ]);

  const ctx = buildSubscriptionContext(activeSubscription, establishmentCount);

  return NextResponse.json({
    subscription: activeSubscription ?? latestSubscription,
    ...ctx,
    plans: PLANS,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();
  const { action, plan: targetPlan, billing: billingRaw } = body;
  const billing: BillingPeriod =
    billingRaw === "yearly" ? "yearly" : "monthly";

  if (action === "subscribe") {
    const plan = targetPlan as "PRO" | "NETWORK";
    if (plan !== "PRO" && plan !== "NETWORK") {
      return NextResponse.json({ error: "Укажите тариф PRO или Сеть" }, { status: 400 });
    }

    const existing = await findActiveSubscription(userId);
    if (existing && hasPaidFeatures(existing.plan)) {
      const isUpgrade = existing.plan === "PRO" && plan === "NETWORK";
      if (!isUpgrade) {
        return NextResponse.json(
          { error: "У вас уже есть активная платная подписка" },
          { status: 400 }
        );
      }
      await prisma.subscription.update({
        where: { id: existing.id },
        data: { status: "CANCELED", cancelAtPeriodEnd: false },
      });
    }

    const establishmentCount = await countUserEstablishments(userId);
    const amount = calcSubscriptionAmount(plan, billing, establishmentCount);
    const planLabel = plan === "PRO" ? "PRO" : "Сеть";
    const periodLabel = billing === "yearly" ? "1 год" : "1 месяц";

    if (!process.env.YOOKASSA_SHOP_ID) {
      const periodMs =
        billing === "yearly" ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
      await prisma.subscription.upsert({
        where: { id: `mock-${userId}` },
        update: {
          plan,
          status: "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + periodMs),
          cancelAtPeriodEnd: false,
        },
        create: {
          id: `mock-${userId}`,
          plan,
          status: "ACTIVE",
          user: { connect: { id: userId } },
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + periodMs),
        },
      });

      void notifyPaymentAttempt({
        userId,
        email: session.user.email ?? "—",
        name: session.user.name ?? null,
        plan,
        billing,
        amount,
        establishmentCount,
        mockActivation: true,
      }).catch((err) => console.error("notifyPaymentAttempt:", err));

      return NextResponse.json({
        success: true,
        mode: "mock",
        plan,
        message:
          "Функционал оплаты пока не доступен. Поздравляем - вы получили платный тариф бесплатно!",
      });
    }

    const payment = await createPayment(
      amount,
      `QrStars.ru ${planLabel} — подписка на ${periodLabel}`,
      userId,
      { type: "subscription", plan, billing }
    );

    void notifyPaymentAttempt({
      userId,
      email: session.user.email ?? "—",
      name: session.user.name ?? null,
      plan,
      billing,
      amount,
      establishmentCount,
      paymentId: payment.id,
    }).catch((err) => console.error("notifyPaymentAttempt:", err));

    return NextResponse.json({
      paymentUrl: payment.confirmation?.confirmation_url,
      paymentId: payment.id,
      amount,
    });
  }

  if (action === "cancel") {
    await prisma.subscription.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { cancelAtPeriodEnd: true },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
