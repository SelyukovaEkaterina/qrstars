import prisma from "@/lib/prisma";
import {
  canAddEstablishment,
  formatPlanLabel,
  getEstablishmentLimit,
  getUpgradeHint,
  hasPaidFeatures,
  PLANS,
  type PlanId,
} from "@/lib/plans";

export { hasPaidFeatures, canAddEstablishment, getEstablishmentLimit, getUpgradeHint, formatPlanLabel };

export async function findActiveSubscription(userId: string) {
  const subs = await prisma.subscription.findMany({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  return subs.find((s) => hasPaidFeatures(s.plan)) ?? subs[0] ?? null;
}

export async function findLatestSubscription(userId: string) {
  return prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function userHasPaidFeatures(userId: string): Promise<boolean> {
  const sub = await findActiveSubscription(userId);
  return hasPaidFeatures(sub?.plan);
}

export async function countUserEstablishments(userId: string): Promise<number> {
  return prisma.establishment.count({ where: { userId } });
}

export function effectivePlan(
  subscription: { plan: string; status: string } | null | undefined
): PlanId {
  if (subscription?.status === "ACTIVE" && subscription.plan !== "FREE") {
    return subscription.plan as PlanId;
  }
  return "FREE";
}

export function buildSubscriptionContext(
  subscription: { plan: string; status: string } | null | undefined,
  establishmentCount: number
) {
  const plan = effectivePlan(subscription);
  const paid = hasPaidFeatures(plan);
  const limit = getEstablishmentLimit(plan);
  return {
    plan,
    planLabel: formatPlanLabel(plan),
    hasPaidFeatures: paid,
    isPro: paid,
    establishmentCount,
    establishmentLimit: limit,
    canAddEstablishment: canAddEstablishment(plan, establishmentCount),
    upgradeHint: getUpgradeHint(plan, establishmentCount),
    plans: PLANS,
  };
}
