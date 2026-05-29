export type PlanId = "FREE" | "PRO" | "NETWORK";

export type BillingPeriod = "monthly" | "yearly";

export interface PlanPricing {
  monthlyRub: number;
  yearlyRub: number;
  yearlyNote: string;
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

export const PLAN_PRICING = {
  PRO: {
    monthlyRub: 690,
    yearlyRub: 6900,
    yearlyNote: "≈575 ₽/мес — 2 месяца в подарок",
  },
  NETWORK: {
    monthlyRub: 1490,
    yearlyRub: 14900,
    yearlyNote: "≈1 242 ₽/мес за базу — 2 месяца в подарок",
    extraEstablishmentMonthlyRub: 350,
    includedEstablishments: 2,
  },
} as const;

export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: {
    id: "FREE",
    name: "FREE",
    tagline: "Ядро продукта — навсегда бесплатно",
    pricing: { monthlyRub: 0, yearlyRub: 0, yearlyNote: "" },
    establishmentLimit: 1,
    establishmentLimitNote: "1 заведение",
    features: [
      "Маршрутизация 1–5★: низкие → жалоба, высокие → публичная площадка",
      "Жалобы (1–3★) → email-уведомление",
      "5★ → 1 площадка на выбор (Яндекс / 2GIS / Авито)",
      "Все режимы QR: лендинг, меню, отзывы, визитка, Wi‑Fi, редирект, файл",
      "QR-кодов в заведении — без лимита",
      "Базовая аналитика: сканирования + средний рейтинг",
      "Вотермарка «Сделано в QrStars»",
      "Партнёрская программа",
    ],
  },
  PRO: {
    id: "PRO",
    name: "PRO",
    tagline: "Усиление для одиночной точки",
    pricing: PLAN_PRICING.PRO,
    establishmentLimit: 1,
    establishmentLimitNote: "1 заведение",
    highlighted: true,
    features: [
      "Умная ротация площадок для 5★ (Яндекс / 2GIS / Авито / Flamp)",
      "Жалобы в Telegram и MAX — мгновенно, вместо email",
      "White Label — логотип заведения вместо вотермарки",
      "Промокод за отзыв 5★, интеграция чаевых",
      "Расширенная аналитика: конверсия, разрезы по дням и устройствам",
      "QR-кодов в заведении — без лимита",
      "Приоритетная поддержка",
    ],
  },
  NETWORK: {
    id: "NETWORK",
    name: "Сеть",
    tagline: "Для сетей и франшиз",
    pricing: {
      monthlyRub: PLAN_PRICING.NETWORK.monthlyRub,
      yearlyRub: PLAN_PRICING.NETWORK.yearlyRub,
      yearlyNote: PLAN_PRICING.NETWORK.yearlyNote,
    },
    establishmentLimit: null,
    establishmentLimitNote: "2 заведения в базе, далее +350 ₽/мес за точку",
    features: [
      "Всё из PRO для каждой точки",
      "2 заведения включено, далее +350 ₽/мес за точку",
      "Сводный дашборд сети: рейтинг и динамика по точкам",
      "Роли доступа: управляющий видит свою точку",
      "White Label на уровне бренда сети",
      "Выгрузка отчётов (CSV)",
      "QR-кодов в заведении — без лимита",
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

/** Максимум заведений: FREE/PRO — 1; Сеть — без жёсткого лимита (оплата за точки). */
export function getEstablishmentLimit(plan: string | null | undefined): number | null {
  if (plan === "NETWORK") return null;
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

/** Стоимость тарифа «Сеть» за месяц по числу заведений. */
export function calcNetworkMonthlyPrice(establishmentCount: number): number {
  const { monthlyRub, extraEstablishmentMonthlyRub, includedEstablishments } =
    PLAN_PRICING.NETWORK;
  const extra = Math.max(0, establishmentCount - includedEstablishments);
  return monthlyRub + extra * extraEstablishmentMonthlyRub;
}

export function calcSubscriptionAmount(
  plan: "PRO" | "NETWORK",
  billing: BillingPeriod,
  establishmentCount: number
): number {
  if (plan === "PRO") {
    return billing === "yearly"
      ? PLAN_PRICING.PRO.yearlyRub
      : PLAN_PRICING.PRO.monthlyRub;
  }
  const monthly = calcNetworkMonthlyPrice(Math.max(establishmentCount, 2));
  if (billing === "yearly") {
    const extra = Math.max(0, establishmentCount - PLAN_PRICING.NETWORK.includedEstablishments);
    return PLAN_PRICING.NETWORK.yearlyRub + extra * PLAN_PRICING.NETWORK.extraEstablishmentMonthlyRub * 10;
  }
  return monthly;
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
          ? "На FREE доступно 1 заведение. Для второй точки подключите тариф «Сеть»."
          : "Достигнут лимит заведений на FREE.",
    };
  }
  if (plan === "PRO") {
    return {
      requiredPlan: "NETWORK",
      message:
        "На PRO доступно 1 заведение. Для сети из нескольких точек подключите тариф «Сеть».",
    };
  }
  return null;
}

export function estimateSubscriptionMonthlyRevenue(
  plan: string,
  establishmentCount: number
): number {
  if (plan === "PRO") return PLAN_PRICING.PRO.monthlyRub;
  if (plan === "NETWORK") {
    return calcNetworkMonthlyPrice(Math.max(establishmentCount, 2));
  }
  return 0;
}
