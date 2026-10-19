/** Публичный адрес микросайта: https://{slug}.qrstars.ru → страница /a/{slug}. */

export const MICROSITE_HOST_SUFFIX = ".qrstars.ru";

/** Имена, которые уже заняты сервисом или нельзя отдавать клиенту. */
const RESERVED_MICROSITE_SLUGS = new Set([
  "app",
  "www",
  "s3",
  "mail",
  "ftp",
  "ns",
  "ns1",
  "ns2",
  "api",
  "admin",
  "cdn",
  "static",
  "files",
  "storage",
  "m",
  "blog",
  "status",
  "docs",
  "help",
  "support",
  "dev",
  "staging",
  "test",
  "demo",
  "qr",
  "q",
  "smtp",
  "imap",
  "pop",
  "autoconfig",
  "autodiscover",
  "localhost",
  "pay",
  "webhook",
]);

/** От 2 до 32 символов: строчные латинские, цифры, дефис не с краю. Подчёркивание в домен не входит. */
const MICROSITE_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

export function isReservedMicrositeSlug(slug: string): boolean {
  return RESERVED_MICROSITE_SLUGS.has(slug);
}

export function isMicrositeSlug(slug: string): boolean {
  return (
    slug.length >= 2 &&
    slug.length <= 32 &&
    MICROSITE_SLUG_RE.test(slug) &&
    !isReservedMicrositeSlug(slug)
  );
}

/** Slug из Host, если это клиентский поддомен. Иначе null (app, www, s3, локалка). */
export function micrositeSlugFromHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].trim().toLowerCase().replace(/\.$/, "");
  if (!hostname.endsWith(MICROSITE_HOST_SUFFIX)) return null;
  const slug = hostname.slice(0, -MICROSITE_HOST_SUFFIX.length);
  if (!slug || slug.includes(".")) return null;
  if (!isMicrositeSlug(slug)) return null;
  return slug;
}
