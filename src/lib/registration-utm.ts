const UTM_KEYS = ["utm_source", "utm_campaign", "utm_content", "utm_medium", "utm_term"] as const;
const ATTRIBUTION_KEYS = [...UTM_KEYS, "yclid", "ymclid"] as const;

export type RegistrationUtm = Partial<Record<(typeof ATTRIBUTION_KEYS)[number], string>>;

export function parseRegistrationUtm(input: unknown): RegistrationUtm | null {
  const source =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  const utm: RegistrationUtm = {};
  for (const key of ATTRIBUTION_KEYS) {
    const raw = source[key];
    if (typeof raw === "string" && raw.trim()) {
      utm[key] = raw.trim().slice(0, 200);
    }
  }
  return Object.keys(utm).length > 0 ? utm : null;
}

export function parseRegistrationUtmFromSearchParams(
  searchParams: URLSearchParams
): RegistrationUtm | null {
  const flat: Record<string, string> = {};
  for (const key of ATTRIBUTION_KEYS) {
    const val = searchParams.get(key)?.trim();
    if (val) flat[key] = val;
  }
  return parseRegistrationUtm(flat);
}

export function normalizeMetrikaClientId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().slice(0, 64);
  return /^[\d.a-zA-Z_-]+$/.test(value) ? value : null;
}

export function registrationUtmToSearchParams(utm: RegistrationUtm): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of UTM_KEYS) {
    const val = utm[key];
    if (val) params.set(key, val);
  }
  return params;
}

export function buildDashboardStartUrl(searchParams: URLSearchParams): string {
  const utm = parseRegistrationUtmFromSearchParams(searchParams);
  const params = utm ? registrationUtmToSearchParams(utm) : new URLSearchParams();
  const intent = searchParams.get("intent")?.trim();
  if (intent) params.set("intent", intent);
  const qs = params.toString();
  return qs ? `/dashboard/start?${qs}` : "/dashboard/start";
}

const DEFAULT_REGISTER_SUBTITLE =
  "Регистрация — дальше настроите страницу и QR для гостей";

/** Подзаголовок на /register по UTM-кампании. */
export function resolveRegistrationSubtitle(searchParams: URLSearchParams): string {
  const intent = (searchParams.get("intent") ?? "").trim().toLowerCase();
  if (intent === "redirect") {
    return "Создайте динамический QR — ссылку можно менять после печати";
  }
  if (intent === "menu") {
    return "Создайте электронное меню за 2 минуты";
  }
  if (intent === "reviews") {
    return "Настройте QR для отзывов на Яндекс Картах";
  }
  if (intent === "landing") {
    return "Соберите микросайт заведения на одном QR";
  }
  const campaign = (searchParams.get("utm_campaign") ?? "").trim().toLowerCase();
  if (campaign.includes("menu") || campaign === "menu_search") {
    return "Создайте электронное меню за 2 минуты";
  }
  if (
    campaign.includes("reviews") ||
    campaign === "reviews_search" ||
    campaign === "reviews_landing"
  ) {
    return "Настройте QR для отзывов на Яндекс Картах";
  }
  return DEFAULT_REGISTER_SUBTITLE;
}
