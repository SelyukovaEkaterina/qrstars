import prisma from "@/lib/prisma";
import {
  calcSubscriptionAmount,
  formatPlanLabel,
  type BillingPeriod,
  type PlanId,
} from "@/lib/plans";
import { countUserEstablishments } from "@/lib/subscription-utils";

const MS_DAY = 24 * 60 * 60 * 1000;
export const PRICE_CHANGE_NOTICE_DAYS = 7;

export async function getLastPaidSubscriptionAmount(
  userId: string
): Promise<number | null> {
  const order = await prisma.paymentOrder.findFirst({
    where: { userId, status: "PAID" },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
  });
  return order != null ? Number(order.amount) : null;
}

export type RenewalPriceChangeNotice = {
  previousAmount: number;
  newAmount: number;
  chargeDate: string;
  planLabel: string;
  daysUntilCharge: number;
};

type SubscriptionForNotice = {
  userId: string;
  plan: string;
  billing: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  status: string;
  parentInvoiceId: number | null;
};

export async function calcUpcomingRenewalAmount(
  sub: SubscriptionForNotice
): Promise<number | null> {
  if (!sub.billing) return null;
  const plan = sub.plan as PlanId;
  if (plan !== "PRO" && plan !== "NETWORK") return null;
  const estCount = await countUserEstablishments(sub.userId);
  return calcSubscriptionAmount(plan, sub.billing as BillingPeriod, estCount);
}

export async function buildRenewalPriceChangeNotice(
  sub: SubscriptionForNotice
): Promise<RenewalPriceChangeNotice | null> {
  if (
    sub.status !== "ACTIVE" ||
    sub.cancelAtPeriodEnd ||
    !sub.parentInvoiceId ||
    !sub.currentPeriodEnd
  ) {
    return null;
  }

  const plan = sub.plan as PlanId;
  if (plan !== "PRO" && plan !== "NETWORK") return null;

  const now = Date.now();
  const endMs = sub.currentPeriodEnd.getTime();
  const daysUntil = Math.ceil((endMs - now) / MS_DAY);
  if (daysUntil < 0 || daysUntil > PRICE_CHANGE_NOTICE_DAYS) return null;

  const newAmount = await calcUpcomingRenewalAmount(sub);
  if (newAmount == null) return null;

  const previousAmount = await getLastPaidSubscriptionAmount(sub.userId);
  if (previousAmount == null || Math.abs(newAmount - previousAmount) < 0.01) {
    return null;
  }

  return {
    previousAmount,
    newAmount,
    chargeDate: sub.currentPeriodEnd.toISOString(),
    planLabel: formatPlanLabel(plan),
    daysUntilCharge: daysUntil,
  };
}

export function priceChangeNoticeWindow(now: Date): { start: Date; end: Date } {
  return {
    start: new Date(
      now.getTime() + (PRICE_CHANGE_NOTICE_DAYS - 1) * MS_DAY
    ),
    end: new Date(now.getTime() + (PRICE_CHANGE_NOTICE_DAYS + 1) * MS_DAY),
  };
}
