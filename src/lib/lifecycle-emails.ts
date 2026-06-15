import prisma from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import {
  getEligibleCampaigns,
  getCampaignByKey,
  isUserEligibleForLifecycle,
  type LifecycleCampaignKey,
} from "@/lib/lifecycle-email-campaigns";
import { loadLifecycleUserState } from "@/lib/lifecycle-email-state";
import {
  LIFECYCLE_EMAIL_SUBJECTS,
  LIFECYCLE_TEMPLATE_RENDERERS,
} from "@/lib/lifecycle-email-templates";

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

  const render = LIFECYCLE_TEMPLATE_RENDERERS[campaignKey];
  const subject = LIFECYCLE_EMAIL_SUBJECTS[campaignKey];
  if (!render || !subject) {
    return {
      userId,
      campaignKey,
      email: state.email,
      status: "failed",
      reason: "missing_template",
    };
  }

  const html = render(state);
  const ok = await sendMail(state.email, subject, html);
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
          const result = await sendLifecycleEmail(userId, campaign.key);
          if (result.status === "sent") sent.push(result);
          else if (result.status === "skipped") skipped.push(result);
          else failed.push(result);
        }
      }

      cursor = users[users.length - 1]?.id;
      if (users.length < BATCH_SIZE) break;
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
