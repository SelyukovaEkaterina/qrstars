export type SetupUtmHint = "reviews" | "menu" | "generator" | null;

const REVIEWS_CAMPAIGNS = new Set([
  "reviews_search",
  "reviews_landing",
  "horeca",
  "yandex",
  "2gis",
]);

const MENU_CAMPAIGNS = new Set(["menu_search"]);

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
    campaign.includes("menu") ||
    MENU_CAMPAIGNS.has(campaign) ||
    MENU_CAMPAIGNS.has(content)
  ) {
    return { hint: "menu", hideRedirect: campaign.includes("menu") };
  }

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

export type SetupIntentId = "reviews" | "landing" | "redirect" | "menu";

export function parseSetupIntentParam(raw: string | null | undefined): SetupIntentId | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "reviews" || value === "landing" || value === "redirect" || value === "menu") {
    return value;
  }
  return null;
}

/**
 * Auto-select only from explicit `intent` query (landing CTA).
 * UTM still ranks cards via parseSetupUtmContext, but does not skip the picker.
 */
export function resolveAutoSelectedIntent(
  utmCampaign: string | null,
  utmContent: string | null,
  intentParam?: string | null
): SetupIntentId | null {
  void utmCampaign;
  void utmContent;
  return parseSetupIntentParam(intentParam);
}

export function orderSetupIntents(
  intents: SetupIntentId[],
  hint: SetupUtmHint
): SetupIntentId[] {
  const preferred: SetupIntentId[] =
    hint === "menu"
      ? ["menu", "reviews", "landing", "redirect"]
      : hint === "reviews"
        ? ["reviews", "landing", "menu", "redirect"]
        : hint === "generator"
          ? ["redirect", "landing", "reviews", "menu"]
          : intents;
  return preferred.filter((id) => intents.includes(id));
}
