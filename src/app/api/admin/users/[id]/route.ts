import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { markFirstPaidAccess } from "@/lib/subscription-activate";
import { PRO_INTRO_OFFER } from "@/lib/plans";
import { PRO_OFFER_CAMPAIGN_STARTED_AT_KEY } from "@/lib/subscription-intro-offer";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      registrationSource: true,
      registrationUtm: true,
      metrikaClientId: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const { role, subscriptionPlan, subscriptionStatus, marketingEmailsEnabled, createdAt, firstScanAt, scansCount, introOfferExpiresAt, proOfferCampaignStartedAt, backdateProOfferSendsTo, reportsEmailEnabled, reportsTelegramEnabled, reportsMaxEnabled, resetPaidHistory } = body;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userUpdate: {
    role?: typeof user.role;
    marketingEmailsEnabled?: boolean;
    createdAt?: Date;
    firstScanAt?: Date;
    reportsEmailEnabled?: boolean;
    reportsTelegramEnabled?: boolean;
    reportsMaxEnabled?: boolean;
  } = {};

  if (role) {
    userUpdate.role = role;
  }

  if (typeof marketingEmailsEnabled === "boolean") {
    userUpdate.marketingEmailsEnabled = marketingEmailsEnabled;
  }

  if (typeof reportsEmailEnabled === "boolean") {
    userUpdate.reportsEmailEnabled = reportsEmailEnabled;
  }
  if (typeof reportsTelegramEnabled === "boolean") {
    userUpdate.reportsTelegramEnabled = reportsTelegramEnabled;
  }
  if (typeof reportsMaxEnabled === "boolean") {
    userUpdate.reportsMaxEnabled = reportsMaxEnabled;
  }

  if (createdAt && process.env.E2E_TESTING === "true") {
    const parsed = new Date(createdAt);
    if (!Number.isNaN(parsed.getTime())) {
      userUpdate.createdAt = parsed;
    }
  }

  if (firstScanAt && process.env.E2E_TESTING === "true") {
    const parsed = new Date(firstScanAt);
    if (!Number.isNaN(parsed.getTime())) {
      userUpdate.firstScanAt = parsed;
    }
  }

  if (Object.keys(userUpdate).length > 0) {
    await prisma.user.update({ where: { id }, data: userUpdate });
  }

  // Тестовый хук: стереть историю платного доступа, чтобы микросайт снова замораживался.
  if (process.env.E2E_TESTING === "true" && resetPaidHistory) {
    await prisma.user.update({ where: { id }, data: { firstPaidAccessAt: null } });
  }

  if (subscriptionPlan) {
    if (subscriptionPlan === "PRO" || subscriptionPlan === "NETWORK") {
      await markFirstPaidAccess(id);
    }
    const existing = await prisma.subscription.findFirst({ where: { userId: id } });
    if (existing) {
      await prisma.subscription.updateMany({
        where: { userId: id },
        data: {
          plan: subscriptionPlan,
          status: subscriptionStatus || existing.status,
        },
      });
    } else {
      await prisma.subscription.create({
        data: {
          user: { connect: { id: id } },
          plan: subscriptionPlan,
          status: subscriptionStatus || "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  if (process.env.E2E_TESTING === "true" && typeof scansCount === "number" && scansCount >= 0) {
    await prisma.qRCode.updateMany({
      where: { userId: id },
      data: { scansCount: Math.floor(scansCount) },
    });
  }

  if (process.env.E2E_TESTING === "true" && introOfferExpiresAt) {
    const parsed = new Date(introOfferExpiresAt);
    if (!Number.isNaN(parsed.getTime())) {
      await prisma.subscriptionIntroOffer.updateMany({
        where: { userId: id, campaignKey: PRO_INTRO_OFFER.campaignKey },
        data: { expiresAt: parsed },
      });
    }
  }

  if (process.env.E2E_TESTING === "true" && backdateProOfferSendsTo) {
    const parsed = new Date(backdateProOfferSendsTo);
    if (!Number.isNaN(parsed.getTime())) {
      await prisma.userLifecycleEmail.updateMany({
        where: {
          campaignKey: {
            in: [PRO_INTRO_OFFER.campaignKey, PRO_INTRO_OFFER.reminderCampaignKey],
          },
        },
        data: { sentAt: parsed },
      });
    }
  }

  if (process.env.E2E_TESTING === "true" && proOfferCampaignStartedAt) {
    const parsed = new Date(proOfferCampaignStartedAt);
    if (!Number.isNaN(parsed.getTime())) {
      await prisma.platformMeta.upsert({
        where: { key: PRO_OFFER_CAMPAIGN_STARTED_AT_KEY },
        update: { value: parsed.toISOString() },
        create: { key: PRO_OFFER_CAMPAIGN_STARTED_AT_KEY, value: parsed.toISOString() },
      });
    }
  }

  const updated = await prisma.user.findUnique({
    where: { id },
    include: { subscriptions: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  return NextResponse.json({ user: updated });
}
