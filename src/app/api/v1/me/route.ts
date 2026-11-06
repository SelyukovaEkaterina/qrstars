import prisma from "@/lib/prisma";
import { API_RATE_LIMIT_PER_MIN, apiJson, apiOptions, withApiAuth } from "@/lib/public-api/auth";
import { buildSubscriptionContext, findActiveSubscription } from "@/lib/subscription-utils";

export const OPTIONS = apiOptions;

export const GET = withApiAuth(async (_request, { userId }) => {
  const [user, subscription, ownedProjects] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } }),
    findActiveSubscription(userId),
    prisma.establishment.count({ where: { userId } }),
  ]);
  const ctx = buildSubscriptionContext(subscription, ownedProjects);

  return apiJson({
    user: { id: user?.id ?? userId, email: user?.email ?? null, name: user?.name ?? null },
    plan: {
      id: ctx.plan,
      label: ctx.planLabel,
      paidFeatures: ctx.hasPaidFeatures,
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
    },
    limits: {
      projects: ctx.establishmentLimit,
      projectsUsed: ownedProjects,
      qrCodesPerProject: null,
      requestsPerMinute: API_RATE_LIMIT_PER_MIN,
    },
  });
});
