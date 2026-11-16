/**
 * Шаблоны сайта для компьютера.
 *
 * Микросайт на экране ≥1024 px показывается как полноценный сайт: те же данные
 * проекта (обложка, логотип, цвет, меню, визитка, часы, разделы), разная подача.
 * Выбранный шаблон хранится в `Establishment.siteTemplate`; пусто — шаблон по отрасли.
 *
 * id хранятся в БД — не переименовывать, новые добавлять в конец.
 * Без `@/`-алиасов: модуль используют сервер, клиент и юнит-тесты.
 */

export const SITE_TEMPLATE_IDS = ["showcase", "classic", "editorial", "bold"] as const;

export type SiteTemplateId = (typeof SITE_TEMPLATE_IDS)[number];

export interface SiteTemplateInfo {
  id: SiteTemplateId;
  name: string;
  description: string;
  /** Для каких бизнесов подходит — подпись в выборе шаблона. */
  bestFor: string;
}

export const SITE_TEMPLATES: SiteTemplateInfo[] = [
  {
    id: "showcase",
    name: "Витрина",
    description: "Фото на весь первый экран, крупное название, меню карточками с фото",
    bestFor: "кафе, рестораны, отели",
  },
  {
    id: "classic",
    name: "Классика",
    description: "Спокойный деловой сайт: текст и фото рядом, аккуратные блоки",
    bestFor: "клиники, автосервисы, услуги",
  },
  {
    id: "editorial",
    name: "Журнал",
    description: "Шрифт с засечками, много воздуха, меню и цены строками",
    bestFor: "салоны красоты, бары, мастерские",
  },
  {
    id: "bold",
    name: "Контраст",
    description: "Тёмный фон, крупный яркий шрифт, акцент на цвете бренда",
    bestFor: "барбершопы, фитнес, автотюнинг",
  },
];

export const DEFAULT_SITE_TEMPLATE: SiteTemplateId = "classic";

export function isSiteTemplateId(value: unknown): value is SiteTemplateId {
  return typeof value === "string" && (SITE_TEMPLATE_IDS as readonly string[]).includes(value);
}

/** Шаблон по отрасли проекта — если владелец ещё не выбирал. */
export function defaultSiteTemplateForIndustry(industry: string | null | undefined): SiteTemplateId {
  switch (industry) {
    case "HORECA":
    case "HOTEL":
      return "showcase";
    case "BEAUTY":
      return "editorial";
    case "CLINIC":
    case "AUTO":
    case "SERVICES":
      return "classic";
    default:
      return DEFAULT_SITE_TEMPLATE;
  }
}

/** Итоговый шаблон: сохранённый, иначе по отрасли. Неизвестный id (старый/битый) — по отрасли. */
export function resolveSiteTemplate(
  saved: string | null | undefined,
  industry: string | null | undefined
): SiteTemplateId {
  return isSiteTemplateId(saved) ? saved : defaultSiteTemplateForIndustry(industry);
}

/** Значение для PUT: `null`/"" — сброс к шаблону по отрасли, неизвестный id — ошибка (undefined). */
export function parseSiteTemplateInput(value: unknown): SiteTemplateId | null | undefined {
  if (value === null || value === "") return null;
  return isSiteTemplateId(value) ? value : undefined;
}

export function siteTemplateInfo(id: SiteTemplateId): SiteTemplateInfo {
  return SITE_TEMPLATES.find((t) => t.id === id) ?? SITE_TEMPLATES[0];
}

/** На FREE сайт-визитка — один шаблон; остальные шаблоны и выбор — на PRO. */
export const FREE_CARD_SITE_TEMPLATE: SiteTemplateId = "classic";

/** Шаблон сайта-визитки: FREE — всегда «Классика», PRO — сохранённый или по отрасли (мастера → «Классика»). */
export function resolveCardSiteTemplate(
  saved: string | null | undefined,
  industry: string | null | undefined,
  hasPaidFeatures: boolean
): SiteTemplateId {
  if (!hasPaidFeatures) return FREE_CARD_SITE_TEMPLATE;
  return resolveSiteTemplate(saved, industry ?? "SERVICES");
}
