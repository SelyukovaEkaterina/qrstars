/**
 * Общий движок QR-кодов: кабинет (`src/lib/qr-code-templates.ts`) и генератор на лендинге
 * (`landing/src/pages/free-qr-generator.astro`). Только относительные импорты и никаких
 * зависимостей — лендинг собирается отдельно и подключает эти файлы напрямую.
 */

export type QrDotStyle = "classic" | "rounded";
export type QrEyeStyle = "square" | "rounded" | "circle" | "leaf" | "dot";
export type QrGradientType = "linear-tb" | "linear-lr" | "linear-diag" | "radial";
export type QrFrameStyle = "bottom" | "rounded" | "ribbon";
export type QrScatterShape =
  | "square"
  | "circle"
  | "star"
  | "diamond"
  | "hexagon"
  | "heart"
  | "cross"
  | "octagon"
  | "triangle";
export type QrCenterMode = "image" | "text";
export type QrCenterTextFont = "inter" | "sans" | "serif" | "mono" | "display";
export type QrEcc = "L" | "M" | "Q" | "H";

/** Оформление, которое нужно отрисовке. `QRTemplateConfig` кабинета — надмножество. */
export interface QrDesign {
  dotStyle: QrDotStyle;
  eyeStyle: QrEyeStyle;
  fg: string;
  bg: string;
  bgTransparent: boolean;
  gradient: boolean;
  grad1: string;
  grad2: string;
  gradType: QrGradientType;
  eyeCustom: boolean;
  eyeColor: string;
  logoSize: number;
  /** true — точки идут под логотипом/текстом, false — под ними плашка цвета фона. */
  logoFill: boolean;
  centerMode?: QrCenterMode;
  /** До 3 строк, разделитель — перевод строки. */
  centerText?: string;
  centerTextFont?: QrCenterTextFont;
  centerTextColor?: string;
  centerTextBold?: boolean;
  frame: boolean;
  frameText: string;
  frameStyle: QrFrameStyle;
  ecc: QrEcc;
  margin: number;
  scatter: boolean;
  scatterDensity: number;
  scatterShape: QrScatterShape;
}

/** Матрица модулей из `QRCode.create(...).modules` (библиотека `qrcode`). */
export interface QrModules {
  size: number;
  data: ArrayLike<number | boolean>;
}

export interface QrAssets {
  /** Готовая к отрисовке картинка логотипа (уже загружена). */
  logo?: CanvasImageSource | null;
  photo?: HTMLImageElement | HTMLCanvasElement | null;
}
