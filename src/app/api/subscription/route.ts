import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { buildPaymentRequest, isRobokassaConfigured, resolvePaymentRedirectUrl } from "@/lib/robokassa";
import {
  calcSubscriptionAmount,
  hasPaidFeatures,
  PLANS,
  type BillingPeriod,
} from "@/lib/plans";
import {
  buildSubscriptionContext,
  countUserEstablishments,
  findLatestSubscription,
  findActiveSubscription,
} from "@/lib/subscription-utils";
import { buildRenewalPriceChangeNotice } from "@/lib/subscription-billing-utils";
import { getPlatformTariffChangeBanner } from "@/lib/tariff-change-notice";
import { notifyPaymentAttempt } from "@/lib/telegram-support";
import { LEGAL_OFFER_URL, LEGAL_OFFER_VERSION } from "@/lib/legal-urls";

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

  const [renewalPriceChange, platformTariffChange] = await Promise.all([
    activeSubscription
      ? buildRenewalPriceChangeNotice(activeSubscription)
      : Promise.resolve(null),
    getPlatformTariffChangeBanner(),
  ]);

  return NextResponse.json({
    subscription: activeSubscription ?? latestSubscription,
    ...ctx,
    plans: PLANS,
    renewalPriceChange,
    platformTariffChange,
  });
}

function clientIp(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();
  const { action, plan: targetPlan, billing: billingRaw, recurringConsent } = body;
  const billing: BillingPeriod =
    billingRaw === "yearly" ? "yearly" : "monthly";

  if (action === "subscribe") {
    const plan = targetPlan as "PRO" | "NETWORK";
    if (plan !== "PRO" && plan !== "NETWORK") {
      return NextResponse.json({ error: "Укажите тариф PRO или Сеть" }, { status: 400 });
    }

    if (!recurringConsent) {
      return NextResponse.json(
        { error: "Необходимо согласие на автоматические списания" },
        { status: 400 }
      );
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

    if (!isRobokassaConfigured()) {
      const periodMs =
        billing === "yearly" ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
      await prisma.subscription.upsert({
        where: { id: `mock-${userId}` },
        update: {
          plan,
          status: "ACTIVE",
          billing,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + periodMs),
          cancelAtPeriodEnd: false,
        },
        create: {
          id: `mock-${userId}`,
          plan,
          status: "ACTIVE",
          billing,
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

    const consentLog = await prisma.recurringConsentLog.create({
      data: {
        userId,
        plan,
        billing,
        amount,
        offerUrl: LEGAL_OFFER_URL,
        offerVersion: LEGAL_OFFER_VERSION,
        ipAddress: clientIp(request),
        userAgent: request.headers.get("user-agent"),
      },
    });

    const order = await prisma.paymentOrder.create({
      data: {
        kind: "INITIAL",
        userId,
        plan,
        billing,
        amount,
        status: "PENDING",
        consentLogId: consentLog.id,
      },
    });

    await prisma.recurringConsentLog.update({
      where: { id: consentLog.id },
      data: { paymentOrderId: order.id },
    });

    const paymentPost = buildPaymentRequest({
      invId: order.invId,
      amount,
      description: `QrStars ${planLabel}, podpiska ${periodLabel}`.slice(0, 100),
      plan,
      billing,
      userId,
    });

    const paymentRedirectUrl = await resolvePaymentRedirectUrl(paymentPost);

    if (!paymentRedirectUrl) {
      console.error("Robokassa redirect URL missing for invId", order.invId);
    }

    void notifyPaymentAttempt({
      userId,
      email: session.user.email ?? "—",
      name: session.user.name ?? null,
      plan,
      billing,
      amount,
      establishmentCount,
      paymentId: String(order.invId),
    }).catch((err) => console.error("notifyPaymentAttempt:", err));

    return NextResponse.json({
      paymentRedirectUrl,
      paymentPost,
      paymentId: order.invId,
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
