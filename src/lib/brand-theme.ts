import type { CSSProperties } from "react";

export type PageAppearance = "light" | "dark";

export interface BrandColorPreset {
  hex: string;
  label: string;
}

/** Пресеты цвета бренда (6 основных + можно свой HEX). */
export const BRAND_COLOR_PRESETS: BrandColorPreset[] = [
  { hex: "#4f46e5", label: "Индиго" },
  { hex: "#0369a1", label: "Океан" },
  { hex: "#ea580c", label: "Закат" },
  { hex: "#059669", label: "Изумруд" },
  { hex: "#e11d48", label: "Роза" },
  { hex: "#7c3aed", label: "Фиолетовый" },
  { hex: "#db2777", label: "Пурпур" },
];

export const DEFAULT_BRAND_COLOR = BRAND_COLOR_PRESETS[0].hex;
export const DEFAULT_PAGE_APPEARANCE: PageAppearance = "light";
export const DEFAULT_LANDING_SUBTITLE = "Выберите, что вам нужно";

const LEGACY_THEME_MAP: Record<
  string,
  { brandColor: string; pageAppearance: PageAppearance }
> = {
  default: { brandColor: "#4f46e5", pageAppearance: "light" },
  ocean: { brandColor: "#0369a1", pageAppearance: "light" },
  sunset: { brandColor: "#ea580c", pageAppearance: "light" },
  emerald: { brandColor: "#059669", pageAppearance: "light" },
  rose: { brandColor: "#e11d48", pageAppearance: "light" },
  dark: { brandColor: "#818cf8", pageAppearance: "dark" },
};

export interface BrandTheme {
  accentHex: string;
  dark: boolean;
  cssVars: CSSProperties;
  pageBackgroundStyle: CSSProperties;
  embeddedBackgroundStyle: CSSProperties;
  iconBg: string;
  iconText: string;
  hoverBorder: string;
  backText: string;
  demoBadgeBg: string;
  demoBadgeText: string;
  starFocusRing: string;
  activePillBg: string;
  activePillText: string;
  priceBg: string;
  priceText: string;
  sectionBar: string;
  cardBg: string;
  cardBorder: string;
  inputBorder: string;
  headerGradientStyle: CSSProperties;
  downloadBtnStyle: CSSProperties;
  downloadBtnShadow: string;
  infoBoxBg: string;
  infoBoxBorder: string;
  infoBoxTitle: string;
  infoBoxText: string;
  linkAccentStyle: CSSProperties;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function normalizeBrandColor(input: string | null | undefined): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  const short = /^#([0-9a-fA-F]{3})$/;
  const full = /^#([0-9a-fA-F]{6})$/;
  if (short.test(trimmed)) {
    const m = trimmed.slice(1);
    return `#${m[0]}${m[0]}${m[1]}${m[1]}${m[2]}${m[2]}`.toLowerCase();
  }
  if (full.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => clamp(c).toString(16).padStart(2, "0")).join("")}`;
}

function mixHex(a: string, b: string, weight: number): string {
  const ar = hexToRgb(a);
  const br = hexToRgb(b);
  const w = Math.max(0, Math.min(1, weight));
  return rgbToHex(
    ar.r + (br.r - ar.r) * w,
    ar.g + (br.g - ar.g) * w,
    ar.b + (br.b - ar.b) * w
  );
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

export function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Слегка затемняет слишком светлые цвета для читаемости на белом. */
export function ensureReadableBrandColor(hex: string): string {
  const normalized = normalizeBrandColor(hex) ?? DEFAULT_BRAND_COLOR;
  if (contrastRatio(normalized, "#ffffff") < 3) {
    return mixHex(normalized, "#1e293b", 0.35);
  }
  return normalized;
}

export function parsePageAppearance(
  value: string | null | undefined
): PageAppearance {
  return value === "dark" ? "dark" : "light";
}

export function resolveBrandSettings(establishment: {
  brandColor?: string | null;
  pageAppearance?: string | null;
  landingTheme?: string | null;
}): { brandColor: string; pageAppearance: PageAppearance } {
  const fromDbColor = normalizeBrandColor(establishment.brandColor);
  if (fromDbColor) {
    return {
      brandColor: ensureReadableBrandColor(fromDbColor),
      pageAppearance: parsePageAppearance(establishment.pageAppearance),
    };
  }
  const legacy = establishment.landingTheme;
  if (legacy && legacy in LEGACY_THEME_MAP) {
    const mapped = LEGACY_THEME_MAP[legacy];
    return {
      brandColor: mapped.brandColor,
      pageAppearance: mapped.pageAppearance,
    };
  }
  return {
    brandColor: DEFAULT_BRAND_COLOR,
    pageAppearance: DEFAULT_PAGE_APPEARANCE,
  };
}

export function resolveLandingSubtitle(subtitle: string | null | undefined): string {
  const trimmed = subtitle?.trim();
  return trimmed ? trimmed : DEFAULT_LANDING_SUBTITLE;
}

function buildCssVars(brandColor: string, dark: boolean): CSSProperties {
  const brand50 = mixHex(brandColor, "#ffffff", 0.92);
  const brand100 = mixHex(brandColor, "#ffffff", 0.85);
  const brand300 = mixHex(brandColor, "#ffffff", 0.55);
  const brand500 = brandColor;
  const brand600 = mixHex(brandColor, "#000000", 0.15);
  const brand700 = mixHex(brandColor, "#000000", 0.28);
  const brand800 = mixHex(brandColor, "#000000", 0.4);

  const { r: bR, g: bG, b: bB } = hexToRgb(brandColor);

  if (dark) {
    const surface = mixHex(brandColor, "#1e293b", 0.42);
    const surfaceElevated = mixHex(brandColor, "#0f172a", 0.08);
    const border = mixHex(brandColor, "#334155", 0.35);
    const rowBg = mixHex(brandColor, "#334155", 0.25);
    const iconBg = mixHex(brandColor, "#334155", 0.4);
    const infoBg = mixHex(brandColor, "#312e81", 0.35);

    return {
      ["--brand" as string]: brandColor,
      ["--brand-50" as string]: brand50,
      ["--brand-100" as string]: brand100,
      ["--brand-300" as string]: brand300,
      ["--brand-500" as string]: brand500,
      ["--brand-600" as string]: brand600,
      ["--brand-700" as string]: brand700,
      ["--brand-800" as string]: brand800,
      ["--brand-surface" as string]: surface,
      ["--brand-module-bg" as string]: surface,
      ["--brand-module-border" as string]: border,
      ["--brand-row-bg" as string]: rowBg,
      ["--brand-border" as string]: border,
      ["--brand-header-bg" as string]: surfaceElevated,
      ["--brand-icon-bg" as string]: iconBg,
      ["--brand-icon-fg" as string]: brand300,
      ["--brand-heading" as string]: "#f8fafc",
      ["--brand-muted" as string]: "#94a3b8",
      ["--brand-submuted" as string]: "#8a97aa",
      ["--brand-info-bg" as string]: infoBg,
      ["--brand-info-border" as string]: mixHex(brandColor, "#4f46e5", 0.5),
      ["--brand-info-text" as string]: brand100,
      ["--page-bg" as string]: `linear-gradient(160deg, ${mixHex(brandColor, "#0f172a", 0.35)} 0%, #0f172a 45%, #1e293b 100%)`,
      ["--page-bg-embedded" as string]: mixHex(brandColor, "#0f172a", 0.25),
      ["--brand-cover-overlay" as string]: `linear-gradient(160deg, rgba(${bR},${bG},${bB},0.4) 0%, rgba(15,23,42,0.72) 100%)`,
      ["--brand-cover-module-bg" as string]: `rgba(${bR},${bG},${bB},0.18)`,
      ["--brand-cover-module-border" as string]: `rgba(${bR},${bG},${bB},0.32)`,
      ["--brand-cover-icon-bg" as string]: `rgba(${bR},${bG},${bB},0.4)`,
    };
  }

  return {
    ["--brand" as string]: brandColor,
    ["--brand-50" as string]: brand50,
    ["--brand-100" as string]: brand100,
    ["--brand-300" as string]: brand300,
    ["--brand-500" as string]: brand500,
    ["--brand-600" as string]: brand600,
    ["--brand-700" as string]: brand700,
    ["--brand-800" as string]: brand800,
    ["--brand-surface" as string]: "#ffffff",
    ["--brand-module-bg" as string]: "#ffffff",
    ["--brand-module-border" as string]: brand100,
    ["--brand-row-bg" as string]: brand50,
    ["--brand-border" as string]: brand100,
    ["--brand-header-bg" as string]: "rgba(255,255,255,0.92)",
    ["--brand-icon-bg" as string]: brand100,
    ["--brand-icon-fg" as string]: brand600,
    ["--brand-heading" as string]: "#111827",
    ["--brand-muted" as string]: brand700,
    ["--brand-submuted" as string]: "#6b7280",
    ["--brand-info-bg" as string]: brand50,
    ["--brand-info-border" as string]: brand100,
    ["--brand-info-text" as string]: brand800,
    ["--page-bg" as string]: `linear-gradient(160deg, ${brand100} 0%, ${brand50} 40%, #ffffff 100%)`,
      ["--page-bg-embedded" as string]: brand50,
      ["--brand-cover-overlay" as string]: `linear-gradient(160deg, rgba(${bR},${bG},${bB},0.3) 0%, rgba(15,23,42,0.58) 100%)`,
      ["--brand-cover-module-bg" as string]: `rgba(${bR},${bG},${bB},0.15)`,
      ["--brand-cover-module-border" as string]: `rgba(${bR},${bG},${bB},0.28)`,
      ["--brand-cover-icon-bg" as string]: `rgba(${bR},${bG},${bB},0.35)`,
    };
  }

export function buildBrandTheme(
  brandColor: string,
  pageAppearance: PageAppearance
): BrandTheme {
  const accentHex = ensureReadableBrandColor(brandColor);
  const dark = pageAppearance === "dark";
  const cssVars = buildCssVars(accentHex, dark);

  if (dark) {
    return {
      accentHex,
      dark: true,
      cssVars,
      pageBackgroundStyle: {
        background: "var(--page-bg)",
      },
      embeddedBackgroundStyle: { backgroundColor: "var(--page-bg-embedded)" },
      iconBg: "bg-slate-700",
      iconText: "text-[var(--brand-300)]",
      hoverBorder: "hover:border-slate-500",
      backText: "text-[var(--brand-300)] hover:opacity-80",
      demoBadgeBg: "bg-slate-700",
      demoBadgeText: "text-[var(--brand-300)]",
      starFocusRing: "focus:ring-[var(--brand-300)]",
      activePillBg: "bg-[var(--brand-600)]",
      activePillText: "text-white",
      priceBg: "bg-slate-700",
      priceText: "text-[var(--brand-300)]",
      sectionBar: "bg-[var(--brand-500)]",
      cardBg: "bg-slate-800",
      cardBorder: "border-slate-700",
      inputBorder:
        "border-slate-600 focus:ring-[var(--brand-300)] focus:border-[var(--brand-300)]",
      headerGradientStyle: {
        background: `linear-gradient(to right, var(--brand-600), var(--brand-800))`,
      },
      downloadBtnStyle: {
        backgroundColor: "var(--brand-600)",
      },
      downloadBtnShadow: "shadow-indigo-900/50",
      infoBoxBg: "bg-slate-800",
      infoBoxBorder: "border-slate-700",
      infoBoxTitle: "text-[var(--brand-300)]",
      infoBoxText: "text-slate-400",
      linkAccentStyle: { color: "var(--brand-300)" },
    };
  }

  return {
    accentHex,
    dark: false,
    cssVars,
    pageBackgroundStyle: {
      background: "var(--page-bg)",
    },
    embeddedBackgroundStyle: {
      backgroundColor: "var(--page-bg-embedded)",
    },
    iconBg: "bg-[var(--brand-100)]",
    iconText: "text-[var(--brand-600)]",
    hoverBorder: "hover:border-[var(--brand-300)]",
    backText: "text-[var(--brand-600)] hover:text-[var(--brand-800)]",
    demoBadgeBg: "bg-[var(--brand-50)]",
    demoBadgeText: "text-[var(--brand-600)]",
    starFocusRing: "focus:ring-[var(--brand-500)]",
    activePillBg: "bg-[var(--brand-600)]",
    activePillText: "text-white",
    priceBg: "bg-[var(--brand-50)]",
    priceText: "text-[var(--brand-600)]",
    sectionBar: "bg-[var(--brand-500)]",
    cardBg: "bg-white",
    cardBorder: "border-gray-100",
    inputBorder:
      "border-gray-200 focus:ring-[var(--brand-500)] focus:border-[var(--brand-500)]",
    headerGradientStyle: {
      background: `linear-gradient(to right, var(--brand-500), var(--brand-700))`,
    },
    downloadBtnStyle: {
      backgroundColor: "var(--brand-600)",
    },
    downloadBtnShadow: "shadow-md",
    infoBoxBg: "bg-[var(--brand-50)]",
    infoBoxBorder: "border-[var(--brand-100)]",
    infoBoxTitle: "text-gray-900",
    infoBoxText: "text-gray-700",
    linkAccentStyle: { color: "var(--brand-600)" },
  };
}

export function getBrandTheme(
  brandColor?: string | null,
  pageAppearance?: string | null
): BrandTheme {
  const color = ensureReadableBrandColor(
    normalizeBrandColor(brandColor) ?? DEFAULT_BRAND_COLOR
  );
  return buildBrandTheme(color, parsePageAppearance(pageAppearance));
}

/** @deprecated Используйте brandColor + pageAppearance */
export function getBrandThemeFromLegacy(landingTheme?: string | null): BrandTheme {
  const settings = resolveBrandSettings({ landingTheme });
  return buildBrandTheme(settings.brandColor, settings.pageAppearance);
}

export function isPresetBrandColor(hex: string): boolean {
  const n = normalizeBrandColor(hex);
  return !!n && BRAND_COLOR_PRESETS.some((p) => p.hex === n);
}
