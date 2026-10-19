import prisma from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import {
  getEligibleCampaigns,
  getCampaignByKey,
  isProIntroOfferCampaign,
  isUserEligibleForLifecycle,
  proIntroOfferDailyCapReached,
  type LifecycleCampaignKey,
} from "@/lib/lifecycle-email-campaigns";
import { startOfMskDay } from "@/lib/lifecycle-email-msk";
import { loadLifecycleUserState } from "@/lib/lifecycle-email-state";
import {
  LIFECYCLE_EMAIL_SUBJECTS,
  LIFECYCLE_TEMPLATE_RENDERERS,
} from "@/lib/lifecycle-email-templates";
import { PRO_INTRO_OFFER } from "@/lib/plans";
import { issueProIntroOffer } from "@/lib/subscription-intro-offer";
import type { LifecycleUserState } from "@/lib/lifecycle-email-state";

export interface LifecycleEmailSendResult {
  userId: string;
  campaignKey: string;
  email: string;
  status: "sent" | "skipped" | "failed";
  reason?: string;
}

export interface LifecycleEmailBatchResult {
  ok: boolean;
  sent: LifecycleEmailSendResult[];
  skipped: LifecycleEmailSendResult[];
  failed: LifecycleEmailSendResult[];
  error?: string;
}

const BATCH_SIZE = 200;

async function countProIntroOffersSentToday(now = new Date()): Promise<number> {
  return prisma.userLifecycleEmail.count({
    where: {
      campaignKey: {
        in: [PRO_INTRO_OFFER.campaignKey, PRO_INTRO_OFFER.reminderCampaignKey],
      },
      sentAt: { gte: startOfMskDay(now) },
    },
  });
}

async function recordSent(userId: string, campaignKey: string): Promise<void> {
  await prisma.userLifecycleEmail.create({
    data: { userId, campaignKey },
  });
}

export async function sendLifecycleEmail(
  userId: string,
  campaignKey: LifecycleCampaignKey
): Promise<LifecycleEmailSendResult> {
  const state = await loadLifecycleUserState(userId);
  if (!state) {
    return { userId, campaignKey, email: "", status: "failed", reason: "user_not_found" };
  }

  if (!isUserEligibleForLifecycle(state)) {
    return {
      userId,
      campaignKey,
      email: state.email,
      status: "skipped",
      reason: "not_eligible",
    };
  }

  if (state.sentCampaignKeys.has(campaignKey)) {
    return {
      userId,
      campaignKey,
      email: state.email,
      status: "skipped",
      reason: "already_sent",
    };
  }

  const campaign = getCampaignByKey(campaignKey);
  if (!campaign) {
    return {
      userId,
      campaignKey,
      email: state.email,
      status: "failed",
      reason: "unknown_campaign",
    };
  }

  if (!campaign.isEligible(state)) {
    return {
      userId,
      campaignKey,
      email: state.email,
      status: "skipped",
      reason: "conditions_not_met",
    };
  }

  if (isProIntroOfferCampaign(campaignKey)) {
    const sentToday = await countProIntroOffersSentToday();
    if (proIntroOfferDailyCapReached(sentToday)) {
      return {
        userId,
        campaignKey,
        email: state.email,
        status: "skipped",
        reason: "daily_cap",
      };
    }
  }

  let renderState: LifecycleUserState = state;
  if (campaignKey === PRO_INTRO_OFFER.campaignKey) {
    const offer = await issueProIntroOffer(userId);
    if (offer.usedAt) {
      return {
        userId,
        campaignKey,
        email: state.email,
        status: "skipped",
        reason: "offer_used",
      };
    }
    renderState = {
      ...state,
      proIntroOffer: {
        code: offer.code,
        amountRub: offer.amountRub,
        listAmountRub: offer.listAmountRub,
        expiresAt: offer.expiresAt,
        usedAt: offer.usedAt,
      },
    };
  }

  if (campaignKey === PRO_INTRO_OFFER.reminderCampaignKey && !renderState.proIntroOffer) {
    return {
      userId,
      campaignKey,
      email: state.email,
      status: "skipped",
      reason: "offer_missing",
    };
  }

  const render = LIFECYCLE_TEMPLATE_RENDERERS[campaignKey];
  const subjectTemplate = LIFECYCLE_EMAIL_SUBJECTS[campaignKey];
  const subject =
    typeof subjectTemplate === "function" ? subjectTemplate(renderState) : subjectTemplate;
  if (!render || !subject) {
    return {
      userId,
      campaignKey,
      email: state.email,
      status: "failed",
      reason: "missing_template",
    };
  }

  const html = render(renderState);
  const ok = await sendMail(state.email, subject, html, {
    kind: campaignKey === "welcome" ? "welcome" : "lifecycle",
  });
  if (!ok) {
    console.error(`[lifecycle-email] campaign=${campaignKey} userId=${userId} fail=smtp`);
    return {
      userId,
      campaignKey,
      email: state.email,
      status: "failed",
      reason: "smtp_error",
    };
  }

  await recordSent(userId, campaignKey);
  console.log(`[lifecycle-email] campaign=${campaignKey} userId=${userId} ok`);
  return { userId, campaignKey, email: state.email, status: "sent" };
}

export async function runLifecycleEmailBatch(): Promise<LifecycleEmailBatchResult> {
  const sent: LifecycleEmailSendResult[] = [];
  const skipped: LifecycleEmailSendResult[] = [];
  const failed: LifecycleEmailSendResult[] = [];

  try {
    let cursor: string | undefined;
    const promoQueue: { userId: string; key: LifecycleCampaignKey }[] = [];
    for (;;) {
      const users = await prisma.user.findMany({
        where: {
          role: { not: "ADMIN" },
          marketingEmailsEnabled: true,
        },
        select: { id: true },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
      });

      if (users.length === 0) break;

      for (const { id: userId } of users) {
        const state = await loadLifecycleUserState(userId);
        if (!state) continue;

        const campaigns = getEligibleCampaigns(state, { cronOnly: true });
        for (const campaign of campaigns) {
          if (isProIntroOfferCampaign(campaign.key)) {
            promoQueue.push({ userId, key: campaign.key });
            continue;
          }
          const result = await sendLifecycleEmail(userId, campaign.key);
          if (result.status === "sent") sent.push(result);
          else if (result.status === "skipped") skipped.push(result);
          else failed.push(result);
        }
      }

      cursor = users[users.length - 1]?.id;
      if (users.length < BATCH_SIZE) break;
    }

    // Напоминание раньше нового оффера: у кода осталось меньше двух суток.
    promoQueue.sort((a, b) => {
      const rank = (key: string) => (key === PRO_INTRO_OFFER.reminderCampaignKey ? 0 : 1);
      return rank(a.key) - rank(b.key);
    });

    let capFull = false;
    for (const item of promoQueue) {
      if (capFull) {
        skipped.push({
          userId: item.userId,
          campaignKey: item.key,
          email: "",
          status: "skipped",
          reason: "daily_cap",
        });
        continue;
      }
      const result = await sendLifecycleEmail(item.userId, item.key);
      if (result.reason === "daily_cap") capFull = true;
      if (result.status === "sent") sent.push(result);
      else if (result.status === "skipped") skipped.push(result);
      else failed.push(result);
    }

    return { ok: true, sent, skipped, failed };
  } catch (err) {
    console.error("[lifecycle-email] batch error:", err);
    return {
      ok: false,
      sent,
      skipped,
      failed,
      error: err instanceof Error ? err.message : "batch_failed",
    };
  }
}
