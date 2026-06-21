/** Cookie / query flag: manual QA sessions must not pollute Metrika, funnel reports, or offline conversions. */

export const NO_ANALYTICS_COOKIE = "qrstars_no_analytics";
export const NO_ANALYTICS_COOKIE_VALUE = "1";
export const NO_ANALYTICS_QUERY_PARAM = "no_analytics";
export const NO_ANALYTICS_COOKIE_MAX_AGE_SEC = 31_536_000; // 1 year
export const NO_ANALYTICS_COOKIE_DOMAIN = ".qrstars.ru";

export const INTERNAL_TEST_REGISTRATION_SOURCE = "internal_test";

const DEFAULT_INTERNAL_TEST_EMAIL_DOMAINS = ["test.qrstars.ru", "example.com"];

type CookieReader = {
  get: (name: string) => { value: string } | undefined;
};

export function getInternalTestEmailDomains(): string[] {
  const raw = process.env.INTERNAL_TEST_EMAIL_DOMAINS?.trim();
  if (!raw) return DEFAULT_INTERNAL_TEST_EMAIL_DOMAINS;
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

function emailLocalPart(email: string): string {
  const at = email.indexOf("@");
  return at >= 0 ? email.slice(0, at) : email;
}

function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

export function isInternalTestEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  const local = emailLocalPart(normalized);
  if (local.includes("+test")) return true;

  const domain = emailDomain(normalized);
  if (!domain) return false;

  return getInternalTestEmailDomains().some(
    (d) => domain === d || domain.endsWith(`.${d}`)
  );
}

export function isAnalyticsDisabled(cookies: CookieReader): boolean {
  return cookies.get(NO_ANALYTICS_COOKIE)?.value === NO_ANALYTICS_COOKIE_VALUE;
}

export function isAnalyticsDisabledClient(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((part) => {
      const [name, ...rest] = part.trim().split("=");
      return name === NO_ANALYTICS_COOKIE && rest.join("=") === NO_ANALYTICS_COOKIE_VALUE;
    });
}

export function buildNoAnalyticsCookieOptions(hostname?: string): {
  path: string;
  maxAge: number;
  sameSite: "lax";
  domain?: string;
} {
  const host = hostname?.toLowerCase() ?? "";
  const useProdDomain = host === "qrstars.ru" || host.endsWith(".qrstars.ru");

  return {
    path: "/",
    maxAge: NO_ANALYTICS_COOKIE_MAX_AGE_SEC,
    sameSite: "lax",
    ...(useProdDomain ? { domain: NO_ANALYTICS_COOKIE_DOMAIN } : {}),
  };
}

export function setNoAnalyticsCookie(hostname?: string): void {
  if (typeof document === "undefined") return;
  const opts = buildNoAnalyticsCookieOptions(hostname ?? window.location.hostname);
  let cookie = `${NO_ANALYTICS_COOKIE}=${NO_ANALYTICS_COOKIE_VALUE};path=${opts.path};max-age=${opts.maxAge};SameSite=Lax`;
  if (opts.domain) {
    cookie += `;domain=${opts.domain}`;
  }
  document.cookie = cookie;
}

export function clearAnalyticsExclusionCookie(hostname?: string): void {
  if (typeof document === "undefined") return;
  const host = hostname ?? window.location.hostname;
  const opts = buildNoAnalyticsCookieOptions(host);
  let cookie = `${NO_ANALYTICS_COOKIE}=;path=${opts.path};max-age=0;SameSite=Lax`;
  if (opts.domain) {
    cookie += `;domain=${opts.domain}`;
  }
  document.cookie = cookie;
  document.cookie = `${NO_ANALYTICS_COOKIE}=;path=${opts.path};max-age=0;SameSite=Lax`;
}

export function isInternalRegistration(input: {
  registrationSource?: string | null;
  email: string;
  analyticsDisabled?: boolean;
}): boolean {
  if (input.registrationSource === INTERNAL_TEST_REGISTRATION_SOURCE) return true;
  if (input.analyticsDisabled) return true;
  return isInternalTestEmail(input.email);
}

/** Prisma filter: real users for admin funnel / registration metrics (excludes ADMIN + QA). */
export function analyticsCohortUserWhere() {
  return {
    role: { not: "ADMIN" as const },
    NOT: { registrationSource: INTERNAL_TEST_REGISTRATION_SOURCE },
  };
}

export function resolveRegistrationSource(input: {
  email: string;
  analyticsDisabled: boolean;
}): typeof INTERNAL_TEST_REGISTRATION_SOURCE | "register" {
  if (input.analyticsDisabled || isInternalTestEmail(input.email)) {
    return INTERNAL_TEST_REGISTRATION_SOURCE;
  }
  return "register";
}
