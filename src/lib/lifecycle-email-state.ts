import prisma from "@/lib/prisma";
import {
  establishmentAccessWhere,
  establishmentRelationWhere,
  qrcodeAccessWhere,
} from "@/lib/establishment-access";
import type { FeedbackSurveyKind } from "@/lib/feedback-surveys";
import { effectivePlan } from "@/lib/subscription-utils";
import type { PlanId } from "@/lib/plans";

export interface LifecycleUserState {
  userId: string;
  email: string;
  name: string | null;
  role: string;
  marketingEmailsEnabled: boolean;
  registrationSource: string | null;
  createdAt: Date;
  firstScanAt: Date | null;
  needsSetup: boolean;
  accessibleEstablishmentCount: number;
  ownedQrCount: number;
  totalScans: number;
  reviewCount: number;
  reviewsLast90Days: number;
  scansLast90Days: number;
  submittedFeedbackKinds: Set<FeedbackSurveyKind>;
  hasTelegram: boolean;
  sentCampaignKeys: Set<string>;
  plan: PlanId;
  firstOwnedEstablishmentAt: Date | null;
  firstOwnedQrAt: Date | null;
}

function daysAgoDate(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function loadLifecycleUserState(userId: string): Promise<LifecycleUserState | null> {
  const since90 = daysAgoDate(90);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      marketingEmailsEnabled: true,
      registrationSource: true,
      createdAt: true,
      firstScanAt: true,
      feedbacks: { select: { surveyKind: true } },
      lifecycleEmails: { select: { campaignKey: true } },
      messengerContacts: {
        where: { provider: "TELEGRAM" },
        select: { id: true },
        take: 1,
      },
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { plan: true, status: true },
      },
    },
  });
  if (!user) return null;

  const [
    accessibleEstablishmentCount,
    ownedQrCount,
    scanAgg,
    reviewCount,
    reviewsLast90Days,
    scansLast90Days,
    firstOwnedEstablishment,
    firstOwnedQr,
  ] = await Promise.all([
    prisma.establishment.count({ where: establishmentAccessWhere(userId) }),
    prisma.qRCode.count({ where: { userId } }),
    prisma.qRCode.aggregate({
      where: qrcodeAccessWhere(userId),
      _sum: { scansCount: true },
    }),
    prisma.review.count({ where: establishmentRelationWhere(userId) }),
    prisma.review.count({
      where: {
        ...establishmentRelationWhere(userId),
        createdAt: { gte: since90 },
      },
    }),
    prisma.qRScan.count({
      where: {
        qrCode: qrcodeAccessWhere(userId),
        createdAt: { gte: since90 },
      },
    }),
    prisma.establishment.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.qRCode.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  const needsSetup = accessibleEstablishmentCount === 0 && ownedQrCount === 0;
  const submittedFeedbackKinds = new Set(
    user.feedbacks.map((f) => f.surveyKind as FeedbackSurveyKind)
  );

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    marketingEmailsEnabled: user.marketingEmailsEnabled,
    registrationSource: user.registrationSource,
    createdAt: user.createdAt,
    firstScanAt: user.firstScanAt,
    needsSetup,
    accessibleEstablishmentCount,
    ownedQrCount,
    totalScans: scanAgg._sum.scansCount ?? 0,
    reviewCount,
    reviewsLast90Days,
    scansLast90Days,
    submittedFeedbackKinds,
    hasTelegram: user.messengerContacts.length > 0,
    sentCampaignKeys: new Set(user.lifecycleEmails.map((e) => e.campaignKey)),
    plan: effectivePlan(user.subscriptions[0] ?? null),
    firstOwnedEstablishmentAt: firstOwnedEstablishment?.createdAt ?? null,
    firstOwnedQrAt: firstOwnedQr?.createdAt ?? null,
  };
}

export async function loadLifecycleUserStates(userIds: string[]): Promise<Map<string, LifecycleUserState>> {
  const map = new Map<string, LifecycleUserState>();
  const states = await Promise.all(userIds.map((id) => loadLifecycleUserState(id)));
  for (const state of states) {
    if (state) map.set(state.userId, state);
  }
  return map;
}

/** Активность за последние 90 дней (для d90/d365). */
export function isActiveUser90d(state: LifecycleUserState): boolean {
  if (state.reviewsLast90Days >= 1) return true;
  if (state.scansLast90Days >= 5) return true;
  // FREE без детального лога сканов: lifetime-активность как прокси
  if (state.totalScans >= 5 || state.reviewCount >= 1) return true;
  return false;
}

/** Недавняя активность для годового опроса. */
export function isRecentlyActive(state: LifecycleUserState): boolean {
  if (state.reviewsLast90Days >= 1) return true;
  if (state.scansLast90Days >= 1) return true;
  if (state.totalScans >= 3) return true;
  return false;
}
