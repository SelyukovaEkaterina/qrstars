export type ReviewStarAction = "COMPLAINT" | "YANDEX" | "TWO_GIS" | "AVITO" | "THANKS";

export type StarRating = 1 | 2 | 3 | 4 | 5;

export interface ReviewStarStep {
  action: ReviewStarAction;
  promptTitle: string;
  promptSubtitle: string;
  thanksTitle: string;
  thanksSubtitle: string;
  ctaLabel: string;
}

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
      promptTitle: "Нам очень жаль! Расскажите подробнее",
      promptSubtitle: "Ваше сообщение попадёт лично руководству",
      thanksTitle: "Спасибо за обратную связь!",
      thanksSubtitle: "Мы уже работаем над улучшением. Руководство лично прочитает ваш отзыв.",
      ctaLabel: "Отправить",
    };
  }
  if (star === 4) {
    return {
      action: "TWO_GIS",
      promptTitle: "Спасибо! Оставьте отзыв на карте?",
      promptSubtitle: "Это поможет нам стать лучше!",
      thanksTitle: "Спасибо за вашу оценку!",
      thanksSubtitle: "Будем рады, если поделитесь впечатлением на карте.",
      ctaLabel: "Оставить отзыв в 2GIS",
    };
  }
  return {
    action: "YANDEX",
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
    v === "THANKS"
  );
}

function parseStep(raw: unknown, star: StarRating): ReviewStarStep {
  const defaults = defaultStep(star);
  if (!raw || typeof raw !== "object") return defaults;
  const o = raw as Record<string, unknown>;
  return {
    action: isValidAction(o.action) ? o.action : defaults.action,
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
    out[String(star)] = config[star];
  }
  return out;
}

export function isComplaintAction(action: ReviewStarAction): boolean {
  return action === "COMPLAINT";
}

export function resolveActionUrl(action: ReviewStarAction, urls: PlatformUrls): string | null {
  switch (action) {
    case "YANDEX":
      return urls.yandexMapsUrl;
    case "TWO_GIS":
      return urls.twoGisUrl;
    case "AVITO":
      return urls.avitoUrl;
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
