const ATTRIBUTION_QUERY_KEYS = ['yclid', 'ymclid'] as const;

/** Landing URL may override these defaults baked into register CTAs (not utm_content — page-specific). */
const LANDING_OVERRIDE_UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term'] as const;

/** Manual QA on landing/app: use utm_campaign=internal_test — do not mix with menu_search / reviews_search. */
export const INTERNAL_TEST_UTM_CAMPAIGN = 'internal_test';

/** Prefer utm_medium from the landing URL (e.g. cpc from Yandex Direct); default to seo. */
export function resolveUtmMedium(searchParams: URLSearchParams, fallback: 'seo' | 'cpc' = 'seo'): string {
  return searchParams.get('utm_medium') ?? fallback;
}

/** Append utm_* and attribution query params from the landing page URL to outbound app links. */
export function appendAttributionParams(baseUrl: string, searchParams: URLSearchParams): string {
  try {
    const url = new URL(baseUrl);
    for (const [key, value] of searchParams.entries()) {
      if (!key.startsWith('utm_')) continue;
      const mayOverride =
        LANDING_OVERRIDE_UTM_KEYS.includes(key as (typeof LANDING_OVERRIDE_UTM_KEYS)[number]);
      if (mayOverride || !url.searchParams.has(key)) {
        url.searchParams.set(key, value);
      }
    }
    for (const key of ATTRIBUTION_QUERY_KEYS) {
      const value = searchParams.get(key);
      if (value && !url.searchParams.has(key)) {
        url.searchParams.set(key, value);
      }
    }
    const intent = searchParams.get('intent');
    if (intent && url.pathname.startsWith('/register') && !url.searchParams.has('intent')) {
      url.searchParams.set('intent', intent);
    }
    // Реферальный код блогера; в браузере его же подставляет скрипт в Layout.astro (с памятью на 30 дней).
    const ref = searchParams.get('ref');
    if (ref && /^[A-Za-z0-9_-]{2,64}$/.test(ref) && url.pathname.startsWith('/register') && !url.searchParams.has('ref')) {
      url.searchParams.set('ref', ref);
    }
    return url.toString();
  } catch {
    return baseUrl;
  }
}

export const appendUtm = appendAttributionParams;

export function isAppUrl(href: string): boolean {
  return href.startsWith('https://app.qrstars.ru');
}

/** Сценарий онбординга в кабинете (`/register?intent=` → мастер на /dashboard/start). */
export type SetupIntent = 'reviews' | 'landing' | 'redirect' | 'menu' | 'card';

export function withSetupIntent(href: string, intent: SetupIntent): string {
  try {
    const url = new URL(href);
    if (!url.pathname.startsWith('/register')) return href;
    if (!url.searchParams.has('intent')) url.searchParams.set('intent', intent);
    return url.toString();
  } catch {
    return href;
  }
}

/** Выбранный на лендинге тариф (`/register?plan=pro|network`) — кабинет может сразу предложить оплату. */
export function withPlan(href: string, plan: 'pro' | 'network'): string {
  try {
    const url = new URL(href);
    if (!url.searchParams.has('plan')) url.searchParams.set('plan', plan);
    return url.toString();
  } catch {
    return href;
  }
}

export function registerUrl(
  content: string,
  searchParams: URLSearchParams,
  options: { campaign?: string; intent?: SetupIntent } = {},
): string {
  const medium = resolveUtmMedium(searchParams);
  const campaign = options.campaign ?? 'main_landing';
  const url = new URL('https://app.qrstars.ru/register');
  url.searchParams.set('utm_source', 'qrstars');
  url.searchParams.set('utm_medium', medium);
  url.searchParams.set('utm_campaign', campaign);
  url.searchParams.set('utm_content', content);
  if (options.intent) url.searchParams.set('intent', options.intent);
  return appendAttributionParams(url.toString(), searchParams);
}

/** Register URL для визитки: кампания `master_card` → в кабинете отрасль «Мастер / услуги». */
export function cardRegisterUrl(
  content: string,
  searchParams: URLSearchParams,
  campaign: 'master_card' | 'main_landing' = 'main_landing',
): string {
  return registerUrl(content, searchParams, { campaign, intent: 'card' });
}

export function redirectRegisterUrl(content: string, searchParams: URLSearchParams): string {
  return registerUrl(content, searchParams, { campaign: 'main_landing', intent: 'redirect' });
}

/** Ссылка на UXCheck — наш сервис ИИ-аудита юзабилити. */
export function uxcheckUrl(content: string): string {
  const url = new URL('https://uxcheck.ru/');
  url.searchParams.set('utm_source', 'qrstars');
  url.searchParams.set('utm_medium', 'referral');
  url.searchParams.set('utm_campaign', 'qrstars_cross');
  url.searchParams.set('utm_content', content);
  return url.toString();
}

export const REVIEWS_LANDING_SLUGS = new Set([
  'qr-kod-dlya-yandeks-kart',
  'qr-kod-dlya-2gis',
  'qr-kod-dlya-otzyvov',
  'qr-kod-dlya-salona-krasoty',
  'qr-kod-dlya-stomatologii',
  'qr-kod-dlya-avtoservisa',
]);

export const MENU_LANDING_SLUGS = new Set(['qr-kod-dlya-restorana']);

export const MENU_LANDING_PATHS = new Set([
  '/qr-menu.html',
  '/qr-kod-dlya-restorana.html',
  '/blog/qr-kod-dlya-menu-restorana.html',
]);

/** Register URL for menu intent pages with campaign-specific utm_content. */
export function menuRegisterUrl(content: string, searchParams: URLSearchParams): string {
  const medium = resolveUtmMedium(searchParams);
  const base = `https://app.qrstars.ru/register?utm_source=qrstars&utm_medium=${medium}&utm_campaign=menu_search&utm_content=${content}`;
  return withSetupIntent(appendAttributionParams(base, searchParams), 'menu');
}

/** Register URL for broad QR-generator intent pages. */
export function generatorRegisterUrl(content: string, searchParams: URLSearchParams): string {
  const medium = resolveUtmMedium(searchParams);
  const base = `https://app.qrstars.ru/register?utm_source=qrstars&utm_medium=${medium}&utm_campaign=generator_search&utm_content=${content}`;
  return withSetupIntent(appendAttributionParams(base, searchParams), 'redirect');
}

/** Register URL for reviews intent pages with campaign-specific utm_content. */
export function reviewsRegisterUrl(content: string, searchParams: URLSearchParams): string {
  const medium = resolveUtmMedium(searchParams);
  const campaign = searchParams.get('utm_campaign') === 'reviews_search' ? 'reviews_search' : 'reviews_landing';
  const base = `https://app.qrstars.ru/register?utm_source=qrstars&utm_medium=${medium}&utm_campaign=${campaign}&utm_content=${content}`;
  return withSetupIntent(appendAttributionParams(base, searchParams), 'reviews');
}
