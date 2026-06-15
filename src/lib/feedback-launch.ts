import prisma from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { loadLifecycleUserState } from "@/lib/lifecycle-email-state";
import { isUserEligibleForLifecycle } from "@/lib/lifecycle-email-campaigns";
import {
  getLifecycleLegacyCutoff,
  LIFECYCLE_FEEDBACK_SUPPRESS_KEYS,
  markCampaignsSent,
} from "@/lib/lifecycle-legacy";
import { renderFeedbackLaunchEmail, LIFECYCLE_EMAIL_SUBJECTS } from "@/lib/lifecycle-email-templates";

export const FEEDBACK_LAUNCH_CAMPAIGN_KEY = "feedback_launch";

export interface FeedbackLaunchResult {
  ok: boolean;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  error?: string;
}

export async function runFeedbackLaunch(): Promise<FeedbackLaunchResult> {
  const cutoff = await getLifecycleLegacyCutoff();
  if (!cutoff) {
    return {
      ok: false,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
      error: "lifecycle_legacy_cutoff not configured",
    };
  }

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  const users = await prisma.user.findMany({
    where: {
      role: { not: "ADMIN" },
      marketingEmailsEnabled: true,
      createdAt: { lt: cutoff },
      lifecycleEmails: { none: { campaignKey: FEEDBACK_LAUNCH_CAMPAIGN_KEY } },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  for (const { id: userId } of users) {
    const state = await loadLifecycleUserState(userId);
    if (!state || !isUserEligibleForLifecycle(state)) {
      skippedCount++;
      continue;
    }

    const html = renderFeedbackLaunchEmail(state);
    const subject = LIFECYCLE_EMAIL_SUBJECTS[FEEDBACK_LAUNCH_CAMPAIGN_KEY];
    const ok = await sendMail(state.email, subject, html);

    if (!ok) {
      console.error(`[feedback-launch] userId=${userId} fail=smtp`);
      failedCount++;
      continue;
    }

    await markCampaignsSent(userId, [
      FEEDBACK_LAUNCH_CAMPAIGN_KEY,
      ...LIFECYCLE_FEEDBACK_SUPPRESS_KEYS,
    ]);
    console.log(`[feedback-launch] userId=${userId} ok`);
    sentCount++;
  }

  return { ok: true, sentCount, skippedCount, failedCount };
}
