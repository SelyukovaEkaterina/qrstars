import { normalizeMetrikaClientId } from "./registration-utm";

/** Read _ym_uid cookie set by Yandex Metrika (browser only). */
export function getMetrikaClientIdFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)_ym_uid=([^;]+)/);
  if (!match?.[1]) return null;
  const value = decodeURIComponent(match[1]).trim().slice(0, 64);
  return /^[\d.a-zA-Z_-]+$/.test(value) ? value : null;
}

export function getMetrikaClientIdFromSearchParams(
  searchParams: URLSearchParams
): string | null {
  for (const key of ["_ym_uid", "ym_uid", "mc_client_id"]) {
    const raw = searchParams.get(key);
    const normalized = normalizeMetrikaClientId(raw);
    if (normalized) return normalized;
  }
  return null;
}

export function resolveMetrikaClientId(
  searchParams: URLSearchParams
): string | null {
  return (
    getMetrikaClientIdFromSearchParams(searchParams) ??
    getMetrikaClientIdFromCookie()
  );
}
