export type FeedbackSurveyKind = "d7" | "d90" | "d365";

export const FEEDBACK_SURVEY_KINDS: FeedbackSurveyKind[] = ["d7", "d90", "d365"];

export function isFeedbackSurveyKind(value: string): value is FeedbackSurveyKind {
  return FEEDBACK_SURVEY_KINDS.includes(value as FeedbackSurveyKind);
}

export function feedbackCampaignKey(kind: FeedbackSurveyKind): string {
  return `feedback_${kind}`;
}

export interface FeedbackSurveyConfig {
  kind: FeedbackSurveyKind;
  title: string;
  description: string;
  npsLabel: string;
  commentLabel: string;
  commentPlaceholder: string;
  showContact: boolean;
  contactLabel: string;
  submitLabel: string;
  thanksMessage: string;
}

export const FEEDBACK_SURVEY_CONFIG: Record<FeedbackSurveyKind, FeedbackSurveyConfig> = {
  d7: {
    kind: "d7",
    title: "Как вам QrStars?",
    description:
      "Насколько вероятно, что вы порекомендуете QrStars коллеге? (0 — точно нет, 10 — точно да)",
    npsLabel: "Оценка",
    commentLabel: "Что понравилось или чего не хватает? (необязательно)",
    commentPlaceholder: "Расскажите коротко…",
    showContact: true,
    contactLabel: "Можно связаться со мной для короткого интервью (15 мин)",
    submitLabel: "Отправить отзыв",
    thanksMessage: "Ваш отзыв поможет нам сделать QrStars лучше.",
  },
  d90: {
    kind: "d90",
    title: "QrStars через 3 месяца",
    description:
      "Вы пользуетесь QrStars уже несколько месяцев — расскажите, как сервис работает в вашем заведении.",
    npsLabel: "Насколько вероятно, что порекомендуете QrStars? (0–10)",
    commentLabel: "Чего не хватает для ежедневной работы? (необязательно)",
    commentPlaceholder: "Например: Telegram-уведомления, аналитика, шаблоны…",
    showContact: true,
    contactLabel: "Можно связаться для короткого интервью",
    submitLabel: "Отправить",
    thanksMessage: "Спасибо — ваши ответы помогают приоритизировать развитие продукта.",
  },
  d365: {
    kind: "d365",
    title: "Год с QrStars",
    description:
      "Спасибо, что остаётесь с нами! Поделитесь, как QrStars повлиял на работу с отзывами за год.",
    npsLabel: "Насколько вероятно, что порекомендуете QrStars? (0–10)",
    commentLabel: "Как QrStars помог за год? Что улучшить? (необязательно)",
    commentPlaceholder: "История, пожелания, идеи…",
    showContact: true,
    contactLabel: "Можно связаться — хотим опубликовать ваш кейс (с вашего согласия)",
    submitLabel: "Отправить",
    thanksMessage: "Спасибо за доверие! Мы ценим каждого долгосрочного партнёра.",
  },
};

/** TTL ссылки на опрос: 7 дней для d7, 14 дней для d90/d365. */
export function feedbackTokenTtlMs(kind: FeedbackSurveyKind): number {
  if (kind === "d7") return 7 * 24 * 60 * 60 * 1000;
  return 14 * 24 * 60 * 60 * 1000;
}
