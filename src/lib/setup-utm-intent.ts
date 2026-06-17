export type SetupUtmHint = "reviews" | "generator" | null;

const REVIEWS_CAMPAIGNS = new Set([
  "reviews_search",
  "reviews_landing",
  "horeca",
  "yandex",
  "2gis",
]);

export interface SetupUtmContext {
  hint: SetupUtmHint;
  hideRedirect: boolean;
}

export function parseSetupUtmContext(
  utmCampaign: string | null,
  utmContent: string | null
): SetupUtmContext {
  const campaign = (utmCampaign ?? "").trim().toLowerCase();
  const content = (utmContent ?? "").trim().toLowerCase();

  if (
    campaign.includes("reviews") ||
    REVIEWS_CAMPAIGNS.has(campaign) ||
    REVIEWS_CAMPAIGNS.has(content)
  ) {
    return { hint: "reviews", hideRedirect: campaign.includes("reviews") };
  }

  if (campaign === "generator_search" || campaign.includes("generator")) {
    return { hint: "generator", hideRedirect: false };
  }

  return { hint: null, hideRedirect: false };
}

export type SetupIntentId = "reviews" | "landing" | "redirect";

export function orderSetupIntents(
  intents: SetupIntentId[],
  hint: SetupUtmHint
): SetupIntentId[] {
  const preferred: SetupIntentId[] =
    hint === "reviews"
      ? ["reviews", "landing", "redirect"]
      : hint === "generator"
        ? ["landing", "reviews", "redirect"]
        : intents;
  return preferred.filter((id) => intents.includes(id));
}
