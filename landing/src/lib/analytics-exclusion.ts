/** Cookie / query flag: manual QA sessions must not pollute Metrika or funnel reports. */

export const NO_ANALYTICS_COOKIE = 'qrstars_no_analytics';
export const NO_ANALYTICS_COOKIE_VALUE = '1';
export const NO_ANALYTICS_QUERY_PARAM = 'no_analytics';
export const NO_ANALYTICS_COOKIE_MAX_AGE_SEC = 31_536_000; // 1 year
export const NO_ANALYTICS_COOKIE_DOMAIN = '.qrstars.ru';

type CookieReader = {
  get: (name: string) => { value: string } | undefined;
};

export function isAnalyticsDisabled(cookies: CookieReader): boolean {
  return cookies.get(NO_ANALYTICS_COOKIE)?.value === NO_ANALYTICS_COOKIE_VALUE;
}

export function isAnalyticsDisabledClient(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split(';')
    .some((part) => {
      const [name, ...rest] = part.trim().split('=');
      return name === NO_ANALYTICS_COOKIE && rest.join('=') === NO_ANALYTICS_COOKIE_VALUE;
    });
}

export function buildNoAnalyticsCookieOptions(hostname?: string): {
  path: string;
  maxAge: number;
  sameSite: 'lax';
  domain?: string;
} {
  const host = hostname?.toLowerCase() ?? '';
  const useProdDomain = host === 'qrstars.ru' || host.endsWith('.qrstars.ru');

  return {
    path: '/',
    maxAge: NO_ANALYTICS_COOKIE_MAX_AGE_SEC,
    sameSite: 'lax',
    ...(useProdDomain ? { domain: NO_ANALYTICS_COOKIE_DOMAIN } : {}),
  };
}

export function setNoAnalyticsCookie(hostname?: string): void {
  if (typeof document === 'undefined') return;
  const opts = buildNoAnalyticsCookieOptions(hostname ?? window.location.hostname);
  let cookie = `${NO_ANALYTICS_COOKIE}=${NO_ANALYTICS_COOKIE_VALUE};path=${opts.path};max-age=${opts.maxAge};SameSite=Lax`;
  if (opts.domain) {
    cookie += `;domain=${opts.domain}`;
  }
  document.cookie = cookie;
}

export function clearAnalyticsExclusionCookie(hostname?: string): void {
  if (typeof document === 'undefined') return;
  const host = hostname ?? window.location.hostname;
  const opts = buildNoAnalyticsCookieOptions(host);
  let cookie = `${NO_ANALYTICS_COOKIE}=;path=${opts.path};max-age=0;SameSite=Lax`;
  if (opts.domain) {
    cookie += `;domain=${opts.domain}`;
  }
  document.cookie = cookie;
  document.cookie = `${NO_ANALYTICS_COOKIE}=;path=${opts.path};max-age=0;SameSite=Lax`;
}
