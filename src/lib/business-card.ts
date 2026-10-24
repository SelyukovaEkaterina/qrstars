/**
 * QR-визитка: общие типы, нормализация полей и ссылки для кнопок.
 * Без `@/`-алиасов и Prisma — модуль используют и сервер, и клиент, и юнит-тесты.
 */
import { escapeVcard } from "./qr-engine/payload";

export type CardSocialLink = {
  type: string;
  url: string;
};

export type CardService = {
  name: string;
  price: string;
};

export interface PublicBusinessCard {
  id: string;
  fullName: string;
  title: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  about: string | null;
  avatarUrl: string | null;
  socialLinks: CardSocialLink[];
  accentColor: string;
  tipsUrl?: string | null;
  tipsLabel?: string | null;
  whatsapp?: string | null;
  telegram?: string | null;
  maxUrl?: string | null;
  services?: CardService[];
  serviceArea?: string | null;
  workHours?: string | null;
  reviewsUrl?: string | null;
}

/** Строка `BusinessCard` из БД (или кэша скана) — только поля, нужные гостю. */
export interface BusinessCardRow {
  id: string;
  fullName: string;
  title: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  about: string | null;
  avatarUrl: string | null;
  socialLinks: unknown;
  accentColor: string;
  tipsUrl?: string | null;
  tipsLabel?: string | null;
  whatsapp?: string | null;
  telegram?: string | null;
  maxUrl?: string | null;
  services?: unknown;
  serviceArea?: string | null;
  workHours?: string | null;
  reviewsUrl?: string | null;
}

export const MAX_CARD_SERVICES = 30;
const SERVICE_NAME_MAX = 120;
const SERVICE_PRICE_MAX = 40;

/** Профессии-подсказки для мастера в мастере регистрации и редакторе. */
export const MASTER_PROFESSION_SUGGESTIONS = [
  "Электрик",
  "Сантехник",
  "Мастер на час",
  "Ремонт квартир",
  "Плиточник",
  "Ремонт бытовой техники",
  "Сборка мебели",
  "Отделочник",
];

function cleanString(value: unknown, max = 500): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function normalizeCardServices(raw: unknown): CardService[] {
  if (!Array.isArray(raw)) return [];
  const result: CardService[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const name = cleanString(rec.name, SERVICE_NAME_MAX);
    if (!name) continue;
    result.push({ name, price: cleanString(rec.price, SERVICE_PRICE_MAX) ?? "" });
    if (result.length >= MAX_CARD_SERVICES) break;
  }
  return result;
}

/** Соцсети для показа: `{ type, url }`; старые записи хранили тип в `platform`. */
export function parseCardSocialLinks(raw: unknown): CardSocialLink[] {
  if (!Array.isArray(raw)) return [];
  const result: CardSocialLink[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const type = typeof rec.type === "string" ? rec.type : rec.platform;
    if (typeof type === "string" && typeof rec.url === "string") {
      result.push({ type, url: rec.url });
    }
  }
  return result;
}

/** Соцсети из тела запроса: объекты со строковым `url`, не больше 20, без лишней вложенности. */
export function sanitizeSocialLinksInput(raw: unknown): Array<Record<string, string>> {
  if (!Array.isArray(raw)) return [];
  const result: Array<Record<string, string>> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry: Record<string, string> = {};
    for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
      if (typeof value === "string") entry[key] = value.slice(0, 2000);
    }
    if (typeof entry.url === "string") result.push(entry);
    if (result.length >= 20) break;
  }
  return result;
}

/** Данные для страницы гостя: ссылки уже проверены, не-http значения в браузер не уходят. */
export function toPublicBusinessCard(bc: BusinessCardRow): PublicBusinessCard {
  return {
    id: bc.id,
    fullName: bc.fullName,
    title: bc.title,
    company: bc.company,
    phone: bc.phone,
    email: bc.email,
    website: safeHttpUrl(bc.website),
    address: bc.address,
    about: bc.about,
    avatarUrl: bc.avatarUrl,
    socialLinks: parseCardSocialLinks(bc.socialLinks).flatMap((l) => {
      if (l.type === "whatsapp") {
        const href = whatsappHref(l.url);
        return href ? [{ type: l.type, url: href }] : [];
      }
      if (l.type === "telegram") {
        const href = telegramHref(l.url);
        return href ? [{ type: l.type, url: href }] : [];
      }
      const href = safeHttpUrl(l.url);
      return href ? [{ type: l.type, url: href }] : [];
    }),
    accentColor: bc.accentColor,
    tipsUrl: safeHttpUrl(bc.tipsUrl),
    tipsLabel: bc.tipsLabel ?? null,
    whatsapp: bc.whatsapp ?? null,
    telegram: bc.telegram ?? null,
    maxUrl: maxHref(bc.maxUrl),
    services: normalizeCardServices(bc.services),
    serviceArea: bc.serviceArea ?? null,
    workHours: bc.workHours ?? null,
    reviewsUrl: safeHttpUrl(bc.reviewsUrl),
  };
}

/** Только http(s): ссылки из визитки уходят в `href`, `javascript:` и прочее отбрасываем. */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const withProto = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProto);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Цифры номера в международном формате: `8 999…` → `7999…`, `9991234567` → `79991234567`. */
export function phoneDigits(raw: string | null | undefined): string {
  let digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("9")) digits = `7${digits}`;
  return digits;
}

export function telHref(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const digits = phoneDigits(value);
  if (digits.length < 5) return null;
  return `tel:${value.trim().startsWith("+") || digits.length === 11 ? "+" : ""}${digits}`;
}

/** WhatsApp: ссылка `wa.me/…` как есть, иначе номер → `https://wa.me/79991234567`. */
export function whatsappHref(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || /^(wa\.me|api\.whatsapp\.com)\//i.test(value)) {
    return safeHttpUrl(value);
  }
  const digits = phoneDigits(value);
  return digits.length >= 10 ? `https://wa.me/${digits}` : null;
}

/** Telegram: ссылка как есть, `@username`/`username` → `t.me/username`, номер → `t.me/+7999…`. */
export function telegramHref(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || /^t(elegram)?\.me\//i.test(value)) return safeHttpUrl(value);
  const username = value.replace(/^@/, "");
  if (/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(username)) return `https://t.me/${username}`;
  const digits = phoneDigits(value);
  return digits.length >= 10 ? `https://t.me/+${digits}` : null;
}

/** MAX не открывает чат по номеру — нужна ссылка на профиль или канал. */
export function maxHref(raw: string | null | undefined): string | null {
  return safeHttpUrl(raw);
}

export function yandexMapsSearchHref(address: string): string {
  return `https://yandex.ru/maps/?text=${encodeURIComponent(address)}`;
}

export type CardMessengerKind = "whatsapp" | "telegram" | "max";

const MESSENGER_SOCIAL_TYPES: CardMessengerKind[] = ["whatsapp", "telegram", "max"];

/**
 * Кнопки мессенджеров: отдельные поля визитки, иначе одноимённые соцсети
 * (старые визитки хранили WhatsApp и Telegram в `socialLinks`).
 */
export function cardMessengerButtons(
  card: Pick<PublicBusinessCard, "whatsapp" | "telegram" | "maxUrl" | "socialLinks">,
): Array<{ kind: CardMessengerKind; href: string }> {
  const fromField: Record<CardMessengerKind, string | null> = {
    whatsapp: whatsappHref(card.whatsapp),
    telegram: telegramHref(card.telegram),
    max: maxHref(card.maxUrl),
  };
  const buttons: Array<{ kind: CardMessengerKind; href: string }> = [];
  for (const kind of MESSENGER_SOCIAL_TYPES) {
    const social = card.socialLinks.find((l) => l.type === kind);
    const href =
      fromField[kind] ??
      (social
        ? kind === "whatsapp"
          ? whatsappHref(social.url)
          : kind === "telegram"
            ? telegramHref(social.url)
            : maxHref(social.url)
        : null);
    if (href) buttons.push({ kind, href });
  }
  return buttons;
}

/** Соцсети-«чипсы» без мессенджеров, которые уже показаны крупными кнопками. */
export function cardChipLinks(card: Pick<PublicBusinessCard, "socialLinks">): CardSocialLink[] {
  return card.socialLinks
    .filter((l) => !MESSENGER_SOCIAL_TYPES.includes(l.type as CardMessengerKind))
    .map((l) => ({ type: l.type, url: safeHttpUrl(l.url) ?? "" }))
    .filter((l) => l.url);
}

export function buildBusinessCardVCard(
  card: PublicBusinessCard,
  opts: { cardUrl?: string } = {},
): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  lines.push(`FN:${escapeVcard(card.fullName)}`);
  lines.push(`N:${escapeVcard(card.fullName)};;;;`);
  if (card.company) lines.push(`ORG:${escapeVcard(card.company)}`);
  if (card.title) lines.push(`TITLE:${escapeVcard(card.title)}`);
  const tel = telHref(card.phone);
  if (tel) lines.push(`TEL;TYPE=CELL:${tel.slice("tel:".length)}`);
  if (card.email) lines.push(`EMAIL:${escapeVcard(card.email)}`);
  const website = safeHttpUrl(card.website);
  if (website) lines.push(`URL:${escapeVcard(website)}`);
  if (opts.cardUrl) lines.push(`URL;TYPE=QR:${escapeVcard(opts.cardUrl)}`);
  if (card.address) lines.push(`ADR;TYPE=WORK:;;${escapeVcard(card.address)};;;;`);
  const note = [card.title, card.serviceArea && `Район: ${card.serviceArea}`, card.about]
    .filter(Boolean)
    .join("\n");
  if (note) lines.push(`NOTE:${escapeVcard(note)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

/** Поля визитки, которые сохраняются из тела `POST/PUT /api/business-cards`. */
export const CARD_TEXT_FIELDS = [
  "title",
  "company",
  "phone",
  "email",
  "website",
  "address",
  "about",
  "avatarUrl",
  "tipsUrl",
  "tipsLabel",
  "whatsapp",
  "telegram",
  "maxUrl",
  "serviceArea",
  "workHours",
  "reviewsUrl",
] as const;

type CardTextField = (typeof CARD_TEXT_FIELDS)[number];

const FIELD_MAX: Partial<Record<CardTextField, number>> = {
  about: 2000,
  avatarUrl: 2000,
  tipsUrl: 2000,
  maxUrl: 2000,
  reviewsUrl: 2000,
  website: 2000,
};

/**
 * Текстовые поля из тела запроса. `undefined` — поле не трогаем (PUT),
 * пустая строка — очищаем.
 */
export function cardTextFieldsFromBody(
  body: Record<string, unknown>,
): Partial<Record<CardTextField, string | null>> {
  const data: Partial<Record<CardTextField, string | null>> = {};
  for (const field of CARD_TEXT_FIELDS) {
    if (body[field] === undefined) continue;
    data[field] = cleanString(body[field], FIELD_MAX[field] ?? 300);
  }
  return data;
}
