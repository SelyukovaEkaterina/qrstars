import prisma from "@/lib/prisma";

export const LIFECYCLE_LEGACY_CUTOFF_KEY = "lifecycle_legacy_cutoff";

/** Кампании, помеченные «отправлено» для legacy-юзеров при выливке (без feedback). */
export const LIFECYCLE_BACKFILL_CAMPAIGN_KEYS = [
  "welcome",
  "no_establishment_d1",
  "no_establishment_d3",
  "no_qr_d1",
  "no_qr_d4",
  "no_scans_d2",
  "no_scans_d5",
  "no_reviews_d3",
  "connect_telegram_d2",
  "pro_hint_d14",
] as const;

/** После launch-feedback помечаем, чтобы cron не догонял d7/d90/d365. */
export const LIFECYCLE_FEEDBACK_SUPPRESS_KEYS = [
  "feedback_d7",
  "feedback_d90",
  "feedback_d365",
] as const;

export async function getLifecycleLegacyCutoff(): Promise<Date | null> {
  const row = await prisma.platformMeta.findUnique({
    where: { key: LIFECYCLE_LEGACY_CUTOFF_KEY },
  });
  if (!row) return null;
  const d = new Date(row.value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function markCampaignsSent(userId: string, campaignKeys: string[]): Promise<void> {
  if (campaignKeys.length === 0) return;
  await prisma.userLifecycleEmail.createMany({
    data: campaignKeys.map((campaignKey) => ({ userId, campaignKey })),
    skipDuplicates: true,
  });
}
