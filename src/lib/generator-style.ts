import { z } from "zod";
import { normalizeQRTemplateConfig, type QRTemplateConfig } from "@/lib/qr-code-templates";
import { GENERATOR_STYLE_SOURCE } from "@/lib/generator-style-keys";

/**
 * Перенос дизайна из бесплатного генератора на лендинге (`qrstars.ru/free-qr-generator.html`)
 * в «Шаблоны оформления» кабинета. Лендинг кладёт стиль в `?qr_style=` ссылки регистрации
 * (base64url от JSON), кабинет создаёт из него шаблон, а мастер `/dashboard/start`
 * применяет его к первому QR.
 */

export {
  GENERATOR_STYLE_PARAM,
  GENERATOR_STYLE_SOURCE,
  GENERATOR_STYLE_STORAGE_KEY,
} from "@/lib/generator-style-keys";
export const GENERATOR_STYLE_TEMPLATE_NAME = "Мой стиль из генератора";

/** Ограничение длины параметра, чтобы не раздувать запросы и localStorage. */
const MAX_ENCODED_LENGTH = 4000;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const generatorStyleSchema = z.object({
  v: z.literal(1),
  dotStyle: z.enum(["classic", "rounded"]),
  eyeStyle: z.enum(["square", "rounded", "circle", "leaf", "dot"]),
  fg: hex,
  bg: hex,
  bgTransparent: z.boolean(),
  gradient: z.boolean(),
  grad1: hex,
  grad2: hex,
  gradType: z.enum(["linear-tb", "linear-lr", "linear-diag", "radial"]),
  eyeCustom: z.boolean(),
  eyeColor: hex,
  /** Эмодзи-пресет логотипа (как `logoPreset` в кабинете). */
  logoPreset: z.string().max(16).nullable(),
  /** Только собственный логотип QrStars — внешние URL не принимаем. */
  logoSrc: z.literal("/logo.svg").nullable(),
  logoFill: z.boolean(),
  logoSize: z.number().int().min(10).max(30),
  frame: z.boolean(),
  frameText: z.string().max(32),
  frameStyle: z.enum(["bottom", "rounded", "ribbon"]),
  ecc: z.enum(["L", "M", "Q", "H"]),
  margin: z.number().int().min(0).max(6),
  scatter: z.boolean(),
  scatterDensity: z.number().int().min(1).max(10),
  scatterShape: z.enum([
    "square",
    "circle",
    "star",
    "diamond",
    "hexagon",
    "heart",
    "cross",
    "octagon",
    "triangle",
  ]),
  /** Текст в центре — необязательные поля: старые ссылки генератора их не содержат. */
  centerMode: z.enum(["image", "text"]).optional(),
  centerText: z
    .string()
    .max(80)
    .refine((t) => t.split("\n").length <= 3, "Не больше 3 строк")
    .optional(),
  centerTextFont: z.enum(["inter", "sans", "serif", "mono", "display"]).optional(),
  centerTextColor: hex.optional(),
  centerTextBold: z.boolean().optional(),
});

export type GeneratorStyle = z.infer<typeof generatorStyleSchema>;

function decodeBase64Url(value: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  try {
    if (typeof Buffer !== "undefined") return Buffer.from(padded, "base64").toString("utf8");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** Разбирает `?qr_style=` из лендинга. Любая ошибка формата → `null`. */
export function parseGeneratorStyle(encoded: string | null | undefined): GeneratorStyle | null {
  if (!encoded || encoded.length > MAX_ENCODED_LENGTH) return null;
  const json = decodeBase64Url(encoded);
  if (!json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const parsed = generatorStyleSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function generatorStyleToTemplateConfig(style: GeneratorStyle): QRTemplateConfig {
  const { v: _version, ...rest } = style;
  void _version;
  const textMode = rest.centerMode === "text" && !!rest.centerText?.trim();
  return normalizeQRTemplateConfig({
    ...rest,
    logoDataUrl: null,
    logoPreset: textMode ? null : rest.logoPreset,
    logoSrc: textMode ? null : rest.logoSrc,
    centerMode: textMode ? "text" : "image",
    centerText: textMode ? rest.centerText! : "",
    centerTextFont: rest.centerTextFont ?? "inter",
    centerTextColor: rest.centerTextColor ?? rest.fg,
    centerTextBold: rest.centerTextBold ?? true,
    frameText: rest.frameText.trim() || "СКАНИРУЙ МЕНЯ",
  });
}

/** Шаблон пришёл из генератора на лендинге (см. `layout.source`). */
export function isGeneratorStyleLayout(layout: unknown): boolean {
  return (
    typeof layout === "object" &&
    layout !== null &&
    (layout as { source?: unknown }).source === GENERATOR_STYLE_SOURCE
  );
}

/** Ключ для сравнения конфигов: jsonb в Postgres не сохраняет порядок ключей. */
export function templateConfigKey(config: unknown): string {
  if (!config || typeof config !== "object") return JSON.stringify(config ?? null);
  const obj = config as Record<string, unknown>;
  return JSON.stringify(Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]])));
}
