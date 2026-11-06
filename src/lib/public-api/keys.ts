import { createHash, randomBytes } from "node:crypto";

/** Ключ открытого API: `qrs_` + 40 символов base62. В БД — только SHA-256. */
export const API_KEY_PREFIX = "qrs_";
export const MAX_ACTIVE_API_KEYS = 10;
const KEY_BODY_LENGTH = 40;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function generateApiKey(): string {
  // 256 делится на 62 с остатком — отбрасываем байты ≥ 248, чтобы не было перекоса.
  let body = "";
  while (body.length < KEY_BODY_LENGTH) {
    for (const byte of randomBytes(64)) {
      if (byte >= 248) continue;
      body += ALPHABET[byte % 62];
      if (body.length === KEY_BODY_LENGTH) break;
    }
  }
  return API_KEY_PREFIX + body;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Видимое начало ключа для списка в кабинете. */
export function apiKeyDisplayPrefix(key: string): string {
  return key.slice(0, API_KEY_PREFIX.length + 6);
}

export function looksLikeApiKey(value: string): boolean {
  return (
    value.startsWith(API_KEY_PREFIX) &&
    value.length === API_KEY_PREFIX.length + KEY_BODY_LENGTH &&
    /^[A-Za-z0-9]+$/.test(value.slice(API_KEY_PREFIX.length))
  );
}

export function normalizeApiKeyName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name || name.length > 60) return null;
  return name;
}
