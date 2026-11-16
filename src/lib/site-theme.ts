/**
 * Палитра сайта для компьютера: шаблон + цвет бренда + светлая/тёмная тема.
 * Без `@/`-алиасов (юнит-тесты).
 */
import type { SiteTemplateId } from "./site-templates";

export interface SiteTokens {
  template: SiteTemplateId;
  dark: boolean;
  bg: string;
  surface: string;
  /** Фон чередующихся секций. */
  band: string;
  text: string;
  muted: string;
  border: string;
  /** Кнопки и плашки. */
  accent: string;
  accentHover: string;
  /** Текст на акценте. */
  onAccent: string;
  /** Акцент как цвет текста/ссылок на фоне страницы (контраст ≥ 4.5). */
  accentText: string;
  /** Мягкая подложка в цвет бренда. */
  accentSoft: string;
  headingFont: string;
  bodyFont: string;
  headingWeight: number;
  headingTransform: "none" | "uppercase";
  headingTracking: string;
  radius: string;
  radiusLg: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return [79, 70, 229];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b]
    .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function mix(a: string, b: string, weight: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  const w = Math.max(0, Math.min(1, weight));
  return rgbToHex([x[0] + (y[0] - x[0]) * w, x[1] + (y[1] - x[1]) * w, x[2] + (y[2] - x[2]) * w]);
}

function luminance(hex: string): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Сдвигает цвет к белому/чёрному, пока контраст с фоном не станет ≥ min. */
export function readableOn(color: string, bg: string, min = 4.5): string {
  if (contrast(color, bg) >= min) return color;
  const target = luminance(bg) < 0.4 ? "#ffffff" : "#000000";
  for (let w = 0.1; w <= 1; w += 0.1) {
    const c = mix(color, target, w);
    if (contrast(c, bg) >= min) return c;
  }
  return target;
}

const FONT_MANROPE = "var(--site-font-manrope), var(--font-inter), system-ui, sans-serif";
const FONT_INTER = "var(--font-inter), system-ui, sans-serif";
const FONT_PLAYFAIR = "var(--site-font-playfair), Georgia, 'Times New Roman', serif";
const FONT_UNBOUNDED = "var(--site-font-unbounded), var(--site-font-manrope), system-ui, sans-serif";

export function buildSiteTokens(
  template: SiteTemplateId,
  brandColor: string,
  appearance: "light" | "dark"
): SiteTokens {
  const brand = /^#[0-9a-f]{6}$/i.test(brandColor) ? brandColor.toLowerCase() : "#4f46e5";
  // «Контраст» всегда тёмный — в этом его смысл.
  const dark = template === "bold" ? true : appearance === "dark";

  let base: Pick<SiteTokens, "bg" | "surface" | "band" | "text" | "muted" | "border">;
  if (template === "editorial") {
    base = dark
      ? { bg: "#1c1917", surface: "#262220", band: "#221e1c", text: "#f5f0e8", muted: "#a8a29e", border: "#3a3430" }
      : { bg: "#faf7f2", surface: "#fffdf9", band: "#f3eee6", text: "#1c1917", muted: "#57534e", border: "#e7e0d6" };
  } else if (template === "bold") {
    base = {
      bg: "#09090b",
      surface: "#18181b",
      band: mix(brand, "#09090b", 0.86),
      text: "#fafafa",
      muted: "#a1a1aa",
      border: "#27272a",
    };
  } else if (template === "classic") {
    base = dark
      ? { bg: "#0b1120", surface: "#111a2e", band: mix(brand, "#0b1120", 0.9), text: "#f1f5f9", muted: "#94a3b8", border: "#1e293b" }
      : { bg: "#f8fafc", surface: "#ffffff", band: mix(brand, "#ffffff", 0.94), text: "#0f172a", muted: "#475569", border: "#e2e8f0" };
  } else {
    base = dark
      ? { bg: "#0a0a0f", surface: "#14141c", band: mix(brand, "#0a0a0f", 0.88), text: "#f8fafc", muted: "#a1a1aa", border: "#24242e" }
      : { bg: "#ffffff", surface: "#ffffff", band: mix(brand, "#ffffff", 0.95), text: "#111827", muted: "#4b5563", border: "#e5e7eb" };
  }

  // Акцент для кнопок: на тёмном фоне слишком тёмный бренд не виден — осветляем.
  const accent = dark && contrast(brand, base.bg) < 2.2 ? mix(brand, "#ffffff", 0.3) : brand;
  const onAccent = contrast(accent, "#ffffff") >= 3 ? "#ffffff" : "#111827";
  const accentText = readableOn(accent, base.bg, 4.5);
  const accentSoft = dark ? mix(accent, base.bg, 0.82) : mix(accent, "#ffffff", 0.9);
  const accentHover = dark ? mix(accent, "#ffffff", 0.12) : mix(accent, "#000000", 0.12);

  const typography: Pick<
    SiteTokens,
    "headingFont" | "bodyFont" | "headingWeight" | "headingTransform" | "headingTracking" | "radius" | "radiusLg"
  > =
    template === "editorial"
      ? { headingFont: FONT_PLAYFAIR, bodyFont: FONT_MANROPE, headingWeight: 500, headingTransform: "none", headingTracking: "-0.01em", radius: "4px", radiusLg: "6px" }
      : template === "bold"
        ? { headingFont: FONT_UNBOUNDED, bodyFont: FONT_MANROPE, headingWeight: 700, headingTransform: "uppercase", headingTracking: "-0.02em", radius: "14px", radiusLg: "28px" }
        : template === "classic"
          ? { headingFont: FONT_MANROPE, bodyFont: FONT_INTER, headingWeight: 700, headingTransform: "none", headingTracking: "-0.02em", radius: "12px", radiusLg: "20px" }
          : { headingFont: FONT_MANROPE, bodyFont: FONT_MANROPE, headingWeight: 800, headingTransform: "none", headingTracking: "-0.03em", radius: "999px", radiusLg: "24px" };

  return {
    template,
    dark,
    ...base,
    accent,
    accentHover,
    onAccent,
    accentText,
    accentSoft,
    ...typography,
  };
}
