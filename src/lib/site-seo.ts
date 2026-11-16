/**
 * Разметка schema.org (JSON-LD) для сайта проекта и сайта-визитки:
 * Яндекс и Google понимают адрес, телефон, часы работы и услуги.
 * Без `@/`-алиасов (юнит-тесты).
 */
import { parseWorkingHours, WEEK_DAYS, type WeekDay } from "./working-hours";

type JsonLd = Record<string, unknown>;

const SCHEMA_DAYS: Record<WeekDay, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

function clean<T extends JsonLd>(obj: T): T {
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) delete obj[key];
  }
  return obj;
}

export function openingHoursSpecification(raw: unknown): JsonLd[] {
  const hours = parseWorkingHours(raw);
  if (!hours) return [];
  return WEEK_DAYS.flatMap((d) => {
    const h = hours[d];
    if (!h) return [];
    return [{ "@type": "OpeningHoursSpecification", dayOfWeek: SCHEMA_DAYS[d], opens: h.open, closes: h.close }];
  });
}

export function micrositeJsonLd(input: {
  name: string;
  url: string;
  description?: string | null;
  image?: string | null;
  address?: string | null;
  telephone?: string | null;
  workingHours?: unknown;
  sameAs?: (string | null | undefined)[];
}): JsonLd {
  return clean({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: input.name,
    url: input.url,
    description: input.description?.trim() || null,
    image: input.image || null,
    telephone: input.telephone?.trim() || null,
    address: input.address?.trim() ? { "@type": "PostalAddress", streetAddress: input.address.trim() } : null,
    openingHoursSpecification: openingHoursSpecification(input.workingHours),
    sameAs: (input.sameAs ?? []).filter((u): u is string => !!u && /^https?:\/\//i.test(u)),
  });
}

export function businessCardJsonLd(input: {
  fullName: string;
  url: string;
  title?: string | null;
  about?: string | null;
  image?: string | null;
  telephone?: string | null;
  email?: string | null;
  address?: string | null;
  serviceArea?: string | null;
  services?: { name: string; price?: string | null }[];
  sameAs?: (string | null | undefined)[];
}): JsonLd {
  const description = [input.title, input.about].filter((s) => s?.trim()).join(". ");
  return clean({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: input.title ? `${input.fullName} — ${input.title}` : input.fullName,
    url: input.url,
    description: description || null,
    image: input.image || null,
    telephone: input.telephone?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() ? { "@type": "PostalAddress", streetAddress: input.address.trim() } : null,
    areaServed: input.serviceArea?.trim() || null,
    founder: { "@type": "Person", name: input.fullName, jobTitle: input.title || undefined },
    makesOffer: (input.services ?? [])
      .filter((s) => s.name?.trim())
      .slice(0, 30)
      .map((s) =>
        clean({
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: s.name.trim() },
          description: s.price?.trim() || null,
        })
      ),
    sameAs: (input.sameAs ?? []).filter((u): u is string => !!u && /^https?:\/\//i.test(u)),
  });
}

/** Строка для `<script type="application/ld+json">`: `<` экранируем, чтобы текст владельца не закрыл тег. */
export function jsonLdString(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
