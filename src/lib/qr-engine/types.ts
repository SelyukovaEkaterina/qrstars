/**
 * Общий движок QR-кодов: кабинет (`src/lib/qr-code-templates.ts`) и генератор на лендинге
 * (`landing/src/pages/free-qr-generator.astro`). Только относительные импорты и никаких
 * зависимостей — лендинг собирается отдельно и подключает эти файлы напрямую.
 */

export type QrDotStyle =
  | "classic"
  | "rounded"
  | "dots"
  | "diamond"
  | "liquid"
  /** Жидкие модули вокруг логотипа, точки — дальше от центра. */
  | "splash"
  /** Каждый модуль — растр из 3×3 точек, как в офсетной печати. */
  | "halftone";
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
/** `overlay` — фото фоном под полупрозрачными модулями, `halftone` — гравюра: фото дизерингом, модули точками в центре клетки. */
export type QrPhotoStyle = "overlay" | "halftone";
export type QrSilhouette =
  | "none"
  | "heart"
  | "tooth"
  | "cat"
  | "cloud"
  | "bubble"
  | "shield"
  | "drop"
  | "house"
  | "cup"
  | "circle"
  | "gear"
  | "pin"
  | "cross"
  | "car"
  | "bag"
  | "shirt"
  | "paw"
  | "star"
  | "hexagon"
  | "crown"
  /** Своя картинка: прозрачный PNG или тёмный силуэт на светлом фоне. */
  | "custom";

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
  photoStyle?: QrPhotoStyle;
  /** Код внутри фигуры, остальная фигура засыпается декоративными модулями. Рамка и узор при этом не рисуются. */
  silhouette?: QrSilhouette;
  /** Размер кода относительно самого большого квадрата, вписанного в фигуру, 50–100 %. */
  silhouetteFit?: number;
  /** Код повёрнут ромбом. Рамка при этом не рисуется, логотип остаётся ровным. */
  rotate45?: boolean;
  /** Сдвинутые голубой и жёлтый слои под модулями — эффект офсетной печати. */
  inkShift?: boolean;
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
  /** Картинка для `silhouette: "custom"`. */
  silhouette?: CanvasImageSource | null;
}
