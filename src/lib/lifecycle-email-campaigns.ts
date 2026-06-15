import { calendarDaysSinceMsk } from "@/lib/lifecycle-email-msk";
import type { LifecycleUserState } from "@/lib/lifecycle-email-state";
import { isActiveUser90d, isRecentlyActive } from "@/lib/lifecycle-email-state";

export type LifecycleCampaignKey =
  | "welcome"
  | "no_establishment_d1"
  | "no_establishment_d3"
  | "no_qr_d1"
  | "no_qr_d4"
  | "no_scans_d2"
  | "no_scans_d5"
  | "no_reviews_d3"
  | "connect_telegram_d2"
  | "feedback_d7"
  | "feedback_d90"
  | "feedback_d365"
  | "pro_hint_d14";

export interface LifecycleCampaign {
  key: LifecycleCampaignKey;
  /** Если true — не включать в ежедневный cron (отправляется вручную при событии). */
  immediateOnly?: boolean;
  isEligible: (state: LifecycleUserState, now?: Date) => boolean;
}

function daysSinceRegistration(state: LifecycleUserState, now?: Date): number {
  return calendarDaysSinceMsk(state.createdAt, now);
}

export const LIFECYCLE_CAMPAIGNS: LifecycleCampaign[] = [
  {
    key: "welcome",
    immediateOnly: true,
    isEligible: () => true,
  },
  {
    key: "no_establishment_d1",
    isEligible: (state, now) => state.needsSetup && daysSinceRegistration(state, now) >= 1,
  },
  {
    key: "no_establishment_d3",
    isEligible: (state, now) => state.needsSetup && daysSinceRegistration(state, now) >= 3,
  },
  {
    key: "no_qr_d1",
    isEligible: (state, now) => {
      if (state.ownedQrCount > 0) return false;
      if (state.accessibleEstablishmentCount === 0) return false;
      if (!state.firstOwnedEstablishmentAt) return false;
      return calendarDaysSinceMsk(state.firstOwnedEstablishmentAt, now) >= 1;
    },
  },
  {
    key: "no_qr_d4",
    isEligible: (state, now) => {
      if (state.ownedQrCount > 0) return false;
      if (state.accessibleEstablishmentCount === 0) return false;
      if (!state.firstOwnedEstablishmentAt) return false;
      return calendarDaysSinceMsk(state.firstOwnedEstablishmentAt, now) >= 4;
    },
  },
  {
    key: "no_scans_d2",
    isEligible: (state, now) => {
      if (state.totalScans > 0) return false;
      if (state.ownedQrCount === 0) return false;
      if (!state.firstOwnedQrAt) return false;
      return calendarDaysSinceMsk(state.firstOwnedQrAt, now) >= 2;
    },
  },
  {
    key: "no_scans_d5",
    isEligible: (state, now) => {
      if (state.totalScans > 0) return false;
      if (state.ownedQrCount === 0) return false;
      if (!state.firstOwnedQrAt) return false;
      return calendarDaysSinceMsk(state.firstOwnedQrAt, now) >= 5;
    },
  },
  {
    key: "no_reviews_d3",
    isEligible: (state, now) => {
      if (state.totalScans === 0) return false;
      if (state.reviewCount > 0) return false;
      if (!state.firstScanAt) return false;
      return calendarDaysSinceMsk(state.firstScanAt, now) >= 3;
    },
  },
  {
    key: "connect_telegram_d2",
    isEligible: (state, now) => {
      if (state.hasTelegram) return false;
      if (state.totalScans === 0) return false;
      if (!state.firstScanAt) return false;
      return calendarDaysSinceMsk(state.firstScanAt, now) >= 2;
    },
  },
  {
    key: "feedback_d7",
    isEligible: (state, now) => {
      if (state.submittedFeedbackKinds.has("d7")) return false;
      return daysSinceRegistration(state, now) >= 7;
    },
  },
  {
    key: "feedback_d90",
    isEligible: (state, now) => {
      if (state.submittedFeedbackKinds.has("d90")) return false;
      if (daysSinceRegistration(state, now) < 90) return false;
      return isActiveUser90d(state);
    },
  },
  {
    key: "feedback_d365",
    isEligible: (state, now) => {
      if (state.submittedFeedbackKinds.has("d365")) return false;
      if (daysSinceRegistration(state, now) < 365) return false;
      return isRecentlyActive(state);
    },
  },
  {
    key: "pro_hint_d14",
    isEligible: (state, now) => {
      if (state.plan !== "FREE") return false;
      if (state.totalScans < 3) return false;
      if (state.reviewCount < 1) return false;
      return daysSinceRegistration(state, now) >= 14;
    },
  },
];

export const CRON_CAMPAIGN_KEYS = LIFECYCLE_CAMPAIGNS.filter((c) => !c.immediateOnly).map(
  (c) => c.key
);

export function getCampaignByKey(key: string): LifecycleCampaign | undefined {
  return LIFECYCLE_CAMPAIGNS.find((c) => c.key === key);
}

export function isUserEligibleForLifecycle(state: LifecycleUserState): boolean {
  if (state.role === "ADMIN") return false;
  if (!state.marketingEmailsEnabled) return false;
  return true;
}

export function getEligibleCampaigns(
  state: LifecycleUserState,
  options?: { cronOnly?: boolean; now?: Date }
): LifecycleCampaign[] {
  if (!isUserEligibleForLifecycle(state)) return [];
  return LIFECYCLE_CAMPAIGNS.filter((campaign) => {
    if (options?.cronOnly && campaign.immediateOnly) return false;
    if (state.sentCampaignKeys.has(campaign.key)) return false;
    return campaign.isEligible(state, options?.now);
  });
}
