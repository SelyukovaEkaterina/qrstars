export type ReviewStarAction = "COMPLAINT" | "YANDEX" | "TWO_GIS" | "AVITO" | "CUSTOM" | "THANKS";

export type ReviewPlatformAction = "YANDEX" | "TWO_GIS" | "AVITO" | "CUSTOM";

export type StarRating = 1 | 2 | 3 | 4 | 5;

export const DEFAULT_STAR_EMOJIS: Record<StarRating, string> = {
  1: "😡",
  2: "😕",
  3: "😐",
  4: "😊",
  5: "🤩",
};

export interface CustomPlatformEntry {
  id: string;
  name: string;
  url: string;
  iconUrl?: string;
}

export interface StandardPlatformEntry {
  type: "YANDEX" | "TWO_GIS" | "AVITO";
}

export interface CustomPlatformListEntry {
  type: "CUSTOM";
  id: string;
  name: string;
  url: string;
  iconUrl?: string;
}

export type OrderedPlatformEntry = StandardPlatformEntry | CustomPlatformListEntry;

export interface ReviewStarStep {
  action: ReviewStarAction;
  /** @deprecated use platformList */
  platforms?: ReviewPlatformAction[];
  /** @deprecated use platformList */
  customPlatformUrl?: string | null;
  /** @deprecated use platformList */
  customPlatformIconUrl?: string | null;
  /** Ordered list of platforms for this star rating */
  platformList?: OrderedPlatformEntry[];
  emoji: string;
  promptTitle: string;
  promptSubtitle: string;
  thanksTitle: string;
  thanksSubtitle: string;
  ctaLabel: string;
}

export interface ResolvedPlatform {
  action: ReviewPlatformAction;
  /** Stable discriminator: action value for standard platforms, custom entry id for customs */
  id: string;
  url: string | null;
  label: string;
  iconUrl?: string | null;
}

export const PLATFORM_ACTIONS: { value: ReviewPlatformAction; label: string }[] = [
  { value: "YANDEX", label: "Яндекс.Карты" },
  { value: "TWO_GIS", label: "2GIS" },
  { value: "AVITO", label: "Авито" },
  { value: "CUSTOM", label: "Своя площадка" },
];

export const STANDARD_PLATFORM_LABELS: Record<"YANDEX" | "TWO_GIS" | "AVITO", string> = {
  YANDEX: "Яндекс.Карты",
  TWO_GIS: "2GIS",
  AVITO: "Авито",
};

export const PLATFORM_CTA_LABELS: Record<ReviewPlatformAction, string> = {
  YANDEX: "Оставить отзыв на Яндекс.Картах",
  TWO_GIS: "Оставить отзыв в 2GIS",
  AVITO: "Оставить отзыв на Авито",
  CUSTOM: "Оставить отзыв",
};

export type ReviewRoutingConfig = Record<StarRating, ReviewStarStep>;

export interface PlatformUrls {
  yandexMapsUrl: string | null;
  twoGisUrl: string | null;
  avitoUrl: string | null;
}

export const REVIEW_STAR_ACTIONS: { value: ReviewStarAction; label: string }[] = [
  { value: "COMPLAINT", label: "Связаться с владельцем (жалоба)" },
  { value: "YANDEX", label: "Отзыв на Яндекс.Картах" },
  { value: "TWO_GIS", label: "Отзыв в 2GIS" },
  { value: "AVITO", label: "Отзыв на Авито" },
  { value: "THANKS", label: "Только благодарность" },
];

const STAR_RATINGS: StarRating[] = [1, 2, 3, 4, 5];

function defaultStep(star: StarRating): ReviewStarStep {
  if (star <= 3) {
    return {
      action: "COMPLAINT",
      emoji: DEFAULT_STAR_EMOJIS[star],
      promptTitle: "Нам очень жаль! Расскажите подробнее",
      promptSubtitle: "Ваше сообщение попадёт лично руководству",
      thanksTitle: "Спасибо за обратную связь!",
      thanksSubtitle: "Мы уже работаем над улучшением. Руководство лично прочитает ваш отзыв.",
      ctaLabel: "Отправить",
    };
  }
  return {
    action: "YANDEX",
    platformList: [{ type: "YANDEX" }],
    emoji: DEFAULT_STAR_EMOJIS[star],
    promptTitle: "Спасибо! Оставьте отзыв на карте?",
    promptSubtitle: "Это поможет нам стать лучше!",
    thanksTitle: "Спасибо за вашу оценку!",
    thanksSubtitle: "Будем рады, если поделитесь впечатлением на карте.",
    ctaLabel: "Оставить отзыв на Яндекс.Картах",
  };
}

export const DEFAULT_REVIEW_ROUTING: ReviewRoutingConfig = {
  1: defaultStep(1),
  2: defaultStep(2),
  3: defaultStep(3),
  4: defaultStep(4),
  5: defaultStep(5),
};

function isStarRating(n: number): n is StarRating {
  return n >= 1 && n <= 5;
}

function isValidAction(v: unknown): v is ReviewStarAction {
  return (
    v === "COMPLAINT" ||
    v === "YANDEX" ||
    v === "TWO_GIS" ||
    v === "AVITO" ||
    v === "CUSTOM" ||
    v === "THANKS"
  );
}

function isValidPlatformAction(v: unknown): v is ReviewPlatformAction {
  return v === "YANDEX" || v === "TWO_GIS" || v === "AVITO" || v === "CUSTOM";
}

function isValidStandardType(v: unknown): v is "YANDEX" | "TWO_GIS" | "AVITO" {
  return v === "YANDEX" || v === "TWO_GIS" || v === "AVITO";
}

function parsePlatformList(raw: unknown): OrderedPlatformEntry[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const result: OrderedPlatformEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (isValidStandardType(o.type)) {
      result.push({ type: o.type });
    } else if (o.type === "CUSTOM" && typeof o.id === "string" && typeof o.name === "string" && typeof o.url === "string") {
      result.push({
        type: "CUSTOM",
        id: o.id,
        name: o.name,
        url: o.url,
        iconUrl: typeof o.iconUrl === "string" ? o.iconUrl : undefined,
      });
    }
  }
  return result.length > 0 ? result : undefined;
}

/** Migrate old platforms[] + customPlatformUrl to platformList */
function migrateLegacyPlatforms(
  platforms: ReviewPlatformAction[],
  customPlatformUrl?: string | null,
  customPlatformIconUrl?: string | null
): OrderedPlatformEntry[] {
  const list: OrderedPlatformEntry[] = [];
  for (const p of platforms) {
    if (p === "CUSTOM") {
      list.push({
        type: "CUSTOM",
        id: "legacy-custom",
        name: "Своя площадка",
        url: customPlatformUrl?.trim() || "",
        iconUrl: customPlatformIconUrl?.trim() || undefined,
      });
    } else {
      list.push({ type: p });
    }
  }
  return list;
}

function parsePlatforms(raw: unknown): ReviewPlatformAction[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const filtered = raw.filter(isValidPlatformAction);
  return filtered.length > 0 ? filtered : undefined;
}

function parseStep(raw: unknown, star: StarRating): ReviewStarStep {
  const defaults = defaultStep(star);
  if (!raw || typeof raw !== "object") return defaults;
  const o = raw as Record<string, unknown>;

  const emoji = typeof o.emoji === "string" && o.emoji.trim() ? o.emoji.trim() : defaults.emoji;
  const customPlatformUrl =
    typeof o.customPlatformUrl === "string" && o.customPlatformUrl.trim()
      ? o.customPlatformUrl.trim()
      : undefined;
  const customPlatformIconUrl =
    typeof o.customPlatformIconUrl === "string" && o.customPlatformIconUrl.trim()
      ? o.customPlatformIconUrl.trim()
      : undefined;

  // Prefer new platformList, fall back to migrating legacy platforms
  let platformList = parsePlatformList(o.platformList);
  if (!platformList) {
    const legacyPlatforms = parsePlatforms(o.platforms);
    if (legacyPlatforms && legacyPlatforms.length > 0) {
      platformList = migrateLegacyPlatforms(legacyPlatforms, customPlatformUrl, customPlatformIconUrl);
    }
  }

  const action = isValidAction(o.action) ? o.action : defaults.action;

  return {
    action,
    platformList: platformList ?? defaults.platformList,
    customPlatformUrl,
    customPlatformIconUrl,
    emoji,
    promptTitle: typeof o.promptTitle === "string" && o.promptTitle.trim() ? o.promptTitle : defaults.promptTitle,
    promptSubtitle:
      typeof o.promptSubtitle === "string" && o.promptSubtitle.trim()
        ? o.promptSubtitle
        : defaults.promptSubtitle,
    thanksTitle: typeof o.thanksTitle === "string" && o.thanksTitle.trim() ? o.thanksTitle : defaults.thanksTitle,
    thanksSubtitle:
      typeof o.thanksSubtitle === "string" && o.thanksSubtitle.trim()
        ? o.thanksSubtitle
        : defaults.thanksSubtitle,
    ctaLabel: typeof o.ctaLabel === "string" && o.ctaLabel.trim() ? o.ctaLabel : defaults.ctaLabel,
  };
}

export function parseReviewRouting(json: unknown): ReviewRoutingConfig {
  if (!json || typeof json !== "object") {
    return { ...DEFAULT_REVIEW_ROUTING };
  }
  const raw = json as Record<string, unknown>;
  const result = { ...DEFAULT_REVIEW_ROUTING };
  for (const star of STAR_RATINGS) {
    const key = String(star);
    if (raw[key] != null) {
      result[star] = parseStep(raw[key], star);
    }
  }
  return result;
}

export function reviewRoutingToJson(config: ReviewRoutingConfig): Record<string, ReviewStarStep> {
  const out: Record<string, ReviewStarStep> = {};
  for (const star of STAR_RATINGS) {
    const step = config[star];
    // Only persist platformList going forward; drop legacy fields
    const { platforms: _p, customPlatformUrl: _cu, customPlatformIconUrl: _ci, ...rest } = step;
    out[String(star)] = rest;
  }
  return out;
}

export function isComplaintAction(action: ReviewStarAction): boolean {
  return action === "COMPLAINT";
}

export function resolveActionUrl(
  action: ReviewStarAction,
  urls: PlatformUrls,
  step?: Pick<ReviewStarStep, "customPlatformUrl">
): string | null {
  switch (action) {
    case "YANDEX":
      return urls.yandexMapsUrl;
    case "TWO_GIS":
      return urls.twoGisUrl;
    case "AVITO":
      return urls.avitoUrl;
    case "CUSTOM":
      return step?.customPlatformUrl ?? null;
    default:
      return null;
  }
}

export function getStarStep(
  config: ReviewRoutingConfig,
  rating: number
): ReviewStarStep {
  if (isStarRating(rating)) {
    return config[rating];
  }
  return config[3];
}

export function isPlatformAction(action: ReviewStarAction): action is ReviewPlatformAction {
  return action === "YANDEX" || action === "TWO_GIS" || action === "AVITO" || action === "CUSTOM";
}

/** Returns legacy-compatible platform action list (for summary labels) */
export function getStepPlatforms(step: ReviewStarStep): ReviewPlatformAction[] {
  if (step.platformList && step.platformList.length > 0) {
    return step.platformList.map((e) => e.type);
  }
  if (step.platforms && step.platforms.length > 0) {
    return step.platforms;
  }
  if (isPlatformAction(step.action)) {
    return [step.action];
  }
  return [];
}

export function resolvePlatformUrls(step: ReviewStarStep, urls: PlatformUrls): ResolvedPlatform[] {
  const list = step.platformList;

  if (list && list.length > 0) {
    return list.map((entry): ResolvedPlatform => {
      if (entry.type === "CUSTOM") {
        return {
          action: "CUSTOM",
          id: entry.id,
          url: entry.url || null,
          label: entry.name || "Своя площадка",
          iconUrl: entry.iconUrl || null,
        };
      }
      return {
        action: entry.type,
        id: entry.type,
        url: resolveActionUrl(entry.type, urls),
        label: STANDARD_PLATFORM_LABELS[entry.type],
        iconUrl: null,
      };
    });
  }

  // Legacy fallback
  const platforms = step.platforms && step.platforms.length > 0
    ? step.platforms
    : isPlatformAction(step.action) ? [step.action] : [];

  return platforms.map((p): ResolvedPlatform => {
    if (p === "CUSTOM") {
      return {
        action: p,
        id: "legacy-custom",
        url: step.customPlatformUrl ?? null,
        label: "Своя площадка",
        iconUrl: step.customPlatformIconUrl ?? null,
      };
    }
    return {
      action: p,
      id: p,
      url: resolveActionUrl(p, urls),
      label: PLATFORM_ACTIONS.find((a) => a.value === p)?.label ?? p,
      iconUrl: null,
    };
  });
}

export function platformButtonLabel(platform: ResolvedPlatform, step: ReviewStarStep): string {
  if (platform.action === "CUSTOM") {
    return platform.label && platform.label !== "Своя площадка"
      ? `Оставить отзыв на ${platform.label}`
      : step.ctaLabel?.trim() || PLATFORM_CTA_LABELS.CUSTOM;
  }
  return PLATFORM_CTA_LABELS[platform.action];
}
