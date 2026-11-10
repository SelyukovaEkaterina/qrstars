import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { buildPaymentRequest, isRobokassaConfigured, resolvePaymentRedirectUrl } from "@/lib/robokassa";
import {
  billingPeriodLabel,
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
import { markFirstPaidAccess, subscriptionPeriodMs } from "@/lib/subscription-activate";
import { getPlatformTariffChangeBanner } from "@/lib/tariff-change-notice";
import { notifyPaymentAttempt } from "@/lib/telegram-support";
import { LEGAL_OFFER_URL, LEGAL_OFFER_VERSION } from "@/lib/legal-urls";
import {
  IntroOfferError,
  findActiveProIntroOffer,
  introOfferPublicView,
  markProIntroOfferUsed,
  resolveProIntroOfferAmount,
} from "@/lib/subscription-intro-offer";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const [activeSubscription, latestSubscription, establishmentCount] =
    await Promise.all([
      findActiveSubscription(userId),
      findLatestSubscription(userId),
      countUserEstablishments(userId),
    ]);

  const ctx = buildSubscriptionContext(activeSubscription, establishmentCount);

  const [renewalPriceChange, platformTariffChange, introOffer] = await Promise.all([
    activeSubscription
      ? buildRenewalPriceChangeNotice(activeSubscription)
      : Promise.resolve(null),
    getPlatformTariffChangeBanner(),
    findActiveProIntroOffer(userId),
  ]);

  return NextResponse.json({
    subscription: activeSubscription ?? latestSubscription,
    ...ctx,
    plans: PLANS,
    renewalPriceChange,
    platformTariffChange,
    introOffer:
      introOffer && !hasPaidFeatures(ctx.plan) ? introOfferPublicView(introOffer) : null,
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
  const requestedPlan = body.plan as string | undefined;
  // PRO — на год (по умолчанию) или на полгода; «Сеть» — только на год.
  const billing: BillingPeriod =
    requestedPlan === "PRO" && billingRaw === "halfyear"
      ? "halfyear"
      : billingRaw === "yearly" || requestedPlan === "PRO" || requestedPlan === "NETWORK"
        ? "yearly"
        : "monthly";

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
      if (!isUpgrade && !existing.isTrial) {
        return NextResponse.json(
          { error: "У вас уже есть активная платная подписка" },
          { status: 400 }
        );
      }
      // Текущую подписку (PRO при апгрейде до «Сети», триал) гасит сама оплата —
      // handlePaidPaymentOrder. Отменять её здесь нельзя: брошенный чекаут
      // оставлял владельца на FREE с уже оплаченным периодом PRO.
    }

    const establishmentCount = await countUserEstablishments(userId);
    const catalogAmount = calcSubscriptionAmount(plan, billing, establishmentCount);
    let amount = catalogAmount;
    let introOfferId: string | null = null;
    try {
      const resolved = await resolveProIntroOfferAmount({
        userId,
        plan,
        billing,
        catalogAmount,
        requestedCode: body.promoCode,
      });
      amount = resolved.amount;
      introOfferId = resolved.offerId;
    } catch (err) {
      if (err instanceof IntroOfferError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
    const planLabel = plan === "PRO" ? "PRO" : "Сеть";
    const periodLabel = billingPeriodLabel(billing);

    if (!isRobokassaConfigured()) {
      const periodMs = subscriptionPeriodMs(billing);
      // Mock-оплата «прошла» сразу — гасим прежнюю подписку, как handlePaidPaymentOrder.
      await prisma.subscription.updateMany({
        where: {
          userId,
          status: "ACTIVE",
          plan: { not: "FREE" },
          id: { not: `mock-${userId}` },
        },
        data: { status: "CANCELED", cancelAtPeriodEnd: false },
      });
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

      await markFirstPaidAccess(userId);
      if (introOfferId) {
        await markProIntroOfferUsed(userId, amount);
      }

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
        amount,
        message:
          "Функционал оплаты пока недоступен. Поздравляем — вы получили платный тариф бесплатно!",
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
      description: `QrStars ${planLabel}, подписка ${periodLabel}`.slice(0, 100),
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
