/**
 * Экран QrStars перед внешним переходом (REDIRECT) на FREE.
 *
 * Гость видит логотип и обратный отсчёт, затем уходит по ссылке; кнопка
 * «Перейти сейчас» доступна сразу. Платные тарифы и QR, созданные до
 * появления экрана (`redirectGrandfathered`), ведут напрямую.
 */
export const REDIRECT_INTERSTITIAL_SECONDS = 3;

const PROMO_BASE_URL = "https://qrstars.ru/";

export function shouldShowRedirectInterstitial(input: {
  hasPaidPlan: boolean;
  grandfathered: boolean;
  hasOwner: boolean;
}): boolean {
  return input.hasOwner && !input.grandfathered && !input.hasPaidPlan;
}

/** Ссылка на лендинг с меткой, чтобы считать регистрации с экрана. */
export function redirectInterstitialPromoUrl(code: string): string {
  const url = new URL(PROMO_BASE_URL);
  url.searchParams.set("utm_source", "qr_interstitial");
  url.searchParams.set("utm_medium", "referral");
  url.searchParams.set("utm_campaign", "free_redirect");
  url.searchParams.set("utm_content", code);
  return url.toString();
}

/** Домен назначения для подписи «Переходим на …»; для tel:/относительных — null. */
export function redirectTargetLabel(target: string): string | null {
  try {
    const { protocol, hostname } = new URL(target);
    if (protocol !== "http:" && protocol !== "https:") return null;
    return hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
