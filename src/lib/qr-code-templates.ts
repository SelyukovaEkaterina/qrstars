import { renderFreeQR, FREE_LOGO_PRESETS } from "@/lib/qr-free-generator";

export type QRDotStyle = "classic" | "rounded";
export type QREyeStyle = "square" | "rounded" | "circle" | "leaf" | "dot";
export type QRGradientType = "linear-tb" | "linear-lr" | "linear-diag" | "radial";
export type QRFrameStyle = "bottom" | "rounded" | "ribbon";
export type QRScatterShape = "square" | "circle" | "star" | "diamond" | "hexagon" | "heart" | "cross" | "octagon" | "triangle";
export type QRCenterMode = "image" | "text";
export type QRCenterTextFont = "inter" | "sans" | "serif" | "mono" | "display";

export interface QRTemplateConfig {
  dotStyle: QRDotStyle;
  eyeStyle: QREyeStyle;
  fg: string;
  bg: string;
  bgTransparent: boolean;
  gradient: boolean;
  grad1: string;
  grad2: string;
  gradType: QRGradientType;
  eyeCustom: boolean;
  eyeColor: string;
  /** @deprecated use logoSrc / logoDataUrl — emoji fallback */
  logoPreset: string | null;
  logoSrc: string | null;
  logoDataUrl: string | null;
  logoFill: boolean;
  logoSize: number;
  centerMode: QRCenterMode;
  /** До 3 строк, разделитель — перевод строки */
  centerText: string;
  centerTextFont: QRCenterTextFont;
  centerTextColor: string;
  centerTextBold: boolean;
  frame: boolean;
  frameText: string;
  frameStyle: QRFrameStyle;
  ecc: "L" | "M" | "Q" | "H";
  margin: number;
  scatter: boolean;
  scatterDensity: number;
  scatterShape: QRScatterShape;
}

export interface QRTemplatePreset {
  id: string;
  name: string;
  description: string;
  accent: string;
  config: QRTemplateConfig;
}

function defaultCfg(): Omit<QRTemplateConfig, "dotStyle" | "eyeStyle" | "fg" | "bg" | "gradient" | "grad1" | "grad2" | "gradType" | "ecc" | "margin"> {
  return {
    bgTransparent: false,
    eyeCustom: false,
    eyeColor: "#4f46e5",
    logoPreset: null,
    logoSrc: null,
    logoDataUrl: null,
    logoFill: true,
    logoSize: 22,
    centerMode: "image",
    centerText: "",
    centerTextFont: "inter",
    centerTextColor: "#1e293b",
    centerTextBold: true,
    frame: false,
    frameText: "СКАНИРУЙ МЕНЯ",
    frameStyle: "bottom",
    scatter: false,
    scatterDensity: 3,
    scatterShape: "square",
  };
}

/** Stable Template.id for a built-in preset (public row in DB). */
export function qrStylePresetTemplateId(presetId: string): string {
  return `qr-preset-${presetId}`;
}

export function isBuiltInQrStyleTemplateId(id: string): boolean {
  return id.startsWith("qr-preset-");
}

export type QrStyleTemplateSource = {
  id: string;
  name?: string;
  layout?: unknown;
};

/** Resolve QR style config from template id and optional DB rows / layout list. */
export function resolveQrStyleConfig(
  templateId: string | null | undefined,
  templates: QrStyleTemplateSource[] = [],
): QRTemplateConfig | null {
  if (!templateId) return null;
  const tpl = templates.find((t) => t.id === templateId);
  const fromDb = (tpl?.layout as { config?: QRTemplateConfig } | undefined)?.config;
  if (fromDb) return normalizeQRTemplateConfig(fromDb);
  if (templateId.startsWith("qr-preset-")) {
    const presetId = templateId.slice("qr-preset-".length);
    const preset = QR_CODE_TEMPLATES.find((p) => p.id === presetId);
    return preset ? normalizeQRTemplateConfig(preset.config) : null;
  }
  return null;
}

export function resolveQrStyleName(
  templateId: string | null | undefined,
  templates: QrStyleTemplateSource[] = [],
): string | null {
  if (!templateId) return null;
  const tpl = templates.find((t) => t.id === templateId);
  if (tpl?.name) return tpl.name;
  const preset = QR_CODE_TEMPLATES.find((p) => qrStylePresetTemplateId(p.id) === templateId);
  return preset?.name ?? null;
}

export const QR_CODE_TEMPLATES: QRTemplatePreset[] = [
  {
    id: "classic",
    name: "Классика",
    description: "Универсальный чёрно-белый QR — подойдёт любому бизнесу",
    accent: "#1e293b",
    config: {
      ...defaultCfg(),
      dotStyle: "rounded",
      eyeStyle: "rounded",
      fg: "#1e293b",
      bg: "#ffffff",
      gradient: false,
      grad1: "#4f46e5",
      grad2: "#a855f7",
      gradType: "linear-tb",
      ecc: "H",
      margin: 2,
    },
  },
  {
    id: "dentistry",
    name: "Стоматология",
    description: "Чистый бирюзовый стиль с иконкой зуба — для клиник и стоматологий",
    accent: "#0891b2",
    config: {
      ...defaultCfg(),
      dotStyle: "rounded",
      eyeStyle: "circle",
      fg: "#0891b2",
      bg: "#f0fdfa",
      gradient: true,
      grad1: "#06b6d4",
      grad2: "#0891b2",
      gradType: "linear-tb",
      eyeCustom: true,
      eyeColor: "#0e7490",
      logoPreset: "🦷",
      logoSize: 24,
      logoFill: true,
      frame: true,
      frameText: "НАВЕДИТЕ КАМЕРУ",
      frameStyle: "bottom",
      ecc: "H",
      margin: 2,
    },
  },
  {
    id: "cafe",
    name: "Кафе",
    description: "Тёплые кофейные оттенки с чашкой — идеально для кофейни",
    accent: "#92400e",
    config: {
      ...defaultCfg(),
      dotStyle: "rounded",
      eyeStyle: "leaf",
      fg: "#92400e",
      bg: "#fffbeb",
      gradient: true,
      grad1: "#b45309",
      grad2: "#78350f",
      gradType: "linear-diag",
      eyeCustom: true,
      eyeColor: "#78350f",
      logoPreset: "☕",
      logoSize: 26,
      logoFill: true,
      frame: true,
      frameText: "МЕНЮ / ОТЗЫВ",
      frameStyle: "ribbon",
      ecc: "H",
      margin: 2,
    },
  },
  {
    id: "restaurant",
    name: "Ресторан",
    description: "Премиальный тёмный стиль с золотым акцентом",
    accent: "#b8860b",
    config: {
      ...defaultCfg(),
      dotStyle: "classic",
      eyeStyle: "rounded",
      fg: "#d4af37",
      bg: "#1a0a0a",
      gradient: true,
      grad1: "#ca8a04",
      grad2: "#fef08a",
      gradType: "linear-lr",
      eyeCustom: true,
      eyeColor: "#fbbf24",
      logoPreset: "🍽️",
      logoSize: 24,
      logoFill: false,
      frame: true,
      frameText: "СКАНИРУЙТЕ QR-КОД",
      frameStyle: "bottom",
      ecc: "H",
      margin: 2,
    },
  },
  {
    id: "beauty",
    name: "Бьюти-салон",
    description: "Нежный розовый градиент с сердечками — для салонов красоты",
    accent: "#ec4899",
    config: {
      ...defaultCfg(),
      dotStyle: "rounded",
      eyeStyle: "dot",
      fg: "#db2777",
      bg: "#fdf2f8",
      gradient: true,
      grad1: "#f472b6",
      grad2: "#be185d",
      gradType: "radial",
      eyeCustom: true,
      eyeColor: "#9d174d",
      logoPreset: "💅",
      logoSize: 26,
      scatter: true,
      scatterDensity: 3,
      scatterShape: "heart",
      ecc: "H",
      margin: 2,
    },
  },
  {
    id: "bar",
    name: "Бар",
    description: "Тёмный янтарный стиль — для баров и пабов",
    accent: "#f59e0b",
    config: {
      ...defaultCfg(),
      dotStyle: "rounded",
      eyeStyle: "square",
      fg: "#f59e0b",
      bg: "#171717",
      gradient: true,
      grad1: "#f59e0b",
      grad2: "#dc2626",
      gradType: "linear-diag",
      eyeCustom: true,
      eyeColor: "#fbbf24",
      logoPreset: "🍺",
      logoSize: 24,
      logoFill: false,
      frame: true,
      frameText: "СКАНИРУЙ МЕНЯ",
      frameStyle: "rounded",
      ecc: "H",
      margin: 2,
    },
  },
  {
    id: "hotel",
    name: "Отель",
    description: "Элегантный тёмно-синий с золотом — для отелей и гостиниц",
    accent: "#818cf8",
    config: {
      ...defaultCfg(),
      dotStyle: "rounded",
      eyeStyle: "leaf",
      fg: "#e2e8f0",
      bg: "#0f172a",
      gradient: true,
      grad1: "#94a3b8",
      grad2: "#fbbf24",
      gradType: "linear-tb",
      eyeCustom: true,
      eyeColor: "#fbbf24",
      logoPreset: "🏨",
      logoSize: 24,
      logoFill: false,
      frame: true,
      frameText: "WELCOME",
      frameStyle: "ribbon",
      ecc: "H",
      margin: 2,
    },
  },
  {
    id: "fitness",
    name: "Фитнес",
    description: "Энергичный оранжево-красный — для залов и студий",
    accent: "#ea580c",
    config: {
      ...defaultCfg(),
      dotStyle: "classic",
      eyeStyle: "circle",
      fg: "#ea580c",
      bg: "#ffffff",
      gradient: true,
      grad1: "#f97316",
      grad2: "#dc2626",
      gradType: "linear-diag",
      eyeCustom: true,
      eyeColor: "#c2410c",
      logoPreset: "🏋️",
      logoSize: 26,
      scatter: true,
      scatterDensity: 2,
      scatterShape: "hexagon",
      ecc: "H",
      margin: 2,
    },
  },
  {
    id: "pharmacy",
    name: "Аптека",
    description: "Свежий зелёный медицинский стиль — для аптек и клиник",
    accent: "#059669",
    config: {
      ...defaultCfg(),
      dotStyle: "rounded",
      eyeStyle: "leaf",
      fg: "#059669",
      bg: "#ecfdf5",
      gradient: true,
      grad1: "#10b981",
      grad2: "#047857",
      gradType: "linear-lr",
      eyeCustom: true,
      eyeColor: "#065f46",
      logoPreset: "💊",
      logoSize: 24,
      logoFill: true,
      frame: true,
      frameText: "СКАНИРУЙТЕ",
      frameStyle: "bottom",
      ecc: "H",
      margin: 2,
    },
  },
  {
    id: "auto",
    name: "Автосервис",
    description: "Стильный тёмный с оранжевым акцентом — для автосервисов",
    accent: "#f97316",
    config: {
      ...defaultCfg(),
      dotStyle: "rounded",
      eyeStyle: "rounded",
      fg: "#f97316",
      bg: "#18181b",
      gradient: true,
      grad1: "#fb923c",
      grad2: "#ea580c",
      gradType: "linear-lr",
      eyeCustom: true,
      eyeColor: "#fdba74",
      logoPreset: "🚗",
      logoSize: 24,
      logoFill: false,
      ecc: "H",
      margin: 2,
    },
  },
];

export const DEFAULT_QR_CONFIG: QRTemplateConfig = { ...QR_CODE_TEMPLATES[0].config };

export const COLOR_PRESETS = [
  { name: "Классика", fg: "#1e293b", bg: "#ffffff", gradient: false },
  { name: "Индиго", fg: "#4f46e5", bg: "#ffffff", gradient: false },
  { name: "Океан", fg: "#0284c7", bg: "#f0f9ff", gradient: false },
  { name: "Изумруд", fg: "#059669", bg: "#ffffff", gradient: false },
  { name: "Закат", gradient: true, grad1: "#f97316", grad2: "#dc2626", gradType: "linear-diag" as QRGradientType, fg: "#f97316", bg: "#ffffff" },
  { name: "Фиолет", gradient: true, grad1: "#4f46e5", grad2: "#a855f7", gradType: "linear-tb" as QRGradientType, fg: "#4f46e5", bg: "#ffffff" },
  { name: "Неон", gradient: true, grad1: "#06b6d4", grad2: "#8b5cf6", gradType: "linear-lr" as QRGradientType, fg: "#06b6d4", bg: "#0f172a" },
  { name: "Розовый", gradient: true, grad1: "#ec4899", grad2: "#f43f5e", gradType: "radial" as QRGradientType, fg: "#ec4899", bg: "#ffffff" },
  { name: "Полночь", fg: "#f8fafc", bg: "#0f172a", gradient: false },
  { name: "Золото", gradient: true, grad1: "#ca8a04", grad2: "#fbbf24", gradType: "linear-tb" as QRGradientType, fg: "#ca8a04", bg: "#1c1917" },
];

export {
  CENTER_TEXT_FONTS,
  FREE_LOGO_PRESETS as LOGO_PRESETS,
  parseCenterTextLines,
} from "@/lib/qr-free-generator";

export const SCATTER_SHAPES: { id: QRScatterShape; label: string }[] = [
  { id: "square", label: "Квадрат" },
  { id: "circle", label: "Круг" },
  { id: "star", label: "Звезда" },
  { id: "diamond", label: "Ромб" },
  { id: "hexagon", label: "Соты" },
  { id: "heart", label: "Сердце" },
  { id: "cross", label: "Крест" },
  { id: "octagon", label: "Октагон" },
  { id: "triangle", label: "Треуг." },
];

/** Backfill new logo fields for templates saved before logoSrc/logoFill */
function hasCenterTextContent(text: string | undefined): boolean {
  return (text ?? "")
    .split("\n")
    .some((l) => l.trim().length > 0);
}

export function normalizeQRTemplateConfig(cfg: QRTemplateConfig): QRTemplateConfig {
  const hasLogo = !!(cfg.logoPreset || cfg.logoSrc || cfg.logoDataUrl);
  const hasText = hasCenterTextContent(cfg.centerText);
  let centerMode: QRCenterMode = cfg.centerMode ?? "image";
  if (centerMode === "image" && !hasLogo && hasText) centerMode = "text";
  if (centerMode === "text" && !hasText && hasLogo) centerMode = "image";

  return {
    ...defaultCfg(),
    ...cfg,
    logoSrc: cfg.logoSrc ?? null,
    logoDataUrl: cfg.logoDataUrl ?? null,
    logoFill: cfg.logoFill ?? true,
    centerMode,
    centerText: cfg.centerText ?? "",
    centerTextFont: cfg.centerTextFont ?? "inter",
    centerTextColor: cfg.centerTextColor ?? "#1e293b",
    centerTextBold: cfg.centerTextBold ?? true,
  };
}


export async function renderQRTemplate(
  canvas: HTMLCanvasElement,
  cfg: QRTemplateConfig,
  text: string = "https://qrstars.ru",
  size: number = 600,
  photoImage?: HTMLImageElement | null,
  logoImage?: HTMLImageElement | null,
): Promise<void> {
  const normalized = normalizeQRTemplateConfig(cfg);
  await renderFreeQR(canvas, normalized, text, {
    qrSize: size,
    photoImage: photoImage ?? null,
    logoImage: logoImage ?? null,
  });
}

export function randomizeQRConfig(): QRTemplateConfig {
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const rHex = () => "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0");
  const dotStyles: QRDotStyle[] = ["classic", "rounded"];
  const eyeStyles: QREyeStyle[] = ["square", "rounded", "circle", "leaf", "dot"];
  const gradTypes: QRGradientType[] = ["linear-tb", "linear-lr", "linear-diag", "radial"];
  const frameStyles: QRFrameStyle[] = ["bottom", "rounded", "ribbon"];
  const scatterShapes: QRScatterShape[] = ["square", "circle", "star", "diamond", "hexagon", "heart", "cross", "octagon", "triangle"];
  const gradient = Math.random() > 0.5;
  const eyeCustom = Math.random() > 0.5;
  const hasLogo = Math.random() > 0.6;
  const hasFrame = Math.random() > 0.6;
  const hasScatter = Math.random() > 0.7;
  const preset = hasLogo
    ? FREE_LOGO_PRESETS[Math.floor(Math.random() * FREE_LOGO_PRESETS.length)]
    : null;
  return {
    dotStyle: pick(dotStyles),
    eyeStyle: pick(eyeStyles),
    fg: gradient ? rHex() : pick(COLOR_PRESETS).fg,
    bg: pick(COLOR_PRESETS).bg,
    bgTransparent: false,
    gradient,
    grad1: rHex(),
    grad2: rHex(),
    gradType: pick(gradTypes),
    eyeCustom,
    eyeColor: rHex(),
    logoPreset: preset?.emoji ?? null,
    logoSrc: preset?.src ?? null,
    logoDataUrl: null,
    logoFill: Math.random() > 0.3,
    logoSize: 15 + Math.floor(Math.random() * 16),
    frame: hasFrame,
    frameText: pick(["СКАНИРУЙ МЕНЯ", "СКАНИРУЙТЕ QR", "ОТСКАНИРУЙТЕ", "НАВЕДИТЕ КАМЕРУ"]),
    frameStyle: pick(frameStyles),
    ecc: pick(["M", "Q", "H"] as const),
    margin: Math.floor(Math.random() * 4),
    scatter: hasScatter,
    scatterDensity: 2 + Math.floor(Math.random() * 5),
    scatterShape: pick(scatterShapes),
    centerMode: hasLogo ? "image" : "image",
    centerText: "",
    centerTextFont: "inter",
    centerTextColor: pick(COLOR_PRESETS).fg,
    centerTextBold: true,
  };
}

/** CSS size for a canvas preview, preserving aspect ratio inside a maxSide box. */
export function canvasDisplaySize(
  canvasWidth: number,
  canvasHeight: number,
  maxSide: number,
): { width: number; height: number } {
  if (canvasWidth <= 0 || canvasHeight <= 0) {
    return { width: maxSide, height: maxSide };
  }
  const scale = Math.min(maxSide / canvasWidth, maxSide / canvasHeight);
  return {
    width: Math.round(canvasWidth * scale),
    height: Math.round(canvasHeight * scale),
  };
}

export function downloadQRTemplateAsPNG(canvas: HTMLCanvasElement, filename: string = "qr-code") {
  const a = document.createElement("a");
  a.download = `${filename}.png`;
  a.href = canvas.toDataURL("image/png", 1.0);
  a.click();
}

/** Styled QR is canvas-rendered; SVG wraps the raster for print/design handoff. */
export function downloadQRTemplateAsSVG(canvas: HTMLCanvasElement, filename: string = "qr-code") {
  const w = canvas.width;
  const h = canvas.height;
  const pngData = canvas.toDataURL("image/png", 1.0);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <image width="${w}" height="${h}" xlink:href="${pngData}"/>
</svg>`;
  downloadSvgString(svg, filename);
}

export function downloadSvgString(svg: string, filename: string = "qr-code") {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.download = `${filename}.svg`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadQRTemplateAsJPG(canvas: HTMLCanvasElement, filename: string = "qr-code") {
  const tmp = document.createElement("canvas");
  tmp.width = canvas.width; tmp.height = canvas.height;
  const ctx = tmp.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, tmp.width, tmp.height);
  ctx.drawImage(canvas, 0, 0);
  const a = document.createElement("a");
  a.download = `${filename}.jpg`;
  a.href = tmp.toDataURL("image/jpeg", 0.92);
  a.click();
}
