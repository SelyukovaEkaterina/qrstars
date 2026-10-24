/**
 * Генератор QR в кабинете: загрузка картинок и обёртки над общим движком `src/lib/qr-engine`
 * (тот же движок рисует бесплатный генератор на лендинге).
 */
import type { QRTemplateConfig } from "@/lib/qr-code-templates";
import {
  buildPayload,
  computeLayout,
  renderToCanvas,
  renderToSvg,
  QR_BASE_SIZE,
  type PayloadResult,
  type QrAssets,
  type QrLayout,
  type QrModules,
  type QrType,
} from "@/lib/qr-engine";

export {
  QR_SILHOUETTES,
  CENTER_TEXT_FONTS,
  centerTextFontStack,
  parseCenterTextLines,
  renderDotStylePreview,
  renderEyeStylePreview,
} from "@/lib/qr-engine";

export type QRContentType = QrType;

/** Статический QR: тип и значения полей (ключи — id полей из `qr-engine/payload.ts`). */
export interface QRContentState {
  type: QRContentType;
  fields: Record<string, string>;
}

export const DEFAULT_QR_CONTENT: QRContentState = {
  type: "url",
  fields: { "input-url": "https://qrstars.ru", "input-wifi-enc": "WPA" },
};

export function buildQRPayloadResult(content: QRContentState): PayloadResult {
  return buildPayload(content.type, (id) => content.fields[id] ?? "");
}

export function buildQRPayload(content: QRContentState): string | null {
  const res = buildQRPayloadResult(content);
  return res.kind === "ok" ? res.payload : null;
}

export interface LogoPreset {
  name: string;
  emoji?: string;
  src?: string;
}

export const FREE_LOGO_PRESETS: LogoPreset[] = [
  { name: "QrStars", src: "/logo.svg" },
  { name: "Клиника", emoji: "🏥" },
  { name: "Стоматология", emoji: "🦷" },
  { name: "Аптека", emoji: "💊" },
  { name: "Ветеринар", emoji: "🐾" },
  { name: "Кафе", emoji: "☕" },
  { name: "Ресторан", emoji: "🍽️" },
  { name: "Пиццерия", emoji: "🍕" },
  { name: "Суши", emoji: "🍣" },
  { name: "Бургерная", emoji: "🍔" },
  { name: "Пивной бар", emoji: "🍺" },
  { name: "Кондитерская", emoji: "🎂" },
  { name: "Парикмахерская", emoji: "💈" },
  { name: "Бьюти", emoji: "💅" },
  { name: "Фитнес", emoji: "🏋️" },
  { name: "Йога", emoji: "🧘" },
  { name: "Отель", emoji: "🏨" },
  { name: "Авто", emoji: "🚗" },
  { name: "Магазин", emoji: "🛍️" },
  { name: "Банк", emoji: "🏦" },
  { name: "Юрист", emoji: "⚖️" },
  { name: "Образование", emoji: "🎓" },
  { name: "Строительство", emoji: "🏗️" },
  { name: "Цветы", emoji: "🌸" },
  { name: "Музыка", emoji: "🎵" },
  { name: "Фото", emoji: "📷" },
  { name: "Собака", emoji: "🐕" },
  { name: "Корона", emoji: "👑" },
  { name: "Ракета", emoji: "🚀" },
  { name: "Молния", emoji: "⚡" },
  { name: "Глаз", emoji: "👁️" },
  { name: "Такси", emoji: "🚕" },
  { name: "Самолёт", emoji: "✈️" },
  { name: "Дом", emoji: "🏠" },
  { name: "Ключ", emoji: "🔑" },
  { name: "Подарок", emoji: "🎁" },
  { name: "Сердце", emoji: "❤️" },
  { name: "Звезда", emoji: "⭐" },
  { name: "Огонь", emoji: "🔥" },
  { name: "Кошка", emoji: "🐱" },
  { name: "Круг", emoji: "🎯" },
  // Новые — только в конец: на лендинге в ссылке хранится номер логотипа.
  { name: "Мастер", emoji: "🔨" },
  { name: "Ремонт", emoji: "🔧" },
  { name: "Сантехник", emoji: "🚿" },
  { name: "Клининг", emoji: "🧹" },
  { name: "Врач", emoji: "🩺" },
  { name: "Доставка", emoji: "📦" },
];

export const PHOTO_PRESETS = [
  { name: "Космос", src: "/photo-presets/cosmos.jpg" },
  { name: "Закат", src: "/photo-presets/sunset.jpg" },
  { name: "Лес", src: "/photo-presets/forest.jpg" },
  { name: "Мрамор", src: "/photo-presets/marble.jpg" },
  { name: "Цветы", src: "/photo-presets/flowers.jpg" },
];

function loadImage(src: string, crossOrigin = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Не удалось загрузить картинку: ${src.slice(0, 60)}`));
    img.src = src;
  });
}

/** Эмодзи рисуется на 512 px — при экспорте 2400 px логотип остаётся резким. */
export function emojiToImage(emoji: string): HTMLImageElement {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ectx = c.getContext("2d")!;
  ectx.font = `${size * 0.7}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ectx.textAlign = "center";
  ectx.textBaseline = "middle";
  ectx.fillText(emoji, size / 2, size / 2);
  const img = new Image();
  img.src = c.toDataURL();
  return img;
}

const emojiCache = new Map<string, Promise<HTMLImageElement>>();

/** Картинка эмодзи, уже готовая к drawImage: иначе первый кадр рисуется без логотипа. */
function loadEmoji(emoji: string): Promise<HTMLImageElement> {
  let p = emojiCache.get(emoji);
  if (!p) {
    const img = emojiToImage(emoji);
    p = img.decode().then(() => img, () => img);
    emojiCache.set(emoji, p);
  }
  return p;
}

export function loadLogoPreset(p: LogoPreset): Promise<HTMLImageElement> {
  if (p.src) return loadImage(p.src);
  if (p.emoji) return loadEmoji(p.emoji);
  return Promise.reject(new Error("empty preset"));
}

export async function resolveLogoImage(
  cfg: QRTemplateConfig,
  override?: HTMLImageElement | null,
): Promise<HTMLImageElement | null> {
  if (override) return override;
  try {
    if (cfg.logoDataUrl) return await loadImage(cfg.logoDataUrl);
    if (cfg.logoSrc) return await loadImage(cfg.logoSrc);
    if (cfg.logoPreset) return await loadEmoji(cfg.logoPreset);
  } catch {
    // Битый логотип не должен ломать весь QR.
  }
  return null;
}

/** Фото-режим хранится в шаблоне: ссылка на пресет или сжатая копия загруженного фото. */
export async function resolvePhotoImage(
  cfg: QRTemplateConfig,
  override?: HTMLImageElement | null,
): Promise<HTMLImageElement | null> {
  if (override) return override;
  try {
    if (cfg.photoDataUrl) return await loadImage(cfg.photoDataUrl);
    if (cfg.photoSrc) return await loadImage(cfg.photoSrc, true);
  } catch {
    /* без фото */
  }
  return null;
}

/**
 * Ужимает загруженную картинку перед сохранением в шаблон: исходники по 5 МБ
 * раздували каждый ответ `/api/qrcodes`.
 */
export function compressImageToDataUrl(
  img: HTMLImageElement,
  maxSide: number,
  type: "image/png" | "image/jpeg",
  quality = 0.85,
): string {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL(type, quality);
}

/** Своя фигура для силуэта (пресеты рисуются из путей в движке). */
export async function resolveSilhouetteImage(
  cfg: QRTemplateConfig,
  override?: HTMLImageElement | null,
): Promise<HTMLImageElement | null> {
  if (cfg.silhouette !== "custom") return null;
  if (override) return override;
  try {
    if (cfg.silhouetteDataUrl) return await loadImage(cfg.silhouetteDataUrl);
  } catch {
    /* без фигуры — обычный квадратный код */
  }
  return null;
}

export interface RenderFreeQROptions {
  logoImage?: HTMLImageElement | null;
  photoImage?: HTMLImageElement | null;
  silhouetteImage?: HTMLImageElement | null;
  /** Размер самого кода в пикселях (рамка и узор добавляются сверху). */
  qrSize?: number;
}

export interface PreparedQR {
  layout: QrLayout;
  assets: QrAssets;
}

/** Матрица модулей, загрузка логотипа/фото и раскладка — общая часть PNG и SVG. */
export async function prepareFreeQR(
  cfg: QRTemplateConfig,
  payload: string,
  options: RenderFreeQROptions = {},
): Promise<PreparedQR> {
  const QRLib = await import("qrcode");
  const modules = QRLib.create(payload, { errorCorrectionLevel: cfg.ecc }).modules as unknown as QrModules;
  const [logo, photo, silhouette] = await Promise.all([
    cfg.centerMode === "text" ? Promise.resolve(null) : resolveLogoImage(cfg, options.logoImage),
    resolvePhotoImage(cfg, options.photoImage),
    resolveSilhouetteImage(cfg, options.silhouetteImage),
  ]);
  const assets: QrAssets = { logo, photo, silhouette };
  return { layout: computeLayout(modules, cfg, assets), assets };
}

/** Рисует QR на canvas. Возвращает раскладку — по ней проверяется сканируемость. */
export async function renderFreeQR(
  canvas: HTMLCanvasElement,
  cfg: QRTemplateConfig,
  payload: string,
  options: RenderFreeQROptions = {},
): Promise<QrLayout> {
  const { layout, assets } = await prepareFreeQR(cfg, payload, options);
  const qrSize = options.qrSize ?? QR_BASE_SIZE;
  renderToCanvas(canvas, layout, cfg, assets, layout.canvasW * (qrSize / QR_BASE_SIZE));
  return layout;
}

/** Векторный SVG той же отрисовкой, что и PNG. */
export async function renderFreeQRSvg(
  cfg: QRTemplateConfig,
  payload: string,
  options: Omit<RenderFreeQROptions, "qrSize"> = {},
): Promise<string> {
  const { layout, assets } = await prepareFreeQR(cfg, payload, options);
  return renderToSvg(layout, cfg, assets);
}
