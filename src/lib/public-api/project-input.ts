import { parseEstablishmentIndustry } from "@/lib/establishment-industry";
import { normalizeYandexMapsUrl, yandexMapsUrlError } from "@/lib/yandex-maps-url";
import { normalizeTwoGisUrl, twoGisUrlError } from "@/lib/two-gis-url";
import { parseHttpUrl } from "@/lib/utils";

export interface ProjectInput {
  name?: string;
  industry?: string | null;
  address?: string | null;
  phone?: string | null;
  yandexMapsUrl?: string | null;
  twoGisUrl?: string | null;
  avitoUrl?: string | null;
}

function optionalString(value: unknown, max: number): string | null | undefined | false {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length > max) return false;
  return trimmed || null;
}

/** Проверка полей проекта для API v1. `requireName` — для создания. */
export function parseProjectInput(
  body: Record<string, unknown>,
  { requireName }: { requireName: boolean }
): { ok: true; data: ProjectInput } | { ok: false; message: string } {
  const data: ProjectInput = {};

  const name = optionalString(body.name, 120);
  if (name === false) return { ok: false, message: "name — строка до 120 символов" };
  if (name) data.name = name;
  else if (requireName || name === null) return { ok: false, message: "name обязателен" };

  if (body.industry !== undefined) {
    if (body.industry === null) data.industry = null;
    else {
      const industry = parseEstablishmentIndustry(body.industry);
      if (!industry) {
        return {
          ok: false,
          message: "industry: HORECA, BEAUTY, AUTO, CLINIC, HOTEL, SERVICES или OTHER",
        };
      }
      data.industry = industry;
    }
  }

  for (const [field, max] of [["address", 300], ["phone", 40]] as const) {
    const value = optionalString(body[field], max);
    if (value === false) return { ok: false, message: `${field} — строка до ${max} символов` };
    if (value !== undefined) data[field] = value;
  }

  const yandex = optionalString(body.yandexMapsUrl, 2000);
  if (yandex === false) return { ok: false, message: "yandexMapsUrl — строка" };
  if (yandex) {
    const problem = yandexMapsUrlError(yandex);
    if (problem) return { ok: false, message: problem };
    data.yandexMapsUrl = normalizeYandexMapsUrl(yandex);
  } else if (yandex === null) data.yandexMapsUrl = null;

  const twoGis = optionalString(body.twoGisUrl, 2000);
  if (twoGis === false) return { ok: false, message: "twoGisUrl — строка" };
  if (twoGis) {
    const problem = twoGisUrlError(twoGis);
    if (problem) return { ok: false, message: problem };
    data.twoGisUrl = normalizeTwoGisUrl(twoGis);
  } else if (twoGis === null) data.twoGisUrl = null;

  const avito = optionalString(body.avitoUrl, 2000);
  if (avito === false) return { ok: false, message: "avitoUrl — строка" };
  if (avito) {
    if (!parseHttpUrl(avito)) return { ok: false, message: "avitoUrl — ссылка http(s)" };
    data.avitoUrl = avito;
  } else if (avito === null) data.avitoUrl = null;

  return { ok: true, data };
}
