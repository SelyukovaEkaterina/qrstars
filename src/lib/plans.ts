export type PlanId = "FREE" | "PRO" | "NETWORK";

export type BillingPeriod = "monthly" | "yearly";

export interface PlanPricing {
  monthlyRub: number;
  yearlyRub: number;
  yearlyNote: string;
  /** Тариф продаётся только на год: помесячной оплаты нет. */
  yearlyOnly?: boolean;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  tagline: string;
  pricing: PlanPricing;
  establishmentLimit: number | null;
  establishmentLimitNote: string;
  features: string[];
  highlighted?: boolean;
}

/** Скидка округляется до 10 ₽: 990 × 30% = 693 → 690. */
export function offerYearlyRub(listRub: number, discountPercent: number): number {
  const discounted = (listRub * (100 - discountPercent)) / 100;
  return Math.round(discounted / 10) * 10;
}

export const PLAN_PRICING = {
  /** PRO продаётся только на год (решение 2026-10-04). monthlyRub — лишь эквивалент для MRR и подписей. */
  PRO: {
    monthlyRub: 83,
    yearlyRub: 990,
    yearlyNote: "≈83 ₽/мес",
    yearlyOnly: true,
  },
  /** «Сеть» с 2026-10-14: 5 заведений за 2 900 ₽/год, только годовая оплата. monthlyRub — эквивалент для MRR. */
  NETWORK: {
    monthlyRub: 242,
    yearlyRub: 2900,
    yearlyNote: "≈242 ₽/мес · до 5 проектов",
    yearlyOnly: true,
    includedEstablishments: 5,
  },
} as const;

/**
 * Персональная цена PRO на первый год.
 * Письмо уходит один раз, когда с первого скана своего QR прошло minDaysSinceFirstScan
 * и сканов уже minScans. Код живёт validDays с момента отправки, напоминание за reminderLeadDays.
 * Со следующего года списание по PLAN_PRICING.PRO.yearlyRub.
 */
export const PRO_INTRO_OFFER = {
  discountPercent: 30,
  yearlyRub: offerYearlyRub(PLAN_PRICING.PRO.yearlyRub, 30),
  validDays: 7,
  reminderLeadDays: 2,
  minScans: 3,
  minDaysSinceFirstScan: 14,
  /** Первое письмо и напоминание вместе, календарный день МСК. Остальные ждут следующий запуск. */
  maxPerDay: 5,
  campaignKey: "pro_offer_d14",
  reminderCampaignKey: "pro_offer_reminder",
  codePrefix: "START30",
} as const;

/** Старая помесячная схема «Сети» (600 ₽/мес + 150 ₽ за точку сверх 2): только для уже оформленных месячных подписок. */
const NETWORK_LEGACY_MONTHLY = {
  monthlyRub: 600,
  extraEstablishmentMonthlyRub: 150,
  includedEstablishments: 2,
} as const;

/** Куда писать, если тарифа не хватает. */
export const CUSTOM_PLAN_HINT =
  "Если этого не хватает — напишите нам в техподдержку в личном кабинете, подберём индивидуальный выгодный тариф.";

export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: {
    id: "FREE",
    name: "FREE",
    tagline: "Ядро продукта — навсегда бесплатно",
    pricing: { monthlyRub: 0, yearlyRub: 0, yearlyNote: "" },
    establishmentLimit: 1,
    establishmentLimitNote: "1 проект",
    features: [
      "Маршрутизация 1–5★: низкие → жалоба, высокие → публичная площадка",
      "Жалобы (1–3★) → email-уведомление",
      "4–5★ → Яндекс.Карты (стандарт)",
      "Режимы QR: отзывы, меню, визитка, Wi‑Fi, редирект, файл",
      "QR-кодов в проекте — без лимита",
      "Базовая аналитика: сканирования + средний рейтинг",
      "Вотермарка «Сделано в QrStars»",
    ],
  },
  PRO: {
    id: "PRO",
    name: "PRO",
    tagline: "Прямой переход без экрана и усиление отзывов",
    pricing: PLAN_PRICING.PRO,
    establishmentLimit: 1,
    establishmentLimitNote: "1 проект",
    highlighted: true,
    features: [
      "Прямой переход по QR-ссылке — без экрана QrStars",
      "Микросайт — страница со всеми разделами в одном QR",
      "Умная ротация площадок для 5★ (Яндекс / 2GIS / Авито)",
      "Жалобы в Telegram и MAX — мгновенно, вместо email",
      "White Label — ваш логотип вместо вотермарки",
      "Промокод за отзыв 5★, интеграция чаевых",
      "Расширенная аналитика: конверсия, разрезы по дням и устройствам",
      "QR-кодов в проекте — без лимита",
      "Приоритетная поддержка",
    ],
  },
  NETWORK: {
    id: "NETWORK",
    name: "Сеть",
    tagline: "До 5 проектов на одном тарифе",
    pricing: PLAN_PRICING.NETWORK,
    establishmentLimit: PLAN_PRICING.NETWORK.includedEstablishments,
    establishmentLimitNote: `${PLAN_PRICING.NETWORK.includedEstablishments} проектов`,
    features: [
      "Всё из PRO для каждого проекта",
      `До ${PLAN_PRICING.NETWORK.includedEstablishments} проектов в одном кабинете`,
      "Сводный дашборд сети: рейтинг и динамика по проектам",
      "Роли доступа: управляющий видит свой проект",
      "White Label на уровне бренда сети",
      "Выгрузка отчётов (CSV)",
      "QR-кодов в проекте — без лимита",
    ],
  },
};

export const PAID_PLAN_IDS: PlanId[] = ["PRO", "NETWORK"];

export function hasPaidFeatures(plan: string | null | undefined): boolean {
  return plan === "PRO" || plan === "NETWORK";
}

export function isNetworkPlan(plan: string | null | undefined): boolean {
  return plan === "NETWORK";
}

/** Максимум заведений: FREE/PRO — 1; Сеть — 5. Больше — индивидуальный тариф через поддержку. */
export function getEstablishmentLimit(plan: string | null | undefined): number | null {
  if (plan === "NETWORK") return PLAN_PRICING.NETWORK.includedEstablishments;
  return 1;
}

export function canAddEstablishment(
  plan: string | null | undefined,
  currentCount: number
): boolean {
  const limit = getEstablishmentLimit(plan);
  if (limit === null) return true;
  return currentCount < limit;
}

/** Стоимость старой месячной подписки «Сети» по числу заведений (legacy). */
function calcLegacyNetworkMonthlyPrice(establishmentCount: number): number {
  const { monthlyRub, extraEstablishmentMonthlyRub, includedEstablishments } =
    NETWORK_LEGACY_MONTHLY;
  const extra = Math.max(0, establishmentCount - includedEstablishments);
  return monthlyRub + extra * extraEstablishmentMonthlyRub;
}

export function calcSubscriptionAmount(
  plan: "PRO" | "NETWORK",
  billing: BillingPeriod,
  establishmentCount: number
): number {
  if (plan === "PRO") return PLAN_PRICING.PRO.yearlyRub;
  if (billing === "yearly") return PLAN_PRICING.NETWORK.yearlyRub;
  return calcLegacyNetworkMonthlyPrice(Math.max(establishmentCount, 2));
}

export function formatPlanLabel(plan: string | null | undefined): string {
  if (plan === "PRO") return "PRO";
  if (plan === "NETWORK") return "Сеть";
  return "FREE";
}

export function formatRub(amount: number): string {
  return `${amount.toLocaleString("ru-RU")} ₽`;
}

export function getUpgradeHint(
  plan: string | null | undefined,
  currentCount: number
): { requiredPlan: "PRO" | "NETWORK"; message: string } | null {
  if (canAddEstablishment(plan, currentCount)) return null;
  if (!hasPaidFeatures(plan)) {
    return {
      requiredPlan: currentCount >= 1 ? "NETWORK" : "PRO",
      message:
        currentCount >= 1
          ? "На FREE доступен 1 проект. Для второго подключите тариф «Сеть»."
          : "Достигнут лимит проектов на FREE.",
    };
  }
  if (plan === "PRO") {
    return {
      requiredPlan: "NETWORK",
      message:
        "На PRO доступен 1 проект. Для нескольких проектов подключите тариф «Сеть» — до 5 проектов.",
    };
  }
  return {
    requiredPlan: "NETWORK",
    message: `На тарифе «Сеть» доступно ${PLAN_PRICING.NETWORK.includedEstablishments} проектов. ${CUSTOM_PLAN_HINT}`,
  };
}

export function estimateSubscriptionMonthlyRevenue(
  plan: string,
  establishmentCount: number
): number {
  if (plan === "PRO") return PLAN_PRICING.PRO.monthlyRub;
  if (plan === "NETWORK") return PLAN_PRICING.NETWORK.monthlyRub;
  return 0;
}
