"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, X, Download, FileText, RotateCcw } from "lucide-react";

/* ════════════════════════════════════════════════════════════════
   TYPES
════════════════════════════════════════════════════════════════ */
export type DotStyle =
  | "squares" | "rounded" | "dots" | "diamond"
  | "cross"   | "hex"     | "bars"  | "star";
export type EyeStyle =
  | "square" | "rounded" | "dot"
  | "circle" | "leaf"    | "corners";

export interface StickerConfig {
  url: string;
  headline: string;
  ctaText: string;
  labels: string[];
  formatId: string;
  /** @deprecated kept for backward compatibility, replaced by layoutId + paletteId */
  themeId?: string;
  layoutId?: LayoutId;
  paletteId?: PaletteId;
  brandColor?: string; // hex, used when paletteId === "custom"
  dotStyle: DotStyle;
  eyeStyle: EyeStyle;
  showWatermark: boolean;
  pdfCount: number;
}

export type LayoutId =
  | "standard" | "editorial" | "bauhaus" | "round"
  | "badge"    | "ticket"    | "stripe"  | "compact";
export type PaletteId =
  | "light" | "cream" | "dark"
  | "sunset" | "ocean" | "mint" | "rose"
  | "custom";

interface Format {
  id: string;
  name: string;
  sub: string;
  wMm: number;
  hMm: number;
  dpi: number;
  previewW: number;
  previewH: number;
}

type ThemeBg =
  | { type: "solid"; color: string }
  | { type: "gradient"; from: string; to: string; angle: number };

/* Layout — geometry, typography, label mode */
interface LayoutDef {
  id: LayoutId;
  name: string;
  kind: "standard" | "editorial" | "bauhaus" | "round"
      | "badge" | "ticket" | "stripe" | "compact";
  shape: "rect" | "circle";
  labelMode: "dots" | "pills" | "sides" | "bars";
  headlineCaps?: boolean;
  headlineItalic?: boolean;
  headlineFamily?: string;
}

/* Palette — colors only */
interface PaletteDef {
  id: PaletteId;
  name: string;
  bg: ThemeBg;
  text1: string;
  text2: string;
  text3: string;
  accentLine: string;
  qrDark: string;
  qrLight: string;
  cardBg?: string;
  borderColor?: string;
  pillBg?: string;
  thumbBg: string;
  thumbText: string;
}

/* Composed theme used by renderers (internal) */
interface Theme extends LayoutDef, Omit<PaletteDef, "id" | "name"> {}

/* ════════════════════════════════════════════════════════════════
   FORMATS
════════════════════════════════════════════════════════════════ */
export const FORMATS: Format[] = [
  { id: "5x5",     name: "5 × 5 см",     sub: "стикер",     wMm: 50,  hMm: 50,  dpi: 300, previewW: 320, previewH: 320 },
  { id: "7x7",     name: "7 × 7 см",     sub: "стикер",     wMm: 70,  hMm: 70,  dpi: 300, previewW: 360, previewH: 360 },
  { id: "8x8",     name: "8 × 8 см",     sub: "стикер",     wMm: 80,  hMm: 80,  dpi: 300, previewW: 380, previewH: 380 },
  { id: "a6p",     name: "A6 портрет",   sub: "105 × 148 мм", wMm: 105, hMm: 148, dpi: 150, previewW: 260, previewH: 368 },
  { id: "a6l",     name: "A6 лежачий",   sub: "148 × 105 мм (тент)", wMm: 148, hMm: 105, dpi: 150, previewW: 368, previewH: 260 },
];

/* ════════════════════════════════════════════════════════════════
   LAYOUTS & PALETTES
════════════════════════════════════════════════════════════════ */
const SERIF = "'Georgia', 'Times New Roman', serif";

const DOT_LABELS: Record<DotStyle, string> = {
  squares: "Квадраты", rounded: "Скруглён.", dots: "Точки", diamond: "Ромбы",
  cross: "Крестики",  hex: "Соты",         bars: "Бары",  star: "Звёзды",
};
const EYE_LABELS: Record<EyeStyle, string> = {
  square: "Квадрат", rounded: "Скруглён.", dot: "Точка",
  circle: "Круг",    leaf: "Лист",         corners: "Уголок",
};

export const LAYOUTS: LayoutDef[] = [
  {
    id: "standard", name: "Стандарт", kind: "standard", shape: "rect",
    labelMode: "dots", headlineCaps: true,
  },
  {
    id: "editorial", name: "Editorial", kind: "editorial", shape: "rect",
    labelMode: "bars", headlineFamily: SERIF,
  },
  {
    id: "bauhaus", name: "Bauhaus", kind: "bauhaus", shape: "rect",
    labelMode: "dots", headlineCaps: true,
  },
  {
    id: "round", name: "Круглый", kind: "round", shape: "circle",
    labelMode: "pills", headlineCaps: true,
  },
  {
    id: "badge", name: "Бейдж", kind: "badge", shape: "rect",
    labelMode: "pills", headlineCaps: true,
  },
  {
    id: "ticket", name: "Тикет", kind: "ticket", shape: "rect",
    labelMode: "dots", headlineCaps: true,
  },
  {
    id: "stripe", name: "Полоса", kind: "stripe", shape: "rect",
    labelMode: "pills", headlineCaps: true,
  },
  {
    id: "compact", name: "Компакт", kind: "compact", shape: "rect",
    labelMode: "dots", headlineCaps: true,
  },
];

export const PALETTES: PaletteDef[] = [
  {
    id: "light", name: "Светлая",
    bg: { type: "solid", color: "#ffffff" },
    text1: "#0F172A", text2: "#475569", text3: "#94A3B8",
    accentLine: "#0F172A",
    qrDark: "#0F172A", qrLight: "#ffffff",
    borderColor: "#E5E7EB",
    pillBg: "rgba(15,23,42,0.06)",
    thumbBg: "#ffffff", thumbText: "#0F172A",
  },
  {
    id: "cream", name: "Крем",
    bg: { type: "solid", color: "#F4EDE0" },
    text1: "#3D2B1F", text2: "#7A5C45", text3: "#9A7A63",
    accentLine: "#A87C4F",
    qrDark: "#3D2B1F", qrLight: "#F4EDE0",
    borderColor: "#D9C9AE",
    pillBg: "rgba(61,43,31,0.07)",
    thumbBg: "#F4EDE0", thumbText: "#3D2B1F",
  },
  {
    id: "dark", name: "Тёмная",
    bg: { type: "solid", color: "#0F1115" },
    text1: "#F4E7C7", text2: "#A89878", text3: "#A89878",
    accentLine: "#D4AF5A",
    qrDark: "#0F1115", qrLight: "#F4E7C7",
    cardBg: "#F4E7C7",
    pillBg: "rgba(212,175,90,0.18)",
    thumbBg: "#0F1115", thumbText: "#F4E7C7",
  },
  {
    id: "sunset", name: "Закат",
    bg: { type: "gradient", from: "#FB923C", to: "#DB2777", angle: 135 },
    text1: "#ffffff", text2: "rgba(255,255,255,0.92)", text3: "#ffffff",
    accentLine: "rgba(255,255,255,0.55)",
    qrDark: "#5B0F2E", qrLight: "#ffffff",
    cardBg: "#ffffff",
    pillBg: "rgba(255,255,255,0.22)",
    thumbBg: "linear-gradient(135deg,#FB923C,#DB2777)", thumbText: "#fff",
  },
  {
    id: "ocean", name: "Океан",
    bg: { type: "gradient", from: "#0F2A47", to: "#0E7490", angle: 160 },
    text1: "#ECFEFF", text2: "#A5F3FC", text3: "#67E8F9",
    accentLine: "#22D3EE",
    qrDark: "#0C2038", qrLight: "#ffffff",
    cardBg: "#ffffff",
    pillBg: "rgba(255,255,255,0.14)",
    thumbBg: "linear-gradient(160deg,#0F2A47,#0E7490)", thumbText: "#ECFEFF",
  },
  {
    id: "mint", name: "Мята",
    bg: { type: "solid", color: "#E8F4EE" },
    text1: "#0F3B2E", text2: "#2F6B55", text3: "#5C8C7A",
    accentLine: "#2F6B55",
    qrDark: "#0F3B2E", qrLight: "#E8F4EE",
    borderColor: "#C5DDD0",
    pillBg: "rgba(15,59,46,0.07)",
    thumbBg: "#E8F4EE", thumbText: "#0F3B2E",
  },
  {
    id: "rose", name: "Роза",
    bg: { type: "gradient", from: "#FFE4E6", to: "#FBCFE8", angle: 145 },
    text1: "#831843", text2: "#9F1239", text3: "#BE185D",
    accentLine: "#BE185D",
    qrDark: "#831843", qrLight: "#FFE4E6",
    pillBg: "rgba(131,24,67,0.10)",
    thumbBg: "linear-gradient(145deg,#FFE4E6,#FBCFE8)", thumbText: "#831843",
  },
];

/* ── color helpers + brand palette generator ── */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      case b: h = ((r - g) / d + 4); break;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}
function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}
function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
export function paletteFromBrand(brandHex: string): PaletteDef {
  const { r, g, b } = hexToRgb(brandHex);
  const { h, s, l } = rgbToHsl(r, g, b);
  // bright background — pale tint of the brand
  const bgL = 96;
  const bgS = Math.min(s * 0.4, 35);
  const bg = hslToHex(h, bgS, bgL);
  // text colors: same hue, reduced saturation, varying lightness
  const text1 = hslToHex(h, Math.min(s * 0.5, 45), Math.max(12, l > 50 ? 14 : Math.max(l - 35, 10)));
  const text2 = hslToHex(h, Math.min(s * 0.6, 55), 38);
  const text3 = hslToHex(h, Math.min(s * 0.5, 50), 55);
  // accent + QR — brand itself, darkened if too light
  const accentLine = l < 70 ? brandHex : hslToHex(h, s, Math.min(l, 50));
  const qrDark = l < 35 ? hslToHex(h, s, Math.max(l, 20)) : hslToHex(h, Math.max(s, 40), Math.min(l, 28));
  return {
    id: "custom",
    name: "Свой бренд",
    bg: { type: "solid", color: bg },
    text1, text2, text3,
    accentLine,
    qrDark, qrLight: bg,
    borderColor: hslToHex(h, Math.min(s * 0.4, 35), 85),
    pillBg: rgba(brandHex, 0.10),
    thumbBg: bg, thumbText: text1,
  };
}

/* ── legacy themeId → (layoutId, paletteId) migration ── */
const LEGACY_THEME_MAP: Record<string, { layoutId: LayoutId; paletteId: PaletteId }> = {
  minimal:   { layoutId: "standard",  paletteId: "light"  },
  coffee:    { layoutId: "standard",  paletteId: "cream"  },
  night:     { layoutId: "standard",  paletteId: "dark"   },
  sunset:    { layoutId: "standard",  paletteId: "sunset" },
  neon:      { layoutId: "standard",  paletteId: "dark"   },
  ocean:     { layoutId: "standard",  paletteId: "ocean"  },
  mint:      { layoutId: "standard",  paletteId: "mint"   },
  rose:      { layoutId: "standard",  paletteId: "rose"   },
  editorial: { layoutId: "editorial", paletteId: "cream"  },
  bauhaus:   { layoutId: "bauhaus",   paletteId: "cream"  },
  round:     { layoutId: "round",     paletteId: "sunset" },
};
function resolveLayoutAndPalette(cfg: StickerConfig): { layout: LayoutDef; palette: PaletteDef } {
  // 1. explicit fields win
  const explicitL = cfg.layoutId && LAYOUTS.find(l => l.id === cfg.layoutId);
  let explicitP: PaletteDef | undefined;
  if (cfg.paletteId === "custom" && cfg.brandColor) {
    explicitP = paletteFromBrand(cfg.brandColor);
  } else if (cfg.paletteId) {
    explicitP = PALETTES.find(p => p.id === cfg.paletteId);
  }
  // 2. fall back to legacy themeId
  const legacy = cfg.themeId ? LEGACY_THEME_MAP[cfg.themeId] : undefined;
  const layout = explicitL || (legacy && LAYOUTS.find(l => l.id === legacy.layoutId)) || LAYOUTS[0];
  const palette = explicitP || (legacy && PALETTES.find(p => p.id === legacy.paletteId)) || PALETTES[0];
  return { layout, palette };
}
function composeTheme(layout: LayoutDef, palette: PaletteDef): Theme {
  // palette colours override layout (which has none), but shape/labelMode come from layout
  return { ...layout, ...palette, id: layout.id, name: layout.name };
}

/* ════════════════════════════════════════════════════════════════
   PRESETS
════════════════════════════════════════════════════════════════ */
const BUSINESS_PRESETS = [
  { id: "restaurant", name: "🍽 Ресторан",      labels: ["МЕНЮ", "ОТЗЫВЫ", "ЧАЕВЫЕ"] },
  { id: "coffee",     name: "☕ Кофейня",        labels: ["МЕНЮ", "ОТЗЫВЫ", "БОНУСЫ"] },
  { id: "hotel",      name: "🏨 Отель",          labels: ["ЧЕК-ИН", "МЕНЮ", "ОТЗЫВЫ"] },
  { id: "beauty",     name: "💇 Салон",          labels: ["ЗАПИСЬ", "ОТЗЫВЫ", "АКЦИИ"] },
  { id: "auto",       name: "🚗 Автосервис",     labels: ["ЗАПИСЬ", "ОТЗЫВЫ", "ПРАЙС"] },
  { id: "clinic",     name: "🏥 Клиника",        labels: ["ЗАПИСАТЬСЯ", "ОТЗЫВЫ", "УСЛУГИ"] },
  { id: "shop",       name: "🛍 Магазин",        labels: ["КАТАЛОГ", "ОТЗЫВЫ", "АКЦИИ"] },
  { id: "fitness",    name: "💪 Фитнес",         labels: ["РАСПИСАНИЕ", "ОТЗЫВЫ", "АКЦИИ"] },
  { id: "custom",     name: "✏️ Свой",           labels: [] },
];

/* ════════════════════════════════════════════════════════════════
   DEFAULT CONFIG
════════════════════════════════════════════════════════════════ */
export const DEFAULT_STICKER_CONFIG: StickerConfig = {
  url: "https://qrstars.ru",
  headline: "МЕНЮ",
  ctaText: "Наведите камеру",
  labels: ["МЕНЮ", "ОТЗЫВЫ", "ЧАЕВЫЕ"],
  formatId: "5x5",
  layoutId: "standard",
  paletteId: "light",
  brandColor: "#4F46E5",
  dotStyle: "rounded",
  eyeStyle: "rounded",
  showWatermark: true,
  pdfCount: 10,
};

/* ════════════════════════════════════════════════════════════════
   CANVAS UTILITIES
════════════════════════════════════════════════════════════════ */
function rrPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawDot(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, style: DotStyle) {
  ctx.beginPath();
  switch (style) {
    case "squares":
      ctx.rect(cx - r, cy - r, r * 2, r * 2);
      break;
    case "rounded":
      rrPath(ctx, cx - r, cy - r, r * 2, r * 2, r * 0.45);
      break;
    case "dots":
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      break;
    case "diamond":
      ctx.moveTo(cx,     cy - r);
      ctx.lineTo(cx + r, cy    );
      ctx.lineTo(cx,     cy + r);
      ctx.lineTo(cx - r, cy    );
      ctx.closePath();
      break;
    case "cross": {
      // plus sign (Greek cross)
      const a = r * 0.42;
      ctx.rect(cx - r, cy - a, r * 2, a * 2);
      ctx.rect(cx - a, cy - r, a * 2, r * 2);
      break;
    }
    case "hex": {
      // hexagon (flat-top)
      const s = r;
      ctx.moveTo(cx - s,       cy);
      ctx.lineTo(cx - s / 2,   cy - s * 0.866);
      ctx.lineTo(cx + s / 2,   cy - s * 0.866);
      ctx.lineTo(cx + s,       cy);
      ctx.lineTo(cx + s / 2,   cy + s * 0.866);
      ctx.lineTo(cx - s / 2,   cy + s * 0.866);
      ctx.closePath();
      break;
    }
    case "bars": {
      // vertical pill
      const w = r * 0.55;
      rrPath(ctx, cx - w, cy - r, w * 2, r * 2, w);
      break;
    }
    case "star": {
      // 4-point sparkle
      const out = r, mid = r * 0.35;
      ctx.moveTo(cx,       cy - out);
      ctx.lineTo(cx + mid, cy - mid);
      ctx.lineTo(cx + out, cy);
      ctx.lineTo(cx + mid, cy + mid);
      ctx.lineTo(cx,       cy + out);
      ctx.lineTo(cx - mid, cy + mid);
      ctx.lineTo(cx - out, cy);
      ctx.lineTo(cx - mid, cy - mid);
      ctx.closePath();
      break;
    }
  }
  ctx.fill();
}

function drawFinder(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, cellSize: number,
  eyeStyle: EyeStyle, fg: string, bg: string
) {
  const outer = 7 * cellSize;
  const inner = 3 * cellSize;

  // outer frame
  ctx.fillStyle = fg;
  if (eyeStyle === "rounded") {
    const or = cellSize * 1.0;
    rrPath(ctx, x, y, outer, outer, or); ctx.fill();
    ctx.fillStyle = bg;
    rrPath(ctx, x + cellSize, y + cellSize, 5 * cellSize, 5 * cellSize, or * 0.5); ctx.fill();
    ctx.fillStyle = fg;
    rrPath(ctx, x + 2 * cellSize, y + 2 * cellSize, inner, inner, cellSize * 0.5); ctx.fill();
  } else if (eyeStyle === "dot") {
    const or = cellSize * 1.2;
    rrPath(ctx, x, y, outer, outer, or); ctx.fill();
    ctx.fillStyle = bg;
    ctx.fillRect(x + cellSize, y + cellSize, 5 * cellSize, 5 * cellSize);
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(x + 3.5 * cellSize, y + 3.5 * cellSize, 1.4 * cellSize, 0, Math.PI * 2);
    ctx.fill();
  } else if (eyeStyle === "circle") {
    // fully circular outer ring
    ctx.beginPath();
    ctx.arc(x + outer / 2, y + outer / 2, outer / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(x + outer / 2, y + outer / 2, (outer / 2) - cellSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(x + outer / 2, y + outer / 2, 1.5 * cellSize, 0, Math.PI * 2);
    ctx.fill();
  } else if (eyeStyle === "leaf") {
    // two opposing corners rounded — leaf-like
    const or = cellSize * 2.4;
    ctx.beginPath();
    ctx.moveTo(x + or, y);
    ctx.lineTo(x + outer, y);
    ctx.lineTo(x + outer, y + outer - or);
    ctx.quadraticCurveTo(x + outer, y + outer, x + outer - or, y + outer);
    ctx.lineTo(x, y + outer);
    ctx.lineTo(x, y + or);
    ctx.quadraticCurveTo(x, y, x + or, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = bg;
    const ir = cellSize * 1.6;
    ctx.beginPath();
    ctx.moveTo(x + cellSize + ir, y + cellSize);
    ctx.lineTo(x + 6 * cellSize, y + cellSize);
    ctx.lineTo(x + 6 * cellSize, y + 6 * cellSize - ir);
    ctx.quadraticCurveTo(x + 6 * cellSize, y + 6 * cellSize, x + 6 * cellSize - ir, y + 6 * cellSize);
    ctx.lineTo(x + cellSize, y + 6 * cellSize);
    ctx.lineTo(x + cellSize, y + cellSize + ir);
    ctx.quadraticCurveTo(x + cellSize, y + cellSize, x + cellSize + ir, y + cellSize);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = fg;
    const cr = cellSize * 1.2;
    ctx.beginPath();
    ctx.moveTo(x + 2 * cellSize + cr, y + 2 * cellSize);
    ctx.lineTo(x + 2 * cellSize + inner, y + 2 * cellSize);
    ctx.lineTo(x + 2 * cellSize + inner, y + 2 * cellSize + inner - cr);
    ctx.quadraticCurveTo(x + 2 * cellSize + inner, y + 2 * cellSize + inner, x + 2 * cellSize + inner - cr, y + 2 * cellSize + inner);
    ctx.lineTo(x + 2 * cellSize, y + 2 * cellSize + inner);
    ctx.lineTo(x + 2 * cellSize, y + 2 * cellSize + cr);
    ctx.quadraticCurveTo(x + 2 * cellSize, y + 2 * cellSize, x + 2 * cellSize + cr, y + 2 * cellSize);
    ctx.closePath();
    ctx.fill();
  } else if (eyeStyle === "corners") {
    // one corner sharply rounded — asymmetric
    const or = cellSize * 2.6;
    ctx.beginPath();
    ctx.moveTo(x + or, y);
    ctx.lineTo(x + outer, y);
    ctx.lineTo(x + outer, y + outer);
    ctx.lineTo(x, y + outer);
    ctx.lineTo(x, y + or);
    ctx.quadraticCurveTo(x, y, x + or, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.fillRect(x + cellSize, y + cellSize, 5 * cellSize, 5 * cellSize);
    ctx.fillStyle = fg;
    ctx.fillRect(x + 2 * cellSize, y + 2 * cellSize, inner, inner);
  } else {
    ctx.fillRect(x, y, outer, outer);
    ctx.fillStyle = bg;
    ctx.fillRect(x + cellSize, y + cellSize, 5 * cellSize, 5 * cellSize);
    ctx.fillStyle = fg;
    ctx.fillRect(x + 2 * cellSize, y + 2 * cellSize, inner, inner);
  }
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => res(img); img.onerror = rej; img.src = src;
  });
}

async function drawQR(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number, w: number, h: number,
  dotStyle: DotStyle, eyeStyle: EyeStyle,
  fg: string, bg: string | null
) {
  const QRLib = await import("qrcode");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qrObj = (QRLib as any).create(text || "https://qrstars.ru", { errorCorrectionLevel: "H" });
  const { size, data } = qrObj.modules;

  const cellSize = Math.min(w, h) / (size + 4); // 2-cell quiet zone each side
  const qrW = cellSize * size;
  const qrH = cellSize * size;
  const ox = x + (w - qrW) / 2;
  const oy = y + (h - qrH) / 2;

  if (bg) { ctx.fillStyle = bg; ctx.fillRect(x, y, w, h); }

  const isFinderZone = (r: number, c: number) =>
    (r < 8 && c < 8) || (r < 8 && c >= size - 8) || (r >= size - 8 && c < 8);

  ctx.fillStyle = fg;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!data[row * size + col]) continue;
      if (isFinderZone(row, col)) continue;
      const cx = ox + col * cellSize + cellSize / 2;
      const cy = oy + row * cellSize + cellSize / 2;
      drawDot(ctx, cx, cy, cellSize * 0.42, dotStyle);
    }
  }

  // finders
  drawFinder(ctx, ox,                      oy,                      cellSize, eyeStyle, fg, bg || "#fff");
  drawFinder(ctx, ox + (size - 7) * cellSize, oy,                   cellSize, eyeStyle, fg, bg || "#fff");
  drawFinder(ctx, ox,                      oy + (size - 7) * cellSize, cellSize, eyeStyle, fg, bg || "#fff");
}

/* ════════════════════════════════════════════════════════════════
   BACKGROUND DRAW
════════════════════════════════════════════════════════════════ */
function fillBg(ctx: CanvasRenderingContext2D, W: number, H: number, bg: ThemeBg) {
  if (bg.type === "gradient") {
    const rad = (bg.angle * Math.PI) / 180;
    const d = Math.max(W, H) / 2;
    const gr = ctx.createLinearGradient(
      W / 2 - Math.cos(rad) * d, H / 2 - Math.sin(rad) * d,
      W / 2 + Math.cos(rad) * d, H / 2 + Math.sin(rad) * d,
    );
    gr.addColorStop(0, bg.from);
    gr.addColorStop(1, bg.to);
    ctx.fillStyle = gr;
  } else {
    ctx.fillStyle = bg.color;
  }
  ctx.fillRect(0, 0, W, H);
}

/* ════════════════════════════════════════════════════════════════
   LAYOUT RENDERERS
════════════════════════════════════════════════════════════════ */
async function renderStandard(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  theme: Theme, cfg: StickerConfig
) {
  const isSquare = W === H;
  const topFrac  = 0.11;
  const qrFrac   = 0.58;
  const midFrac  = 0.06;
  const qrSize   = Math.min(W, H) * qrFrac;
  const qrX      = (W - qrSize) / 2;
  const qrY      = H * topFrac;
  const botStart = qrY + qrSize + H * midFrac;

  // border for rect themes
  if (theme.borderColor) {
    ctx.strokeStyle = theme.borderColor;
    ctx.lineWidth = Math.max(1, W * 0.004);
    rrPath(ctx, 1, 1, W - 2, H - 2, W * 0.06);
    ctx.stroke();
  }

  // headline (skip if empty)
  const headline = (cfg.headline || "").trim();
  const hlFs = isSquare ? W * 0.082 : W * 0.065;
  if (headline) {
    const hlFamily = theme.headlineFamily || "Arial, sans-serif";
    ctx.fillStyle = theme.text1;
    ctx.font = `${theme.headlineItalic ? "italic " : ""}bold ${hlFs}px ${hlFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const hlY = qrY / 2;
    ctx.fillText(theme.headlineCaps ? headline.toUpperCase() : headline, W / 2, hlY);

    // accent line under headline
    const lineW = W * 0.25;
    const lineY = hlY + hlFs * 0.75;
    ctx.strokeStyle = theme.accentLine;
    ctx.lineWidth = Math.max(1, H * 0.004);
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.moveTo(W / 2 - lineW / 2, lineY); ctx.lineTo(W / 2 + lineW / 2, lineY); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // QR card
  if (theme.cardBg) {
    const pad = qrSize * 0.04;
    ctx.fillStyle = theme.cardBg;
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    ctx.shadowBlur  = W * 0.025; ctx.shadowOffsetY = W * 0.008;
    rrPath(ctx, qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2, W * 0.035);
    ctx.fill();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  }

  await drawQR(ctx, cfg.url, qrX, qrY, qrSize, qrSize,
    cfg.dotStyle, cfg.eyeStyle, theme.qrDark, theme.cardBg ? null : theme.qrLight);

  // CTA + separator (skip both if empty)
  const cta = (cfg.ctaText || "").trim();
  const sepY = botStart + H * 0.012;
  let ctaY = sepY;
  if (cta) {
    // separator line (only meaningful when there's CTA following it)
    ctx.strokeStyle = theme.borderColor || `${theme.text1}25`;
    ctx.lineWidth = Math.max(1, H * 0.003);
    const sepPad = W * 0.12;
    ctx.beginPath(); ctx.moveTo(sepPad, sepY); ctx.lineTo(W - sepPad, sepY); ctx.stroke();

    const ctaFs = W * 0.058;
    ctaY = sepY + H * 0.052;
    ctx.fillStyle = theme.text2;
    ctx.font = `600 ${ctaFs}px Arial, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(cta, W / 2, ctaY);
  }

  // labels
  if (cfg.labels.length > 0) {
    const labY = (cta ? ctaY + H * 0.08 : sepY + H * 0.04);
    renderLabels(ctx, W, H, labY, cfg.labels, theme);
  }

  // watermark
  if (cfg.showWatermark) {
    const wmFs = W * 0.028;
    ctx.font = `${wmFs}px Arial, sans-serif`;
    ctx.fillStyle = theme.text3;
    ctx.globalAlpha = 0.6;
    ctx.fillText("qrstars.ru", W / 2, H - H * 0.035);
    ctx.globalAlpha = 1;
  }
}

async function renderEditorial(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  theme: Theme, cfg: StickerConfig
) {
  const isWide = W > H;
  const family = theme.headlineFamily || "Arial, sans-serif";

  if (isWide) {
    // A6 landscape: large title left, QR right
    const titleW = W * 0.46;
    const qrSz   = H * 0.66;
    const qrX    = titleW + (W - titleW - qrSz) / 2;
    const qrY    = (H - qrSz) / 2;

    const headline = (cfg.headline || "").trim();
    const cta = (cfg.ctaText || "").trim();
    let ty = H * 0.15;
    let fs = H * 0.20;

    // tiny eyebrow above title (only if there's a headline)
    if (headline) {
      ctx.fillStyle = theme.text3;
      const ebFs = H * 0.028;
      ctx.font = `${ebFs}px Arial, sans-serif`;
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText("— SCAN ME", W * 0.07, H * 0.09);

      // big title
      ctx.fillStyle = theme.text1;
      ctx.font = `bold ${fs}px ${family}`;
      while (ctx.measureText(headline).width > titleW * 0.82 && fs > 8) {
        fs -= 1; ctx.font = `bold ${fs}px ${family}`;
      }
      ctx.fillText(headline, W * 0.07, ty);
      ty += fs * 1.05;
    }

    // cta
    if (cta) {
      const ctaFs = H * 0.045;
      ctx.fillStyle = theme.text2;
      ctx.font = `${ctaFs}px Arial, sans-serif`;
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(cta, W * 0.07, ty);
    }

    // separator line vertical
    ctx.strokeStyle = theme.accentLine; ctx.lineWidth = 1; ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.moveTo(titleW, H * 0.12); ctx.lineTo(titleW, H * 0.88); ctx.stroke();
    ctx.globalAlpha = 1;

    await drawQR(ctx, cfg.url, qrX, qrY, qrSz, qrSz, cfg.dotStyle, cfg.eyeStyle, theme.qrDark, theme.qrLight);

    // bottom labels
    if (cfg.labels.length) {
      const labY = H * 0.92;
      renderLabels(ctx, W, H, labY, cfg.labels, theme);
    }

    if (cfg.showWatermark) {
      ctx.font = `${H * 0.025}px Arial, sans-serif`;
      ctx.fillStyle = theme.text3; ctx.globalAlpha = 0.5;
      ctx.textAlign = "right"; ctx.textBaseline = "bottom";
      ctx.fillText("qrstars.ru", W - W * 0.04, H - H * 0.04);
      ctx.globalAlpha = 1;
    }
  } else {
    // A6 / square portrait editorial
    const qrSz   = W * 0.56;
    const qrX    = (W - qrSz) / 2;

    const headline = (cfg.headline || "").trim();
    const cta = (cfg.ctaText || "").trim();
    let ty = H * 0.10;
    let lineFs = W * 0.14;

    if (headline) {
      // eyebrow
      const ebFs = H * 0.025;
      ctx.font = `${ebFs}px Arial, sans-serif`;
      ctx.fillStyle = theme.text3;
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText("— SCAN ME", W * 0.07, H * 0.06);

      // wrap headline into ≤2 lines
      const words = headline.split(/\s+/);
      ctx.font = `bold ${lineFs}px ${family}`;
      while (ctx.measureText(headline).width > W * 0.86 && lineFs > 8) {
        lineFs -= 1; ctx.font = `bold ${lineFs}px ${family}`;
      }
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        const test = cur ? `${cur} ${w}` : w;
        if (ctx.measureText(test).width > W * 0.86 && cur) {
          lines.push(cur); cur = w;
        } else { cur = test; }
      }
      if (cur) lines.push(cur);
      if (lines.length > 2) { lines[1] = lines.slice(1).join(" "); lines.length = 2; }

      ctx.fillStyle = theme.text1; ctx.textAlign = "left"; ctx.textBaseline = "top";
      for (const line of lines) {
        ctx.fillText(line, W * 0.07, ty);
        ty += lineFs * 1.05;
      }
    }

    const qrY = Math.max(ty + H * 0.04, H * 0.22);

    await drawQR(ctx, cfg.url, qrX, qrY, qrSz, qrSz, cfg.dotStyle, cfg.eyeStyle, theme.qrDark, theme.qrLight);

    let belowY = qrY + qrSz + H * 0.025;
    if (cta) {
      const ctaFs = W * 0.05;
      ctx.font = `${ctaFs}px Arial, sans-serif`;
      ctx.fillStyle = theme.text2;
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText(cta, W / 2, belowY);
      belowY += ctaFs * 1.2;
    }

    if (cfg.labels.length) {
      // separator
      const sepY = belowY + H * 0.02;
      ctx.strokeStyle = theme.accentLine; ctx.lineWidth = 1; ctx.globalAlpha = 0.22;
      ctx.beginPath(); ctx.moveTo(W * 0.07, sepY); ctx.lineTo(W * 0.93, sepY); ctx.stroke();
      ctx.globalAlpha = 1;
      renderLabels(ctx, W, H, sepY + H * 0.04, cfg.labels, theme);
    }

    if (cfg.showWatermark) {
      ctx.font = `${W * 0.028}px Arial, sans-serif`;
      ctx.fillStyle = theme.text3; ctx.globalAlpha = 0.5;
      ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.fillText("qrstars.ru", W / 2, H - H * 0.03);
      ctx.globalAlpha = 1;
    }
  }
}

async function renderBauhaus(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  theme: Theme, cfg: StickerConfig
) {
  const m = Math.min(W, H);
  const blockSz = m * 0.16;

  // Top-left yellow rectangle
  ctx.fillStyle = "#F5C835";
  ctx.fillRect(0, 0, blockSz * 1.3, blockSz * 0.7);

  // Top-right red triangle
  ctx.fillStyle = "#E0432B";
  ctx.beginPath();
  ctx.moveTo(W, 0); ctx.lineTo(W - blockSz * 1.1, 0); ctx.lineTo(W, blockSz * 1.1);
  ctx.closePath(); ctx.fill();

  // Bottom-left blue square
  ctx.fillStyle = "#2B5BE8";
  ctx.fillRect(0, H - blockSz * 0.7, blockSz * 0.7, blockSz * 0.7);

  // Bottom-right black dot
  ctx.fillStyle = "#1A1A1A";
  ctx.beginPath();
  ctx.arc(W - blockSz * 0.5, H - blockSz * 0.5, blockSz * 0.25, 0, Math.PI * 2);
  ctx.fill();

  // Headline — centered, below top blocks (skip if empty)
  const headline = (cfg.headline || "").trim();
  const cta = (cfg.ctaText || "").trim();
  if (headline) {
    const hlFs = m * 0.085;
    ctx.fillStyle = theme.text1;
    ctx.font = `900 ${hlFs}px Arial, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(headline.toUpperCase(), W / 2, H * 0.18);
  }

  // QR
  const qrSz = m * 0.54;
  const qrX  = (W - qrSz) / 2;
  const qrY  = headline ? H * 0.28 : H * 0.22;
  await drawQR(ctx, cfg.url, qrX, qrY, qrSz, qrSz, cfg.dotStyle, cfg.eyeStyle, theme.qrDark, theme.qrLight);

  let belowY = qrY + qrSz + H * 0.03;
  if (cta) {
    const ctaFs = m * 0.052;
    ctx.font = `bold ${ctaFs}px Arial, sans-serif`;
    ctx.fillStyle = theme.text2;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(cta, W / 2, belowY);
    belowY += ctaFs * 1.6;
  }

  // Labels
  if (cfg.labels.length) {
    renderLabels(ctx, W, H, belowY, cfg.labels, theme);
  }

  if (cfg.showWatermark) {
    ctx.font = `${W * 0.028}px Arial, sans-serif`;
    ctx.fillStyle = theme.text3; ctx.globalAlpha = 0.5;
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("qrstars.ru", W / 2, H - H * 0.03);
    ctx.globalAlpha = 1;
  }
}

async function renderRound(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  theme: Theme, cfg: StickerConfig
) {
  // circle is already clipped by caller
  const cx = W / 2, cy = H / 2;
  const R  = Math.min(W, H) / 2;

  // inner thin ring (decorative)
  ctx.strokeStyle = theme.accentLine;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = Math.max(1, R * 0.01);
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.94, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // headline — placed in top arc (skip if empty)
  const headline = (cfg.headline || "").trim();
  const cta = (cfg.ctaText || "").trim();
  if (headline) {
    const hlFs = R * 0.15;
    ctx.fillStyle = theme.text1;
    const family = theme.headlineFamily || "Arial, sans-serif";
    ctx.font = `900 ${hlFs}px ${family}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(
      theme.headlineCaps !== false ? headline.toUpperCase() : headline,
      cx, cy - R * 0.66
    );
  }

  // QR — smaller, centered, with white card
  const qrSz = R * 0.72;
  const qrX  = cx - qrSz / 2;
  const qrY  = cy - qrSz / 2 - (headline ? R * 0.04 : 0);

  if (theme.cardBg) {
    const pad = qrSz * 0.07;
    ctx.fillStyle = theme.cardBg;
    ctx.shadowColor = "rgba(0,0,0,0.22)";
    ctx.shadowBlur = R * 0.06; ctx.shadowOffsetY = R * 0.014;
    rrPath(ctx, qrX - pad, qrY - pad, qrSz + pad * 2, qrSz + pad * 2, qrSz * 0.09);
    ctx.fill();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  }

  await drawQR(ctx, cfg.url, qrX, qrY, qrSz, qrSz, cfg.dotStyle, cfg.eyeStyle, theme.qrDark, theme.cardBg ? null : theme.qrLight);

  // CTA below QR (skip if empty)
  if (cta) {
    const ctaFs = R * 0.065;
    ctx.font = `600 ${ctaFs}px Arial, sans-serif`;
    ctx.fillStyle = theme.text2;
    const ctaY = qrY + qrSz + R * 0.10;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(cta, cx, ctaY);
  }

  // Labels — limit width by chord at labY so pills stay inside circle
  if (cfg.labels.length) {
    const labY    = cta ? cy + R * 0.62 : cy + R * 0.55;
    // half-chord at distance d from center: sqrt(R^2 - d^2)
    const d       = Math.abs(labY - cy);
    const halfCh  = Math.sqrt(Math.max(0, R * R - d * d));
    const maxW    = Math.max(20, halfCh * 2 * 0.88);
    renderLabels(ctx, W, H, labY, cfg.labels, theme, {
      centerX: cx, maxWidth: maxW, fontScale: 0.034,
    });
  }

  if (cfg.showWatermark) {
    ctx.font = `${R * 0.05}px Arial, sans-serif`;
    ctx.fillStyle = theme.text3; ctx.globalAlpha = 0.7;
    ctx.fillText("qrstars.ru", cx, cy + R * 0.82);
    ctx.globalAlpha = 1;
  }
}

/* ────────────  BADGE  ──────────── */
async function renderBadge(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  theme: Theme, cfg: StickerConfig
) {
  const headline = (cfg.headline || "").trim();
  const cta = (cfg.ctaText || "").trim();

  // Accent banner across top
  const banH = H * (headline ? 0.20 : 0.06);
  ctx.fillStyle = theme.accentLine;
  rrPath(ctx, W * 0.04, H * 0.04, W * 0.92, banH, Math.min(W * 0.06, banH * 0.5));
  ctx.fill();

  // Headline inside banner — use a contrasting text color
  if (headline) {
    const onAccent = theme.cardBg || theme.qrLight || "#fff";
    const family = theme.headlineFamily || "Arial, sans-serif";
    const fs = Math.min(banH * 0.55, W * 0.085);
    ctx.fillStyle = onAccent;
    ctx.font = `${theme.headlineItalic ? "italic " : ""}bold ${fs}px ${family}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    let drawn = theme.headlineCaps ? headline.toUpperCase() : headline;
    let curFs = fs;
    while (ctx.measureText(drawn).width > W * 0.84 && curFs > 6) {
      curFs -= 1;
      ctx.font = `${theme.headlineItalic ? "italic " : ""}bold ${curFs}px ${family}`;
    }
    ctx.fillText(drawn, W / 2, H * 0.04 + banH / 2);
  }

  // QR
  const qrSize = Math.min(W * 0.6, H * 0.48);
  const qrX = (W - qrSize) / 2;
  const qrY = H * 0.04 + banH + H * 0.04;
  if (theme.cardBg) {
    const pad = qrSize * 0.05;
    ctx.fillStyle = theme.cardBg;
    rrPath(ctx, qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2, W * 0.03); ctx.fill();
  }
  await drawQR(ctx, cfg.url, qrX, qrY, qrSize, qrSize,
    cfg.dotStyle, cfg.eyeStyle, theme.qrDark, theme.cardBg ? null : theme.qrLight);

  let belowY = qrY + qrSize + H * 0.04;
  if (cta) {
    ctx.fillStyle = theme.text2;
    ctx.font = `600 ${W * 0.05}px Arial, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(cta, W / 2, belowY);
    belowY += W * 0.075;
  }

  if (cfg.labels.length) {
    renderLabels(ctx, W, H, belowY + H * 0.02, cfg.labels, theme);
  }

  if (cfg.showWatermark) {
    ctx.font = `${W * 0.028}px Arial, sans-serif`;
    ctx.fillStyle = theme.text3; ctx.globalAlpha = 0.55;
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("qrstars.ru", W / 2, H - H * 0.035);
    ctx.globalAlpha = 1;
  }
}

/* ────────────  TICKET  ──────────── */
async function renderTicket(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  theme: Theme, cfg: StickerConfig
) {
  const headline = (cfg.headline || "").trim();
  const cta = (cfg.ctaText || "").trim();
  const family = theme.headlineFamily || "Arial, sans-serif";

  // Perforation cutouts ≈ 62% from top: two semi-circles on left/right edges
  // We "cut" them by filling with a slightly darker tint of bg — gives ticket vibe
  const perfY = H * 0.66;
  const perfR = Math.min(W, H) * 0.05;
  const bgColor = theme.bg.type === "solid" ? theme.bg.color : theme.bg.from;
  // shadow tint
  ctx.fillStyle = `${theme.text1}10`;
  ctx.beginPath(); ctx.arc(0, perfY, perfR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(W, perfY, perfR, 0, Math.PI * 2); ctx.fill();
  // bg-color disc on top to "cut" cleanly
  ctx.fillStyle = bgColor;
  ctx.beginPath(); ctx.arc(0, perfY, perfR * 0.92, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(W, perfY, perfR * 0.92, 0, Math.PI * 2); ctx.fill();

  // dashed perforation line
  ctx.strokeStyle = theme.text3;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = Math.max(1, H * 0.003);
  ctx.setLineDash([W * 0.018, W * 0.012]);
  ctx.beginPath();
  ctx.moveTo(perfR * 1.1, perfY);
  ctx.lineTo(W - perfR * 1.1, perfY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // headline
  if (headline) {
    const fs = W * 0.075;
    ctx.fillStyle = theme.text1;
    ctx.font = `${theme.headlineItalic ? "italic " : ""}bold ${fs}px ${family}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(theme.headlineCaps ? headline.toUpperCase() : headline, W / 2, H * 0.10);
  }

  // QR
  const qrSize = Math.min(W * 0.52, H * 0.42);
  const qrX = (W - qrSize) / 2;
  const qrY = (headline ? H * 0.17 : H * 0.10);
  if (theme.cardBg) {
    const pad = qrSize * 0.05;
    ctx.fillStyle = theme.cardBg;
    rrPath(ctx, qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2, W * 0.03); ctx.fill();
  }
  await drawQR(ctx, cfg.url, qrX, qrY, qrSize, qrSize,
    cfg.dotStyle, cfg.eyeStyle, theme.qrDark, theme.cardBg ? null : theme.qrLight);

  // Below perforation: cta + labels
  let belowY = perfY + H * 0.05;
  if (cta) {
    ctx.fillStyle = theme.text2;
    ctx.font = `600 ${W * 0.052}px Arial, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(cta, W / 2, belowY);
    belowY += W * 0.078;
  }
  if (cfg.labels.length) {
    renderLabels(ctx, W, H, belowY + H * 0.015, cfg.labels, theme);
  }

  if (cfg.showWatermark) {
    ctx.font = `${W * 0.028}px Arial, sans-serif`;
    ctx.fillStyle = theme.text3; ctx.globalAlpha = 0.55;
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("qrstars.ru", W / 2, H - H * 0.035);
    ctx.globalAlpha = 1;
  }
}

/* ────────────  STRIPE  ──────────── */
async function renderStripe(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  theme: Theme, cfg: StickerConfig
) {
  const headline = (cfg.headline || "").trim();
  const cta = (cfg.ctaText || "").trim();
  const family = theme.headlineFamily || "Arial, sans-serif";

  // Diagonal accent stripe (top-right corner)
  ctx.save();
  ctx.fillStyle = theme.accentLine;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(W * 0.55, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, H * 0.45);
  ctx.closePath();
  ctx.fill();
  // smaller stripe top-left
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W * 0.35, 0);
  ctx.lineTo(0, H * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // headline
  if (headline) {
    const fs = W * 0.075;
    ctx.fillStyle = theme.text1;
    ctx.font = `${theme.headlineItalic ? "italic " : ""}bold ${fs}px ${family}`;
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(theme.headlineCaps ? headline.toUpperCase() : headline, W * 0.07, H * 0.09);
  }

  // QR
  const qrSize = Math.min(W * 0.58, H * 0.5);
  const qrX = (W - qrSize) / 2;
  const qrY = H * (headline ? 0.34 : 0.22);
  if (theme.cardBg) {
    const pad = qrSize * 0.05;
    ctx.fillStyle = theme.cardBg;
    rrPath(ctx, qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2, W * 0.03); ctx.fill();
  }
  await drawQR(ctx, cfg.url, qrX, qrY, qrSize, qrSize,
    cfg.dotStyle, cfg.eyeStyle, theme.qrDark, theme.cardBg ? null : theme.qrLight);

  let belowY = qrY + qrSize + H * 0.04;
  if (cta) {
    ctx.fillStyle = theme.text2;
    ctx.font = `600 ${W * 0.05}px Arial, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(cta, W / 2, belowY);
    belowY += W * 0.075;
  }
  if (cfg.labels.length) {
    renderLabels(ctx, W, H, belowY + H * 0.02, cfg.labels, theme);
  }

  if (cfg.showWatermark) {
    ctx.font = `${W * 0.028}px Arial, sans-serif`;
    ctx.fillStyle = theme.text3; ctx.globalAlpha = 0.55;
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("qrstars.ru", W / 2, H - H * 0.035);
    ctx.globalAlpha = 1;
  }
}

/* ────────────  COMPACT  (QR-first) ──────────── */
async function renderCompact(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  theme: Theme, cfg: StickerConfig
) {
  const headline = (cfg.headline || "").trim();
  const cta = (cfg.ctaText || "").trim();
  const family = theme.headlineFamily || "Arial, sans-serif";

  // subtle border
  if (theme.borderColor) {
    ctx.strokeStyle = theme.borderColor;
    ctx.lineWidth = Math.max(1, W * 0.004);
    rrPath(ctx, 1, 1, W - 2, H - 2, W * 0.06);
    ctx.stroke();
  }

  // tiny headline at top
  if (headline) {
    const fs = W * 0.045;
    ctx.fillStyle = theme.text2;
    ctx.font = `${theme.headlineItalic ? "italic " : ""}600 ${fs}px ${family}`;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(theme.headlineCaps !== false ? headline.toUpperCase() : headline, W / 2, H * 0.07);
  }

  // Huge QR
  const qrSize = Math.min(W * 0.78, H * 0.70);
  const qrX = (W - qrSize) / 2;
  const qrY = (H - qrSize) / 2 - H * 0.02;
  if (theme.cardBg) {
    const pad = qrSize * 0.04;
    ctx.fillStyle = theme.cardBg;
    rrPath(ctx, qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2, W * 0.035); ctx.fill();
  }
  await drawQR(ctx, cfg.url, qrX, qrY, qrSize, qrSize,
    cfg.dotStyle, cfg.eyeStyle, theme.qrDark, theme.cardBg ? null : theme.qrLight);

  if (cta) {
    ctx.fillStyle = theme.text1;
    ctx.font = `bold ${W * 0.05}px Arial, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText(cta, W / 2, H - H * (cfg.labels.length ? 0.13 : 0.07));
  }

  if (cfg.labels.length) {
    renderLabels(ctx, W, H, H - H * 0.06, cfg.labels, theme);
  }

  if (cfg.showWatermark && !cfg.labels.length) {
    ctx.font = `${W * 0.025}px Arial, sans-serif`;
    ctx.fillStyle = theme.text3; ctx.globalAlpha = 0.5;
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("qrstars.ru", W / 2, H - H * 0.03);
    ctx.globalAlpha = 1;
  }
}

/* ════════════════════════════════════════════════════════════════
   LABEL RENDERER
════════════════════════════════════════════════════════════════ */
function renderLabels(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  y: number, labels: string[], theme: Theme,
  opts?: { centerX?: number; maxWidth?: number; fontScale?: number }
) {
  if (!labels.length) return;

  const cX  = opts?.centerX ?? W / 2;
  const maxW = opts?.maxWidth ?? W;
  const labFs = (opts?.fontScale ?? 0.044) * W;
  ctx.font = `${labFs}px Arial, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";

  if (theme.labelMode === "pills") {
    // Rounded pill buttons
    const pillH  = labFs * 1.7;
    const padX   = labFs * 0.7;
    const gap    = labFs * 0.35;
    const widths = labels.map(l => ctx.measureText(l).width + padX * 2);
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (labels.length - 1);
    const limit  = maxW * 0.96;

    // shrink if overflowing
    if (totalW > limit) {
      const scale = limit / totalW;
      const sFs = labFs * scale;
      ctx.font = `${sFs}px Arial, sans-serif`;
      const sWidths = labels.map(l => ctx.measureText(l).width + padX * scale * 2);
      const sTotal = sWidths.reduce((a, b) => a + b, 0) + gap * scale * (labels.length - 1);
      let px = cX - sTotal / 2;
      for (let i = 0; i < labels.length; i++) {
        const pw = sWidths[i];
        ctx.fillStyle = theme.pillBg || "rgba(255,255,255,0.22)";
        rrPath(ctx, px, y - (pillH * scale) / 2, pw, pillH * scale, (pillH * scale) / 2);
        ctx.fill();
        ctx.fillStyle = theme.text3;
        ctx.fillText(labels[i], px + pw / 2, y);
        px += pw + gap * scale;
      }
      return;
    }

    let px = cX - totalW / 2;
    for (let i = 0; i < labels.length; i++) {
      const pw = widths[i];
      ctx.fillStyle = theme.pillBg || "rgba(255,255,255,0.22)";
      rrPath(ctx, px, y - pillH / 2, pw, pillH, pillH / 2);
      ctx.fill();
      ctx.fillStyle = theme.text3;
      ctx.fillText(labels[i], px + pw / 2, y);
      px += pw + gap;
    }
  } else if (theme.labelMode === "bars") {
    // dot separated, slightly tracked-out
    const barText = labels.join("   ·   ");
    ctx.fillStyle = theme.text3;
    ctx.fillText(barText, cX, y);
  } else if (theme.labelMode === "sides" && labels.length >= 2) {
    // Two bottom corners + dot separator
    ctx.textAlign = "left";
    ctx.fillStyle = theme.text3;
    ctx.fillText(labels[0], cX - maxW * 0.42, y);
    ctx.textAlign = "right";
    ctx.fillText(labels[labels.length - 1], cX + maxW * 0.42, y);
    if (labels.length >= 3) {
      ctx.textAlign = "center";
      ctx.globalAlpha = 0.5;
      ctx.fillText("·", cX, y);
      ctx.globalAlpha = 1;
    }
  } else {
    // dots
    const dotText = labels.join("   ·   ");
    ctx.fillStyle = theme.text3;
    ctx.globalAlpha = 0.85;
    ctx.fillText(dotText, cX, y);
    ctx.globalAlpha = 1;
  }
}

/* ════════════════════════════════════════════════════════════════
   MAIN RENDER STICKER
════════════════════════════════════════════════════════════════ */
export async function renderSticker(
  canvas: HTMLCanvasElement,
  cfg: StickerConfig,
  fmt: Format,
  forPreview = false
): Promise<void> {
  const mm2px = fmt.dpi / 25.4;
  const W = forPreview ? fmt.previewW : Math.round(fmt.wMm * mm2px);
  const H = forPreview ? fmt.previewH : Math.round(fmt.hMm * mm2px);
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);

  const { layout, palette } = resolveLayoutAndPalette(cfg);
  const theme = composeTheme(layout, palette);

  // clip for circle theme
  if (theme.shape === "circle") {
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, Math.min(W, H) / 2 - 1, 0, Math.PI * 2);
    ctx.clip();
  }

  fillBg(ctx, W, H, theme.bg);

  switch (theme.kind) {
    case "editorial": await renderEditorial(ctx, W, H, theme, cfg); break;
    case "bauhaus":   await renderBauhaus(ctx, W, H, theme, cfg);   break;
    case "round":     await renderRound(ctx, W, H, theme, cfg);     break;
    case "badge":     await renderBadge(ctx, W, H, theme, cfg);     break;
    case "ticket":    await renderTicket(ctx, W, H, theme, cfg);    break;
    case "stripe":    await renderStripe(ctx, W, H, theme, cfg);    break;
    case "compact":   await renderCompact(ctx, W, H, theme, cfg);   break;
    default:          await renderStandard(ctx, W, H, theme, cfg);  break;
  }

  if (theme.shape === "circle") ctx.restore();
}

/* ════════════════════════════════════════════════════════════════
   A4 PDF GRID
════════════════════════════════════════════════════════════════ */
function calcA4Grid(wMm: number, hMm: number) {
  const margin = 10, gap = 5;
  const cols = Math.floor((210 - 2 * margin + gap) / (wMm + gap));
  const rows = Math.floor((297 - 2 * margin + gap) / (hMm + gap));
  return { cols, rows, perPage: cols * rows, margin, gap };
}

/* ════════════════════════════════════════════════════════════════
   THUMBNAILS — Layout schematic + Palette swatch
════════════════════════════════════════════════════════════════ */
function fillBgMini(ctx: CanvasRenderingContext2D, bg: ThemeBg, w: number, h: number) {
  if (bg.type === "gradient") {
    const gr = ctx.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, bg.from); gr.addColorStop(1, bg.to);
    ctx.fillStyle = gr;
  } else {
    ctx.fillStyle = bg.color;
  }
  ctx.fillRect(0, 0, w, h);
}

/* Tiny schematic showing layout structure with palette colors applied */
function LayoutThumb({ layout, palette }: { layout: LayoutDef; palette: PaletteDef }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const W = 64, H = 64;
    c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);

    if (layout.shape === "circle") {
      ctx.save();
      ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 1, 0, Math.PI * 2); ctx.clip();
    }
    fillBgMini(ctx, palette.bg, W, H);

    if (layout.kind === "bauhaus") {
      ctx.fillStyle = "#F5C835"; ctx.fillRect(0, 0, 14, 8);
      ctx.fillStyle = "#E0432B";
      ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W - 12, 0); ctx.lineTo(W, 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#2B5BE8"; ctx.fillRect(0, H - 8, 8, 8);
    }
    if (layout.kind === "badge") {
      ctx.fillStyle = palette.accentLine;
      const ban = 14;
      ctx.beginPath();
      const r = 3;
      ctx.moveTo(4 + r, 4);
      ctx.lineTo(60 - r, 4);
      ctx.quadraticCurveTo(60, 4, 60, 4 + r);
      ctx.lineTo(60, 4 + ban - r);
      ctx.quadraticCurveTo(60, 4 + ban, 60 - r, 4 + ban);
      ctx.lineTo(4 + r, 4 + ban);
      ctx.quadraticCurveTo(4, 4 + ban, 4, 4 + ban - r);
      ctx.lineTo(4, 4 + r);
      ctx.quadraticCurveTo(4, 4, 4 + r, 4);
      ctx.closePath();
      ctx.fill();
    }
    if (layout.kind === "ticket") {
      // perforation cutouts on edges
      const py = 40;
      ctx.fillStyle = palette.bg.type === "solid" ? palette.bg.color : palette.bg.from;
      ctx.beginPath(); ctx.arc(0, py, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(64, py, 4, 0, Math.PI * 2); ctx.fill();
      // dashed line
      ctx.strokeStyle = palette.text3; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.moveTo(6, py); ctx.lineTo(58, py); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (layout.kind === "stripe") {
      ctx.fillStyle = palette.accentLine;
      ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(64, 0); ctx.lineTo(64, 24); ctx.closePath(); ctx.fill();
    }

    // headline bar
    ctx.fillStyle = palette.text1;
    if (layout.kind === "editorial") {
      ctx.fillRect(8, 12, 28, 4);
      ctx.fillRect(8, 18, 18, 3);
    } else if (layout.kind === "round") {
      ctx.fillRect(20, 10, 24, 4);
    } else if (layout.kind === "compact") {
      ctx.fillRect(24, 8, 16, 2);
    } else if (layout.kind === "badge") {
      ctx.fillStyle = palette.cardBg || palette.qrLight || "#fff";
      ctx.fillRect(22, 10, 20, 3);
    } else if (layout.kind === "stripe") {
      ctx.fillRect(6, 10, 24, 4);
    } else if (layout.kind === "ticket") {
      ctx.fillRect(20, 6, 24, 3);
    } else {
      ctx.fillRect(20, 11, 24, 4);
    }

    // mini QR
    const qrX = layout.kind === "editorial" ? 36
              : layout.kind === "round"     ? 20
              : layout.kind === "compact"   ? 12
              : 18;
    const qrY = layout.kind === "compact"   ? 16
              : layout.kind === "badge"     ? 22
              : layout.kind === "ticket"    ? 14
              : 22;
    const qrSz = layout.kind === "editorial" ? 20
               : layout.kind === "round"     ? 24
               : layout.kind === "compact"   ? 40
               : layout.kind === "badge"     ? 26
               : layout.kind === "ticket"    ? 22
               : 28;
    if (palette.cardBg) {
      ctx.fillStyle = palette.cardBg;
      ctx.fillRect(qrX - 1, qrY - 1, qrSz + 2, qrSz + 2);
    }
    ctx.fillStyle = palette.qrDark;
    ctx.fillRect(qrX, qrY, qrSz, qrSz);
    ctx.fillStyle = palette.cardBg || (palette.bg.type === "gradient" ? palette.bg.from : palette.bg.color);
    ctx.fillRect(qrX + 2, qrY + 2, qrSz - 4, qrSz - 4);
    ctx.fillStyle = palette.qrDark;
    ctx.fillRect(qrX + 4, qrY + 4, 5, 5);
    ctx.fillRect(qrX + qrSz - 9, qrY + 4, 5, 5);
    ctx.fillRect(qrX + 4, qrY + qrSz - 9, 5, 5);

    // bottom labels
    ctx.fillStyle = palette.text3; ctx.globalAlpha = 0.7;
    if (layout.kind === "editorial") {
      ctx.fillRect(8, 48, 20, 2);
      ctx.fillRect(8, 54, 14, 2);
    } else {
      ctx.fillRect(12, 56, 40, 3);
    }
    ctx.globalAlpha = 1;
    if (layout.shape === "circle") ctx.restore();
  }, [layout, palette]);
  return <canvas ref={ref} width={64} height={64} style={{ display: "block", width: 64, height: 64 }} />;
}

/* Color swatch with mini QR — for palette picker */
function PaletteSwatch({ palette, custom = false }: { palette: PaletteDef; custom?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const W = 64, H = 64;
    c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    fillBgMini(ctx, palette.bg, W, H);

    // 3 horizontal bars showing text1/2/3 colors
    ctx.fillStyle = palette.text1; ctx.fillRect(10, 14, 30, 4);
    ctx.fillStyle = palette.text2; ctx.fillRect(10, 22, 22, 3);
    ctx.fillStyle = palette.text3; ctx.fillRect(10, 28, 18, 3);

    // accent dot
    ctx.fillStyle = palette.accentLine;
    ctx.beginPath(); ctx.arc(52, 16, 3, 0, Math.PI * 2); ctx.fill();

    // tiny QR
    if (palette.cardBg) { ctx.fillStyle = palette.cardBg; ctx.fillRect(15, 38, 34, 18); }
    ctx.fillStyle = palette.qrDark;
    ctx.fillRect(18, 40, 4, 4); ctx.fillRect(28, 40, 4, 4); ctx.fillRect(38, 40, 4, 4);
    ctx.fillRect(18, 48, 4, 4); ctx.fillRect(28, 48, 4, 4); ctx.fillRect(42, 48, 4, 4);
    ctx.fillRect(18, 52, 4, 4); ctx.fillRect(34, 52, 4, 4);

    if (custom) {
      // small diagonal stripe to indicate "custom"
      ctx.strokeStyle = palette.accentLine; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 64); ctx.lineTo(64, 0); ctx.stroke();
    }
  }, [palette, custom]);
  return <canvas ref={ref} width={64} height={64} style={{ display: "block", width: 64, height: 64, borderRadius: 8 }} />;
}

/* ════════════════════════════════════════════════════════════════
   DOT STYLE BUTTON
════════════════════════════════════════════════════════════════ */
function DotBtn({ style, active, onClick }: { style: DotStyle; active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    c.width = 36; c.height = 36;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#1a1a2e";
    for (let r = 0; r < 3; r++) for (let cl = 0; cl < 3; cl++) {
      drawDot(ctx, 6 + cl * 12, 6 + r * 12, 4, style);
    }
  }, [style]);
  return (
    <button onClick={onClick} className={`p-1.5 rounded-lg border-2 transition-all ${active ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}>
      <canvas ref={ref} width={36} height={36} style={{ display: "block", width: 36, height: 36 }} />
    </button>
  );
}

function EyeBtn({ style, active, onClick }: { style: EyeStyle; active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    c.width = 36; c.height = 36;
    const ctx = c.getContext("2d")!;
    const cs = 4;
    drawFinder(ctx, 4, 4, cs, style, "#1a1a2e", "#ffffff");
  }, [style]);
  return (
    <button onClick={onClick} className={`p-1.5 rounded-lg border-2 transition-all ${active ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}>
      <canvas ref={ref} width={36} height={36} style={{ display: "block", width: 36, height: 36 }} />
    </button>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════════ */
interface Props {
  initialConfig?: Partial<StickerConfig>;
  onSave?: (cfg: StickerConfig) => Promise<void>;
  saving?: boolean;
  /** Редактор сохранённого шаблона — без массовой PDF-печати */
  variant?: "designer" | "template";
}

export default function StickerDesigner({
  initialConfig,
  onSave,
  saving,
  variant = "designer",
}: Props) {
  const isTemplate = variant === "template";
  const [cfg, setCfg] = useState<StickerConfig>({ ...DEFAULT_STICKER_CONFIG, ...initialConfig });
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [preset, setPreset] = useState(BUSINESS_PRESETS[0].id);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const fmt = FORMATS.find(f => f.id === cfg.formatId) || FORMATS[0];
  const { layout, palette } = resolveLayoutAndPalette(cfg);
  const theme = composeTheme(layout, palette);

  const up = useCallback(<K extends keyof StickerConfig>(k: K, v: StickerConfig[K]) =>
    setCfg(prev => ({ ...prev, [k]: v })), []);

  /* draw preview */
  const redraw = useCallback(async () => {
    const canvas = previewRef.current;
    if (!canvas) return;
    try {
      const off = document.createElement("canvas");
      await renderSticker(off, cfg, fmt, true);
      canvas.width  = off.width;
      canvas.height = off.height;
      canvas.getContext("2d")!.drawImage(off, 0, 0);
    } catch (e) {
      console.error("preview err", e);
    }
  }, [cfg, fmt]);

  useEffect(() => {
    const t = setTimeout(redraw, 80);
    return () => clearTimeout(t);
  }, [redraw]);

  /* downloads */
  const downloadPNG = async () => {
    setBusy(true);
    try {
      const c = document.createElement("canvas");
      await renderSticker(c, cfg, fmt, false);
      const a = document.createElement("a");
      a.download = `qr-sticker-${cfg.formatId}-${layout.id}-${palette.id}.png`;
      a.href = c.toDataURL("image/png", 1.0); a.click();
    } finally { setBusy(false); }
  };

  const downloadPDF = async () => {
    setBusy(true);
    try {
      const c = document.createElement("canvas");
      await renderSticker(c, cfg, fmt, false);
      const imgData = c.toDataURL("image/png", 1.0);
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const { cols, rows, perPage, margin, gap } = calcA4Grid(fmt.wMm, fmt.hMm);
      for (let i = 0; i < cfg.pdfCount; i++) {
        if (i > 0 && i % perPage === 0) doc.addPage();
        const pos = i % perPage;
        const col = pos % cols, row = Math.floor(pos / cols);
        const x = margin + col * (fmt.wMm + gap);
        const y = margin + row * (fmt.hMm + gap);
        doc.addImage(imgData, "PNG", x, y, fmt.wMm, fmt.hMm);
      }
      doc.save(`qr-stickers-${cfg.pdfCount}шт.pdf`);
    } finally { setBusy(false); }
  };

  const { perPage } = calcA4Grid(fmt.wMm, fmt.hMm);
  const pagesNeeded = Math.ceil(cfg.pdfCount / perPage);

  /* ── UI ── */
  return (
    <div className="flex flex-col lg:flex-row gap-6">

      {/* ── Left panel ── */}
      <div className="lg:w-[380px] flex-shrink-0 space-y-4">

        {/* URL */}
        <Panel title={isTemplate ? "Ссылка для предпросмотра" : "Ссылка QR-кода"}>
          {isTemplate && (
            <p className="text-xs text-gray-500 mb-2 leading-relaxed">
              В предпросмотре генерируется <strong className="font-medium text-gray-700">статический QR-код</strong> по этой ссылке.
              После привязки шаблона к динамическому QR-коду в печати подставится его реальная ссылка.
            </p>
          )}
          <input
            type="url" value={cfg.url} onChange={e => up("url", e.target.value)}
            placeholder="https://..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </Panel>

        {/* Business preset */}
        <Panel title="Тип бизнеса">
          <div className="grid grid-cols-3 gap-1.5">
            {BUSINESS_PRESETS.map(p => (
              <button key={p.id} onClick={() => { setPreset(p.id); if (p.id !== "custom") up("labels", [...p.labels]); }}
                className={`text-xs px-2 py-1.5 rounded-lg border transition-all text-left ${preset === p.id ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium" : "border-gray-200 hover:border-gray-300 text-gray-700"}`}>
                {p.name}
              </button>
            ))}
          </div>
        </Panel>

        {/* Labels + CTA */}
        <Panel title="Подписи и текст">
          {/* chips */}
          <div className="flex flex-wrap gap-1.5 min-h-[28px] mb-3">
            {cfg.labels.length === 0 && <span className="text-xs text-gray-400 italic self-center">Нет подписей</span>}
            {cfg.labels.map(l => (
              <span key={l} className="flex items-center gap-1 px-2.5 py-0.5 bg-gray-100 rounded-full text-xs font-medium text-gray-700">
                {l}
                <button onClick={() => up("labels", cfg.labels.filter(x => x !== l))} className="text-gray-400 hover:text-red-500 ml-0.5">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          {cfg.labels.length < 5 && (
            <div className="flex gap-2 mb-3">
              <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { const v = newLabel.trim().toUpperCase(); if (v && !cfg.labels.includes(v)) { up("labels", [...cfg.labels, v]); setNewLabel(""); } }}}
                placeholder="Добавить (Enter)" maxLength={18}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button onClick={() => { const v = newLabel.trim().toUpperCase(); if (v && !cfg.labels.includes(v)) { up("labels", [...cfg.labels, v]); setNewLabel(""); }}}
                className="px-2.5 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">
                <Plus size={14} />
              </button>
            </div>
          )}
          <div className="space-y-2.5">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Заголовок (крупный)</label>
              <div className="flex gap-1.5">
                <input type="text" value={cfg.headline} onChange={e => up("headline", e.target.value)} maxLength={24}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <button onClick={() => up("headline", "МЕНЮ")} className="p-1.5 border border-gray-200 rounded-lg text-gray-400 hover:text-gray-600"><RotateCcw size={13} /></button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Призыв под QR</label>
              <input type="text" value={cfg.ctaText} onChange={e => up("ctaText", e.target.value)} maxLength={30}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </Panel>

        {/* Format */}
        <Panel title="Формат">
          <div className="grid grid-cols-2 gap-2">
            {FORMATS.map(f => (
              <button key={f.id} onClick={() => up("formatId", f.id)}
                className={`flex flex-col items-center py-2.5 rounded-lg border-2 text-xs transition-all ${cfg.formatId === f.id ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                <span className="font-semibold">{f.name}</span>
                <span className="text-gray-400 mt-0.5">{f.sub}</span>
              </button>
            ))}
          </div>
        </Panel>

        {/* Layout (form / typography) */}
        <Panel title="Стиль оформления">
          <div className="grid grid-cols-4 gap-2">
            {LAYOUTS.map(l => {
              const active = (cfg.layoutId || layout.id) === l.id;
              return (
                <button key={l.id} onClick={() => up("layoutId", l.id)}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all ${active ? "border-indigo-500 ring-2 ring-indigo-200" : "border-gray-200 hover:border-gray-300"}`}>
                  <div className="rounded-lg overflow-hidden shadow-sm">
                    <LayoutThumb layout={l} palette={palette} />
                  </div>
                  <span className="text-[11px] text-gray-600 font-medium">{l.name}</span>
                </button>
              );
            })}
          </div>
        </Panel>

        {/* Palette (colors) */}
        <Panel title="Цветовая схема">
          <div className="grid grid-cols-4 gap-2">
            {PALETTES.map(p => {
              const active = (cfg.paletteId || palette.id) === p.id;
              return (
                <button key={p.id} onClick={() => up("paletteId", p.id)}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all ${active ? "border-indigo-500 ring-2 ring-indigo-200" : "border-gray-200 hover:border-gray-300"}`}>
                  <PaletteSwatch palette={p} />
                  <span className="text-[11px] text-gray-600 font-medium">{p.name}</span>
                </button>
              );
            })}
            {/* Custom brand color */}
            <button onClick={() => up("paletteId", "custom")}
              className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all ${cfg.paletteId === "custom" ? "border-indigo-500 ring-2 ring-indigo-200" : "border-gray-200 hover:border-gray-300"}`}>
              <PaletteSwatch palette={paletteFromBrand(cfg.brandColor || "#4F46E5")} custom />
              <span className="text-[11px] text-gray-600 font-medium">Свой</span>
            </button>
          </div>
          {cfg.paletteId === "custom" && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
              <label className="text-xs text-gray-600 flex-shrink-0">Цвет бренда</label>
              <input
                type="color"
                value={cfg.brandColor || "#4F46E5"}
                onChange={e => up("brandColor", e.target.value)}
                className="h-9 w-12 rounded border border-gray-200 cursor-pointer"
              />
              <input
                type="text"
                value={cfg.brandColor || "#4F46E5"}
                onChange={e => {
                  const v = e.target.value.trim();
                  if (/^#[0-9A-Fa-f]{6}$/.test(v) || /^#[0-9A-Fa-f]{3}$/.test(v)) up("brandColor", v);
                  else up("brandColor", v);
                }}
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                maxLength={7}
              />
            </div>
          )}
        </Panel>

        {/* QR dot style */}
        <Panel title="Стиль точек QR">
          <div className="grid grid-cols-4 gap-2">
            {(["squares", "rounded", "dots", "diamond", "cross", "hex", "bars", "star"] as DotStyle[]).map(s => (
              <div key={s} className="flex flex-col items-center gap-1">
                <DotBtn style={s} active={cfg.dotStyle === s} onClick={() => up("dotStyle", s)} />
                <span className="text-[10px] text-gray-500">{DOT_LABELS[s]}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Стиль глазков</p>
            <div className="grid grid-cols-3 gap-2">
              {(["square", "rounded", "dot", "circle", "leaf", "corners"] as EyeStyle[]).map(s => (
                <div key={s} className="flex flex-col items-center gap-1">
                  <EyeBtn style={s} active={cfg.eyeStyle === s} onClick={() => up("eyeStyle", s)} />
                  <span className="text-[10px] text-gray-500">{EYE_LABELS[s]}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* Print settings */}
        <Panel title="Настройки печати">
          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input type="checkbox" checked={cfg.showWatermark} onChange={e => up("showWatermark", e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-sm text-gray-700">Показывать «qrstars.ru»</span>
          </label>
          {isTemplate ? (
            <p className="text-xs text-gray-500 leading-relaxed">
              Шаблон можно использовать и с <strong className="font-medium text-gray-700">динамическими QR-кодами</strong> — выберите его в настройках QR и скачайте PDF табличку оттуда.
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700 whitespace-nowrap">Кол-во для PDF:</span>
              <input type="number" value={cfg.pdfCount} min={1} max={200}
                onChange={e => up("pdfCount", Math.max(1, Math.min(200, Number(e.target.value))))}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <span className="text-xs text-gray-400">= {pagesNeeded} стр. A4</span>
            </div>
          )}
        </Panel>

      </div>

      {/* ── Right: Preview ── */}
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sticky top-6">
          <div className="flex justify-between items-center mb-4">
            <span className="font-semibold text-gray-800">Предпросмотр</span>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{fmt.name} · {theme.name}</span>
          </div>

          {/* canvas */}
          <div className="flex justify-center mb-5"
            style={{ background: theme.shape === "circle" ? "repeating-conic-gradient(#f0f0f0 0% 25%,#fff 0% 50%) 0 0/16px 16px" : "#f9fafb", borderRadius: 12, padding: 16 }}>
            <div className="shadow-xl rounded-xl overflow-hidden">
              <canvas ref={previewRef}
                style={{ display: "block", width: fmt.previewW, height: fmt.previewH, maxWidth: "100%" }} />
            </div>
          </div>

          <div className="space-y-2.5">
            <button onClick={downloadPNG} disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:scale-[.98] transition-all font-medium text-sm disabled:opacity-50">
              <Download size={16} /> Скачать PNG
            </button>
            {!isTemplate && (
              <button onClick={downloadPDF} disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-lg hover:bg-black active:scale-[.98] transition-all font-medium text-sm disabled:opacity-50">
                <FileText size={16} /> Скачать PDF ({cfg.pdfCount} шт.)
              </button>
            )}
            {onSave && (
              <button onClick={() => onSave(cfg)} disabled={saving || busy}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 transition-all font-medium text-sm disabled:opacity-50">
                {saving ? "Сохранение…" : "Сохранить шаблон"}
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center mt-3">
            {Math.round(fmt.wMm * fmt.dpi / 25.4)} × {Math.round(fmt.hMm * fmt.dpi / 25.4)} px · {fmt.dpi} DPI
          </p>
        </div>
      </div>

    </div>
  );
}

/* ─── tiny helper ─── */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <p className="text-sm font-semibold text-gray-700 mb-3">{title}</p>
      {children}
    </div>
  );
}
