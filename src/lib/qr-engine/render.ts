/**
 * Отрисовка оформленного QR. Вся геометрия считается в базовых координатах (QR = 600),
 * масштаб задаёт `ctx.scale` — превью, PNG любого размера и SVG выглядят одинаково.
 */
import type { QrAssets, QrCenterTextFont, QrDesign, QrDotStyle, QrEyeStyle, QrModules, QrScatterShape } from "./types";
import { SvgContext } from "./svg-context";
import {
  alignmentCenters,
  autoLevels,
  biasTowardModules,
  brightenForHalftone,
  cellNoise,
  ditherHalftone,
  fitSilhouette,
  halftoneForcedMap,
  silhouetteMask,
  HALFTONE_RES,
} from "./art";

export const QR_BASE_SIZE = 600;
const FRAME_BAR_H = 80;
const FRAME_PAD = 36;
const RIBBON_NOTCH = 14;

export const CENTER_TEXT_FONTS: { id: QrCenterTextFont; label: string; stack: string }[] = [
  { id: "inter", label: "Inter", stack: "Inter, system-ui, sans-serif" },
  { id: "sans", label: "Без засечек", stack: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" },
  { id: "serif", label: "С засечками", stack: 'Georgia, "Times New Roman", serif' },
  { id: "mono", label: "Моноширинный", stack: 'ui-monospace, "Courier New", monospace' },
  { id: "display", label: "Акцидент", stack: 'Impact, "Arial Black", sans-serif' },
];

export function parseCenterTextLines(text: string | undefined): string[] {
  return (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export function centerTextFontStack(id: QrCenterTextFont | undefined): string {
  return CENTER_TEXT_FONTS.find((f) => f.id === id)?.stack ?? CENTER_TEXT_FONTS[0].stack;
}

/** Декоративные модули вне кода (силуэт или узор вокруг). Координаты — в модулях кода. */
export interface QrFiller {
  /** Модульные координаты клетки (0, 0) сетки. */
  r0: number;
  c0: number;
  rows: number;
  cols: number;
  cells: Uint8Array;
  /** Узор вокруг кода красится своим градиентом, силуэт — общим с кодом. */
  ownFill: { x0: number; y0: number; x1: number; y1: number } | null;
}

export interface QrLayout {
  modules: QrModules;
  count: number;
  /** Поле вокруг кода в модулях (с силуэтом — не меньше 1). */
  margin: number;
  cellSize: number;
  qrSize: number;
  canvasW: number;
  canvasH: number;
  /** Холст до поворота: в этих координатах рисуется всё, кроме логотипа. Без поворота = canvasW/H. */
  innerW: number;
  innerH: number;
  rotated: boolean;
  qrLeft: number;
  qrTop: number;
  offX: number;
  offY: number;
  /** Центр кода на итоговом холсте — туда встаёт логотип. */
  centerX: number;
  centerY: number;
  /** Участок, который проверяется декодером, — в координатах до поворота (`innerW × innerH`). */
  scanBox: { x: number; y: number; w: number; h: number };
  frameOn: boolean;
  captionH: number;
  ribbonH: number;
  framePad: number;
  filler: QrFiller | null;
  /** Выравнивающие узоры (1) — в «точечных» стилях рисуются сплошными, иначе камера теряет сетку. */
  alignment: Uint8Array | null;
  /** Модули под плашкой логотипа: не рисуются, жидкие соседи вокруг скругляются. */
  hidden: Uint8Array | null;
  /** Фото-гравюра: 1 — тёмный субпиксель, сторона (count + 2·margin)·HALFTONE_RES. */
  halftone: Uint8Array | null;
}

// ── Геометрия ────────────────────────────────────────────────────────────────

function coverCrop(iw: number, ih: number, w: number, h: number) {
  let sx = 0, sy = 0, sw = iw, sh = ih;
  if (iw / ih > w / h) {
    sw = ih * (w / h);
    sx = (iw - sw) / 2;
  } else {
    sh = iw / (w / h);
    sy = (ih - sh) / 2;
  }
  return { sx, sy, sw, sh };
}

function imageSize(img: CanvasImageSource): [number, number] {
  const el = img as HTMLImageElement;
  return [el.naturalWidth || (img as HTMLCanvasElement).width || 1, el.naturalHeight || (img as HTMLCanvasElement).height || 1];
}

/** Насколько пиксели модуля тянутся к его значению (0–255). */
const HALFTONE_BIAS = 15;

function buildHalftone(L: QrLayout, img: HTMLImageElement | HTMLCanvasElement): Uint8Array | null {
  const side = (L.count + L.margin * 2) * HALFTONE_RES;
  const c = document.createElement("canvas");
  c.width = side;
  c.height = side;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const [iw, ih] = imageSize(img);
  const { sx, sy, sw, sh } = coverCrop(iw, ih, side, side);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, side, side);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, side, side);
  const px = ctx.getImageData(0, 0, side, side).data;
  const lum = new Float32Array(side * side);
  for (let i = 0; i < lum.length; i++) lum[i] = 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2];
  autoLevels(lum);
  brightenForHalftone(lum);
  biasTowardModules(lum, L.modules.data, L.count, L.margin, HALFTONE_BIAS);
  return ditherHalftone(lum, side, side, halftoneForcedMap(L.modules.data, L.count, L.margin));
}

/** Узор вокруг кода: те же клетки, что рисовались раньше (форма контура, каждая вторая наугад). */
function buildScatterFiller(count: number, d: QrDesign, offX: number, offY: number, cellSize: number): QrFiller {
  const cellsOut = d.scatterDensity;
  const center = (count - 1) / 2;
  const outerR = center + cellsOut;
  const side = count + cellsOut * 2;
  const cells = new Uint8Array(side * side);
  for (let r = -cellsOut; r < count + cellsOut; r++) {
    for (let c = -cellsOut; c < count + cellsOut; c++) {
      if (r >= 0 && r < count && c >= 0 && c < count) continue;
      if (!isInsideScatterShape(c - center, r - center, d.scatterShape, outerR)) continue;
      if (cellNoise(r * 997 + c + 7) < 0.5) continue;
      cells[(r + cellsOut) * side + c + cellsOut] = 1;
    }
  }
  return {
    r0: -cellsOut,
    c0: -cellsOut,
    rows: side,
    cols: side,
    cells,
    ownFill: {
      x0: offX - cellsOut * cellSize,
      y0: offY - cellsOut * cellSize,
      x1: offX + (count + cellsOut) * cellSize,
      y1: offY + (count + cellsOut) * cellSize,
    },
  };
}

export function computeLayout(modules: QrModules, d: QrDesign, assets: QrAssets = {}): QrLayout {
  const qrSize = QR_BASE_SIZE;
  const count = modules.size;
  const mask = d.silhouette && d.silhouette !== "none" ? silhouetteMask(d.silhouette, assets.silhouette) : null;
  // Силуэту и гравюре нужно светлое кольцо вокруг кода — поле не меньше модуля.
  const halftonePhoto = !!assets.photo && d.photoStyle === "halftone";
  const margin = mask || halftonePhoto ? Math.max(1, d.margin) : d.margin;
  const qrCells = count + margin * 2;
  const cellSize = qrSize / qrCells;
  const fit = mask ? fitSilhouette(mask, qrCells, d.silhouetteFit ?? 100) : null;
  const rotated = !!d.rotate45;
  const frameOn = d.frame && !fit && !rotated;
  const captionH = frameOn && d.frameStyle === "bottom" ? FRAME_BAR_H : 0;
  const ribbonH = frameOn && d.frameStyle === "ribbon" ? FRAME_BAR_H : 0;
  const framePad = frameOn && d.frameStyle === "rounded" ? FRAME_PAD : 0;

  let innerW: number, innerH: number, qrLeft: number, qrTop: number;
  let filler: QrFiller | null = null;
  if (fit) {
    innerW = fit.cols * cellSize;
    innerH = fit.rows * cellSize;
    qrLeft = fit.qrCol * cellSize;
    qrTop = fit.qrRow * cellSize;
    const cells = new Uint8Array(fit.cols * fit.rows);
    const r0 = -(fit.qrRow + margin);
    const c0 = -(fit.qrCol + margin);
    for (let gr = 0; gr < fit.rows; gr++) {
      for (let gc = 0; gc < fit.cols; gc++) {
        const r = gr + r0;
        const c = gc + c0;
        // Код и белое кольцо вокруг него не засыпаем.
        if (r >= -margin && r < count + margin && c >= -margin && c < count + margin) continue;
        if (fit.inside[gr * fit.cols + gc] && cellNoise(r * 997 + c + 7) >= 0.5) cells[gr * fit.cols + gc] = 1;
      }
    }
    filler = { r0, c0, rows: fit.rows, cols: fit.cols, cells, ownFill: null };
  } else {
    const scatterPad = (d.scatter ? d.scatterDensity : 0) * cellSize;
    innerW = qrSize + framePad * 2 + scatterPad * 2;
    innerH = qrSize + framePad * 2 + scatterPad * 2 + captionH + ribbonH;
    qrLeft = framePad + scatterPad;
    qrTop = framePad + scatterPad + ribbonH;
    if (d.scatter) filler = buildScatterFiller(count, d, qrLeft + margin * cellSize, qrTop + margin * cellSize, cellSize);
  }

  const side = rotated ? (innerW + innerH) / Math.SQRT2 : 0;
  const canvasW = rotated ? side : innerW;
  const canvasH = rotated ? side : innerH;
  const toCanvas = (x: number, y: number): [number, number] => {
    if (!rotated) return [x, y];
    const dx = x - innerW / 2;
    const dy = y - innerH / 2;
    return [(dx - dy) * Math.SQRT1_2 + side / 2, (dx + dy) * Math.SQRT1_2 + side / 2];
  };
  const [centerX, centerY] = toCanvas(qrLeft + qrSize / 2, qrTop + qrSize / 2);
  let scanBox = { x: qrLeft, y: qrTop, w: qrSize, h: qrSize };
  if (fit) {
    // Камера видит код вместе с узором вокруг — проверяем так же.
    const pad = cellSize * 3;
    const x = Math.max(0, qrLeft - pad);
    const y = Math.max(0, qrTop - pad);
    scanBox = { x, y, w: Math.min(innerW, qrLeft + qrSize + pad) - x, h: Math.min(innerH, qrTop + qrSize + pad) - y };
  }

  const layout: QrLayout = {
    modules,
    count,
    margin,
    cellSize,
    qrSize,
    canvasW,
    canvasH,
    innerW,
    innerH,
    rotated,
    qrLeft,
    qrTop,
    offX: qrLeft + margin * cellSize,
    offY: qrTop + margin * cellSize,
    centerX,
    centerY,
    scanBox,
    frameOn,
    captionH,
    ribbonH,
    framePad,
    filler,
    hidden: null,
    alignment: null,
    halftone: null,
  };

  const hasCenter =
    d.centerMode === "text" ? parseCenterTextLines(d.centerText).length > 0 : !!assets.logo;
  // Только для новых стилей: у квадратов плашка и так всё закрывает, а старые QR должны выглядеть как раньше.
  if (hasCenter && !d.logoFill && d.dotStyle !== "classic" && d.dotStyle !== "rounded") {
    const b = centerBox(layout, d.logoSize);
    const half = b.box / 2 + cellSize * (rotated ? 0.7 : 0.5);
    const hidden = new Uint8Array(count * count);
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        const [x, y] = toCanvas(layout.offX + (c + 0.5) * cellSize, layout.offY + (r + 0.5) * cellSize);
        if (Math.abs(x - b.cx) < half && Math.abs(y - b.cy) < half) hidden[r * count + c] = 1;
      }
    }
    layout.hidden = hidden;
  }

  if (d.dotStyle !== "classic" && d.dotStyle !== "rounded") {
    const alignment = new Uint8Array(count * count);
    for (const [ar, ac] of alignmentCenters(count)) {
      for (let r = ar - 2; r <= ar + 2; r++) for (let c = ac - 2; c <= ac + 2; c++) alignment[r * count + c] = 1;
    }
    layout.alignment = alignment;
  }

  if (halftonePhoto && typeof document !== "undefined") {
    layout.halftone = buildHalftone(layout, assets.photo!);
  }
  return layout;
}

export function isInFinder(row: number, col: number, count: number): boolean {
  if (row < 8 && col < 8) return true;
  if (row < 8 && col >= count - 8) return true;
  if (row >= count - 8 && col < 8) return true;
  return false;
}

// ── Примитивы ────────────────────────────────────────────────────────────────

function addRoundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function fillRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  addRoundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
}

function strokeRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  addRoundRectPath(ctx, x, y, w, h, r);
  ctx.stroke();
}

/** Лист: у каждого угла свой радиус, «острый» угол смотрит в центр кода. */
function addLeafPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  big: number,
  small: number,
  isTL: boolean,
  isTR: boolean,
) {
  const tl = isTL ? big : isTR ? small : big;
  const tr = isTL ? big : isTR ? big : small;
  const br = isTL ? small : isTR ? big : big;
  const bl = isTL ? big : isTR ? small : small;
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + s - tr, y);
  ctx.quadraticCurveTo(x + s, y, x + s, y + tr);
  ctx.lineTo(x + s, y + s - br);
  ctx.quadraticCurveTo(x + s, y + s, x + s - br, y + s);
  ctx.lineTo(x + bl, y + s);
  ctx.quadraticCurveTo(x, y + s, x, y + s - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

export function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, style: QrDotStyle) {
  if (style === "rounded") {
    const gap = size * 0.1;
    const s = size - gap * 2;
    fillRoundRect(ctx, x + gap, y + gap, s, s, s * 0.3);
    return;
  }
  // Лёгкий нахлёст убирает светлые «швы» между соседними квадратами при сглаживании.
  const translucent = ctx.globalAlpha < 1 || (typeof ctx.fillStyle === "string" && ctx.fillStyle.startsWith("rgba"));
  const bleed = translucent ? 0 : size * 0.02;
  ctx.fillRect(x, y, size + bleed, size + bleed);
}

/** Соседи клетки: (dr, dc) → тёмная ли клетка рядом. */
type Neighbors = (dr: number, dc: number) => boolean;
type CellStyle = Exclude<QrDotStyle, "splash">;

/** Прямоугольник со своим радиусом у каждого угла. */
function addCornerRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  tl: number,
  tr: number,
  br: number,
  bl: number,
) {
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  if (tr) ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  if (br) ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  if (bl) ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  if (tl) ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

function addCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.moveTo(cx + r, cy);
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
}

/** Тёмная клетка в выбранном стиле. `seed` — для лёгкой неровности растровых точек. */
function drawStyledCell(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, style: CellStyle, nb: Neighbors, seed: number) {
  switch (style) {
    case "classic":
    case "rounded":
      drawDot(ctx, x, y, s, style);
      return;
    case "dots":
      ctx.beginPath();
      addCircle(ctx, x + s / 2, y + s / 2, s * 0.46);
      ctx.fill();
      return;
    case "diamond": {
      const h = s * 0.6;
      const cx = x + s / 2;
      const cy = y + s / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - h);
      ctx.lineTo(cx + h, cy);
      ctx.lineTo(cx, cy + h);
      ctx.lineTo(cx - h, cy);
      ctx.closePath();
      ctx.fill();
      return;
    }
    case "liquid": {
      const t = nb(-1, 0), r = nb(0, 1), b = nb(1, 0), l = nb(0, -1);
      const rad = s * 0.5;
      // Нахлёст в сторону соседа убирает светлый шов между слитыми клетками.
      const bleed = s * 0.03;
      ctx.beginPath();
      addCornerRectPath(
        ctx,
        x,
        y,
        s + (r ? bleed : 0),
        s + (b ? bleed : 0),
        !t && !l ? rad : 0,
        !t && !r ? rad : 0,
        !b && !r ? rad : 0,
        !b && !l ? rad : 0,
      );
      ctx.fill();
      return;
    }
    case "halftone": {
      const sub = s / 3;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const rr = sub * (0.56 + cellNoise(seed * 9 + i * 3 + j) * 0.1);
          addCircle(ctx, x + (j + 0.5) * sub, y + (i + 0.5) * sub, rr);
        }
      }
      ctx.fill();
      return;
    }
  }
}

/** Вогнутые скругления в пустой клетке между тремя тёмными соседями — «жидкие» модули перетекают. */
function drawLiquidFillets(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, nb: Neighbors) {
  const f = s * 0.5;
  const corners: [number, number, number, number][] = [
    [-1, -1, x, y],
    [-1, 1, x + s, y],
    [1, 1, x + s, y + s],
    [1, -1, x, y + s],
  ];
  for (const [dr, dc, cx, cy] of corners) {
    if (!nb(dr, 0) || !nb(0, dc) || !nb(dr, dc)) continue;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - dc * f, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - dr * f);
    ctx.closePath();
    ctx.fill();
  }
}

/** Светлая клетка в растровом стиле: еле заметные точки, как незапечатанный растр. */
function drawHalftoneLight(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const sub = s / 3;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) addCircle(ctx, x + (j + 0.5) * sub, y + (i + 0.5) * sub, sub * 0.12);
  ctx.fill();
}

function drawFinderPattern(
  ctx: CanvasRenderingContext2D,
  startRow: number,
  startCol: number,
  cellSize: number,
  offX: number,
  offY: number,
  eye: QrEyeStyle,
  holeColor: string,
  transparentHole: boolean,
) {
  const x = offX + startCol * cellSize;
  const y = offY + startRow * cellSize;
  const s7 = 7 * cellSize;
  const s5 = 5 * cellSize;
  const s3 = 3 * cellSize;
  const x5 = x + cellSize;
  const y5 = y + cellSize;
  const x3 = x + 2 * cellSize;
  const y3 = y + 2 * cellSize;
  const isTL = startRow === 0 && startCol === 0;
  const isTR = startRow === 0 && startCol !== 0;

  const addCircle = (cx: number, cy: number, r: number) => {
    ctx.moveTo(cx + r, cy);
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  };
  const addOuter = () => {
    switch (eye) {
      case "square": ctx.rect(x, y, s7, s7); break;
      case "rounded": addRoundRectPath(ctx, x, y, s7, s7, cellSize * 1.6); break;
      case "circle":
      case "dot": addCircle(x + s7 / 2, y + s7 / 2, s7 / 2); break;
      case "leaf": addLeafPath(ctx, x, y, s7, cellSize * 2.2, cellSize * 0.5, isTL, isTR); break;
    }
  };
  const addHole = () => {
    switch (eye) {
      case "square": ctx.rect(x5, y5, s5, s5); break;
      case "rounded": addRoundRectPath(ctx, x5, y5, s5, s5, cellSize * 1.0); break;
      case "circle":
      case "dot": addCircle(x5 + s5 / 2, y5 + s5 / 2, s5 / 2); break;
      case "leaf": addLeafPath(ctx, x5, y5, s5, cellSize * 1.4, cellSize * 0.35, isTL, isTR); break;
    }
  };
  const addCenter = () => {
    switch (eye) {
      case "square": ctx.rect(x3, y3, s3, s3); break;
      case "rounded": addRoundRectPath(ctx, x3, y3, s3, s3, cellSize * 0.7); break;
      case "circle": addCircle(x3 + s3 / 2, y3 + s3 / 2, s3 / 2); break;
      case "dot": addCircle(x3 + s3 / 2, y3 + s3 / 2, s3 * 0.45); break;
      case "leaf": addLeafPath(ctx, x3, y3, s3, cellSize * 0.9, cellSize * 0.25, isTL, isTR); break;
    }
  };

  const eyeFill = ctx.fillStyle;
  if (transparentHole) {
    // Фото или прозрачный фон: настоящая дырка, а не квадрат цвета фона поверх.
    ctx.beginPath();
    addOuter();
    addHole();
    ctx.fill("evenodd");
  } else {
    ctx.beginPath();
    addOuter();
    ctx.fill();
    ctx.fillStyle = holeColor;
    ctx.beginPath();
    addHole();
    ctx.fill();
    ctx.fillStyle = eyeFill;
  }
  ctx.beginPath();
  addCenter();
  ctx.fill();
}

function makeFgFill(
  ctx: CanvasRenderingContext2D,
  d: QrDesign,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): CanvasGradient | string {
  if (!d.gradient) return d.fg;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  let g: CanvasGradient;
  switch (d.gradType) {
    case "linear-lr": g = ctx.createLinearGradient(x0, y0, x1, y0); break;
    case "linear-diag": g = ctx.createLinearGradient(x0, y0, x1, y1); break;
    case "radial": g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(x1 - x0, y1 - y0) / 2); break;
    default: g = ctx.createLinearGradient(x0, y0, x0, y1);
  }
  g.addColorStop(0, d.grad1);
  g.addColorStop(1, d.grad2);
  return g;
}

// ── Фото-режим ───────────────────────────────────────────────────────────────

/** Подложка фото-режима — как в продовом генераторе, чтобы напечатанные фото-QR не менялись. */
const PHOTO_LIGHT = "rgba(255,255,255,0.6)";
const PHOTO_DARK = "rgba(0,0,0,0.6)";

function drawPhoto(ctx: CanvasRenderingContext2D, L: QrLayout, d: QrDesign, img: HTMLImageElement | HTMLCanvasElement) {
  const [iw, ih] = imageSize(img);
  const full = !!L.filler;
  const x = full ? 0 : L.qrLeft;
  const y = full ? 0 : L.qrTop;
  const w = full ? L.innerW : L.qrSize;
  const h = full ? L.innerH : L.qrSize;
  const { sx, sy, sw, sh } = coverCrop(iw, ih, w, h);
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/** Фото-гравюра: тёмные субпиксели склеиваются по строкам в один путь. */
function drawHalftonePhoto(
  ctx: CanvasRenderingContext2D,
  L: QrLayout,
  bits: Uint8Array,
  fill: CanvasGradient | string,
  dx: number,
  dy: number,
) {
  const side = (L.count + L.margin * 2) * HALFTONE_RES;
  const sub = L.qrSize / side;
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let y = 0; y < side; y++) {
    let x = 0;
    while (x < side) {
      if (!bits[y * side + x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < side && bits[y * side + x]) x++;
      ctx.rect(L.qrLeft + dx + start * sub, L.qrTop + dy + y * sub, (x - start) * sub, sub * 1.02);
    }
  }
  ctx.fill();
}

// ── Центр: логотип или текст ─────────────────────────────────────────────────

function centerBox(L: Pick<QrLayout, "qrSize" | "centerX" | "centerY">, sizePct: number) {
  const inner = L.qrSize * (sizePct / 100);
  const padding = L.qrSize * 0.02;
  const box = inner + padding * 2;
  const cx = L.centerX;
  const cy = L.centerY;
  return { inner, box, cx, cy, x: cx - box / 2, y: cy - box / 2 };
}

function drawLogo(ctx: CanvasRenderingContext2D, L: QrLayout, d: QrDesign, img: CanvasImageSource, bgColor: string) {
  const b = centerBox(L, d.logoSize);
  ctx.save();
  if (!d.logoFill) {
    ctx.fillStyle = bgColor;
    fillRoundRect(ctx, b.x, b.y, b.box, b.box, b.box * 0.18);
  }
  const el = img as HTMLImageElement;
  const iw = el.naturalWidth || (img as HTMLCanvasElement).width || 1;
  const ih = el.naturalHeight || (img as HTMLCanvasElement).height || 1;
  const ratio = iw / ih;
  const dw = ratio > 1 ? b.inner : b.inner * ratio;
  const dh = ratio > 1 ? b.inner / ratio : b.inner;
  ctx.drawImage(img, b.cx - dw / 2, b.cy - dh / 2, dw, dh);
  ctx.restore();
}

function drawCenterText(ctx: CanvasRenderingContext2D, L: QrLayout, d: QrDesign, lines: string[], bgColor: string) {
  const b = centerBox(L, d.logoSize);
  const maxW = b.box * 0.8;
  const weight = d.centerTextBold === false ? "600" : "800";
  const stack = centerTextFontStack(d.centerTextFont);
  ctx.save();
  if (!d.logoFill) {
    ctx.fillStyle = bgColor;
    fillRoundRect(ctx, b.x, b.y, b.box, b.box, b.box * 0.18);
  }
  const lineGap = 1.15;
  const totalHeight = (size: number) => lines.length * size * lineGap - (lineGap - 1) * size;
  let fontSize = Math.round((b.box / lines.length) * 0.38);
  const minFont = Math.max(7, Math.round(b.box * 0.08));
  const fits = (size: number) => {
    ctx.font = `${weight} ${size}px ${stack}`;
    return !lines.some((line) => ctx.measureText(line).width > maxW) && totalHeight(size) <= b.box * 0.88;
  };
  while (fontSize > minFont && !fits(fontSize)) fontSize -= 1;
  ctx.fillStyle = d.centerTextColor || d.fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${weight} ${fontSize}px ${stack}`;
  const lineH = fontSize * lineGap;
  let y = b.cy - totalHeight(fontSize) / 2 + lineH / 2;
  for (const line of lines) {
    ctx.fillText(line, b.cx, y);
    y += lineH;
  }
  ctx.restore();
}

/** Подпись на рамке: шрифт уменьшается, пока текст не влезет по ширине. */
function drawFrameLabel(ctx: CanvasRenderingContext2D, text: string, box: { x: number; y: number; w: number; h: number }) {
  ctx.save();
  const maxW = box.w - Math.max(6, box.w * 0.04) * 2;
  let fontSize = Math.round(box.h * 0.42);
  const minFont = Math.round(box.h * 0.22);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  while (fontSize > minFont) {
    ctx.font = `800 ${fontSize}px Inter, system-ui, sans-serif`;
    if (ctx.measureText(text).width <= maxW) break;
    fontSize -= 1;
  }
  ctx.font = `800 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.fillText(text, box.x + box.w / 2, box.y + box.h / 2);
  ctx.restore();
}

// ── Узор вокруг кода ─────────────────────────────────────────────────────────

function isInsideScatterShape(dx: number, dy: number, shape: QrScatterShape, outerR: number): boolean {
  const normDist = Math.sqrt(dx * dx + dy * dy) / outerR;
  const nx = Math.abs(dx) / outerR;
  const ny = Math.abs(dy) / outerR;
  switch (shape) {
    case "circle": return normDist <= 1;
    case "star": {
      const a = ((Math.atan2(dy, dx) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)) / ((Math.PI * 2) / 5);
      const sector = a % 1;
      const t = sector < 0.5 ? sector * 2 : (1 - sector) * 2;
      return normDist <= 1 + (0.45 - 1) * t;
    }
    case "diamond": return nx + ny <= 1;
    case "hexagon": {
      const s3 = Math.sqrt(3);
      return ny <= 1 && nx <= s3 / 2 && s3 * ny + nx <= s3;
    }
    case "heart": {
      const hx = dx / outerR / 0.8;
      const hy = (-dy / outerR + 0.2) / 0.8;
      const eq = hx * hx + hy * hy - 1;
      return eq * eq * eq - hx * hx * hy * hy * hy <= 0;
    }
    case "cross": return (nx <= 0.35 && ny <= 1) || (ny <= 0.35 && nx <= 1);
    case "octagon": return nx <= 1 && ny <= 1 && nx + ny <= Math.SQRT2;
    case "triangle": {
      const tx = dx / outerR;
      const ty = -(dy / outerR) - 0.15;
      const side = 2 / Math.sqrt(3);
      return ty >= -side && ty <= side && Math.abs(tx) <= ((side - ty) * 0.5) / side * 2;
    }
    default: return true;
  }
}

// ── Слои модулей ─────────────────────────────────────────────────────────────

function fillerAt(f: QrFiller | null, r: number, c: number): boolean {
  if (!f) return false;
  const gr = r - f.r0;
  const gc = c - f.c0;
  return gr >= 0 && gr < f.rows && gc >= 0 && gc < f.cols && f.cells[gr * f.cols + gc] === 1;
}

/** Тёмная ли клетка: модуль кода (кроме поисковых узоров и места под логотипом) или декоративная. */
function isDarkCell(L: QrLayout, r: number, c: number): boolean {
  const n = L.count;
  if (r >= 0 && r < n && c >= 0 && c < n) {
    const i = r * n + c;
    if (isInFinder(r, c, n) || (L.hidden && L.hidden[i])) return false;
    return !!L.modules.data[i];
  }
  return fillerAt(L.filler, r, c);
}

function cellStyleAt(L: QrLayout, d: QrDesign, r: number, c: number): CellStyle {
  if (L.alignment && r >= 0 && r < L.count && c >= 0 && c < L.count && L.alignment[r * L.count + c]) return "classic";
  if (d.dotStyle !== "splash") return d.dotStyle;
  // «Клякса» вокруг центра с рваным краем, дальше — точки.
  const mid = (L.count - 1) / 2;
  const radius = ((d.logoSize / 100) * (L.count + L.margin * 2)) / 2 + 5.5 + (cellNoise(r * 131 + c * 71 + 3) - 0.5) * 3;
  return Math.hypot(r - mid, c - mid) < radius ? "liquid" : "dots";
}

interface CellRange {
  r0: number;
  r1: number;
  c0: number;
  c1: number;
  /** Пропустить клетки самого кода (для узора вокруг). */
  skipCode: boolean;
}

function drawCells(
  ctx: CanvasRenderingContext2D,
  L: QrLayout,
  d: QrDesign,
  range: CellRange,
  dx: number,
  dy: number,
  lightDots: boolean,
) {
  const { cellSize: s, offX, offY, count } = L;
  for (let r = range.r0; r < range.r1; r++) {
    for (let c = range.c0; c < range.c1; c++) {
      const inCode = r >= 0 && r < count && c >= 0 && c < count;
      if (range.skipCode && inCode) continue;
      const style = cellStyleAt(L, d, r, c);
      const x = offX + c * s + dx;
      const y = offY + r * s + dy;
      const nb: Neighbors = (dr, dc) => isDarkCell(L, r + dr, c + dc);
      if (isDarkCell(L, r, c)) {
        drawStyledCell(ctx, x, y, s, style, nb, r * 977 + c);
      } else if (style === "liquid") {
        drawLiquidFillets(ctx, x, y, s, nb);
      } else if (style === "halftone" && lightDots && inCode && !isInFinder(r, c, count) && !L.hidden?.[r * count + c]) {
        drawHalftoneLight(ctx, x, y, s);
      }
    }
  }
}

function drawFinders(
  ctx: CanvasRenderingContext2D,
  L: QrLayout,
  d: QrDesign,
  dx: number,
  dy: number,
  holeColor: string,
  transparentHole: boolean,
) {
  const { count, cellSize } = L;
  const x = L.offX + dx;
  const y = L.offY + dy;
  drawFinderPattern(ctx, 0, 0, cellSize, x, y, d.eyeStyle, holeColor, transparentHole);
  drawFinderPattern(ctx, 0, count - 7, cellSize, x, y, d.eyeStyle, holeColor, transparentHole);
  drawFinderPattern(ctx, count - 7, 0, cellSize, x, y, d.eyeStyle, holeColor, transparentHole);
}

/** Сдвинутые слои «офсетной печати» под основным цветом. */
const INK_LAYERS = [
  { color: "#00aeef", dx: 0.16, dy: 0.08 },
  { color: "#ffd400", dx: -0.1, dy: 0.16 },
];

function drawFiller(ctx: CanvasRenderingContext2D, L: QrLayout, d: QrDesign, codeFill: CanvasGradient | string) {
  const f = L.filler!;
  ctx.fillStyle = f.ownFill ? makeFgFill(ctx, d, f.ownFill.x0, f.ownFill.y0, f.ownFill.x1, f.ownFill.y1) : codeFill;
  drawCells(ctx, L, d, { r0: f.r0, r1: f.r0 + f.rows, c0: f.c0, c1: f.c0 + f.cols, skipCode: true }, 0, 0, false);
}

/** Всё, что поворачивается вместе с кодом: фото, модули, узор, поисковые узоры. */
function drawBody(ctx: CanvasRenderingContext2D, L: QrLayout, d: QrDesign, assets: QrAssets, lightColor: string) {
  const { count, cellSize, qrSize, qrLeft, qrTop, offX, offY } = L;
  const photo = assets.photo && !L.halftone ? assets.photo : null;
  const f = L.filler;
  // Силуэт красится одним градиентом целиком, иначе градиент — по самому коду.
  const fgFill = f && !f.ownFill
    ? makeFgFill(ctx, d, 0, 0, L.innerW, L.innerH)
    : makeFgFill(ctx, d, qrLeft, qrTop, qrLeft + qrSize, qrTop + qrSize);
  const code: CellRange = { r0: 0, r1: count, c0: 0, c1: count, skipCode: false };
  const around: CellRange | null = f ? { r0: f.r0, r1: f.r0 + f.rows, c0: f.c0, c1: f.c0 + f.cols, skipCode: true } : null;

  if (d.inkShift && !photo) {
    for (const ink of INK_LAYERS) {
      const dx = ink.dx * cellSize;
      const dy = ink.dy * cellSize;
      ctx.fillStyle = ink.color;
      if (L.halftone) drawHalftonePhoto(ctx, L, L.halftone, ink.color, dx, dy);
      else drawCells(ctx, L, d, code, dx, dy, false);
      if (around) drawCells(ctx, L, d, around, dx, dy, false);
      drawFinders(ctx, L, d, dx, dy, lightColor, true);
    }
  }

  if (L.halftone) {
    drawHalftonePhoto(ctx, L, L.halftone, fgFill, 0, 0);
  } else if (photo) {
    drawPhoto(ctx, L, d, photo);
    ctx.fillStyle = PHOTO_LIGHT;
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (L.modules.data[row * count + col] || isInFinder(row, col, count)) continue;
        ctx.fillRect(offX + col * cellSize, offY + row * cellSize, cellSize, cellSize);
      }
    }
    ctx.fillStyle = PHOTO_DARK;
    drawCells(ctx, L, d, code, 0, 0, false);
  } else {
    ctx.fillStyle = fgFill;
    drawCells(ctx, L, d, code, 0, 0, true);
  }

  // Узор вокруг кода без поворота рисуется в самом конце, поверх рамки, — как и раньше.
  if (f && (!f.ownFill || L.rotated)) drawFiller(ctx, L, d, fgFill);

  ctx.fillStyle = d.eyeCustom ? d.eyeColor : typeof fgFill === "string" ? fgFill : d.grad1;
  drawFinders(ctx, L, d, 0, 0, lightColor, !!L.halftone || d.bgTransparent);
}

// ── Основная отрисовка ───────────────────────────────────────────────────────

/** Рисует код в базовых координатах. Масштаб (если нужен) выставляет вызывающий. */
export function drawQr(ctx: CanvasRenderingContext2D, L: QrLayout, d: QrDesign, assets: QrAssets = {}) {
  const { qrSize, canvasW, canvasH, qrTop } = L;

  if (d.bgTransparent) ctx.clearRect(0, 0, canvasW, canvasH);
  else {
    ctx.fillStyle = d.bg;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }
  const lightColor = d.bgTransparent ? "#ffffff" : d.bg;

  if (L.rotated) {
    ctx.save();
    ctx.translate(canvasW / 2, canvasH / 2);
    ctx.rotate(Math.PI / 4);
    ctx.translate(-L.innerW / 2, -L.innerH / 2);
  }
  drawBody(ctx, L, d, assets, lightColor);
  if (L.rotated) ctx.restore();

  // Логотип и надпись не поворачиваются вместе с ромбом.
  const textLines = d.centerMode === "text" ? parseCenterTextLines(d.centerText) : [];
  if (textLines.length > 0) drawCenterText(ctx, L, d, textLines, lightColor);
  else if (d.centerMode !== "text" && assets.logo) drawLogo(ctx, L, d, assets.logo, lightColor);

  if (L.frameOn) {
    const frameColor = d.eyeCustom ? d.eyeColor : d.gradient ? d.grad1 : d.fg;
    if (d.frameStyle === "rounded") {
      ctx.save();
      ctx.strokeStyle = frameColor;
      ctx.lineWidth = 12;
      strokeRoundRect(ctx, 6, 6, canvasW - 12, canvasH - 12, 36);
      ctx.restore();
    } else if (d.frameStyle === "bottom") {
      ctx.fillStyle = frameColor;
      ctx.fillRect(0, qrTop + qrSize, canvasW, L.captionH);
      drawFrameLabel(ctx, d.frameText, { x: 0, y: qrTop + qrSize, w: canvasW, h: L.captionH });
    } else {
      ctx.save();
      ctx.fillStyle = frameColor;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(canvasW, 0);
      ctx.lineTo(canvasW, L.ribbonH - RIBBON_NOTCH);
      ctx.lineTo(canvasW / 2, L.ribbonH);
      ctx.lineTo(0, L.ribbonH - RIBBON_NOTCH);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      drawFrameLabel(ctx, d.frameText, { x: 0, y: 0, w: canvasW, h: L.ribbonH - RIBBON_NOTCH });
    }
  }

  if (L.filler?.ownFill && !L.rotated) drawFiller(ctx, L, d, d.fg);
}

/**
 * Рисует код на canvas шириной `width` пикселей (по умолчанию — базовый масштаб).
 * Возвращает коэффициент масштаба относительно базовых координат.
 */
export function renderToCanvas(
  canvas: HTMLCanvasElement,
  L: QrLayout,
  d: QrDesign,
  assets: QrAssets = {},
  width: number = L.canvasW,
): number {
  const k = width / L.canvasW;
  canvas.width = Math.max(1, Math.round(L.canvasW * k));
  canvas.height = Math.max(1, Math.round(L.canvasH * k));
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  drawQr(ctx, L, d, assets);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return k;
}

const imageHrefCache = new WeakMap<object, string>();

/** Картинки в SVG встраиваются data-URL'ом: файл должен открываться без нашего сайта. */
export function embedImageHref(img: CanvasImageSource, isPhoto = false): string {
  if (typeof HTMLImageElement !== "undefined" && img instanceof HTMLImageElement && img.src.startsWith("data:") && !isPhoto) {
    return img.src;
  }
  const cached = imageHrefCache.get(img as object);
  if (cached) return cached;
  const el = img as HTMLImageElement;
  const w = el.naturalWidth || (img as HTMLCanvasElement).width || 512;
  const h = el.naturalHeight || (img as HTMLCanvasElement).height || 512;
  // Логотипы растягиваем до 512 px (резкость при печати), фото ужимаем до 1600 px.
  const scale = isPhoto ? Math.min(1, 1600 / Math.max(w, h)) : Math.max(1, 512 / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  const href = isPhoto ? c.toDataURL("image/jpeg", 0.9) : c.toDataURL("image/png");
  imageHrefCache.set(img as object, href);
  return href;
}

/** Векторный SVG той же отрисовкой, что и PNG. Фото и логотип — вложенные картинки. */
export function renderToSvg(L: QrLayout, d: QrDesign, assets: QrAssets = {}): string {
  const svg = new SvgContext(L.canvasW, L.canvasH, (img) => embedImageHref(img, img === assets.photo));
  drawQr(svg as unknown as CanvasRenderingContext2D, L, d, assets);
  return svg.toString();
}

// ── Миниатюры для выбора стиля ───────────────────────────────────────────────

export function renderDotStylePreview(canvas: HTMLCanvasElement, style: QrDotStyle) {
  const size = canvas.width;
  const ctx = canvas.getContext("2d")!;
  const cell = size / 5;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  const pattern = [
    [1, 0, 1, 0, 1],
    [0, 1, 1, 1, 0],
    [1, 1, 1, 1, 1],
    [0, 1, 1, 1, 0],
    [1, 0, 1, 0, 1],
  ];
  ctx.fillStyle = "#1e293b";
  const dark = (r: number, c: number) => r >= 0 && r < 5 && c >= 0 && c < 5 && pattern[r][c] === 1;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      // «Клякса» в миниатюре: середина жидкая, края — точками.
      const cellStyle: CellStyle = style === "splash" ? (Math.abs(row - 2) + Math.abs(col - 2) <= 1 ? "liquid" : "dots") : style;
      const nb: Neighbors = (dr, dc) => dark(row + dr, col + dc);
      if (dark(row, col)) drawStyledCell(ctx, col * cell, row * cell, cell, cellStyle, nb, row * 5 + col);
      else if (cellStyle === "liquid") drawLiquidFillets(ctx, col * cell, row * cell, cell, nb);
      else if (cellStyle === "halftone") drawHalftoneLight(ctx, col * cell, row * cell, cell);
    }
  }
}

export function renderEyeStylePreview(canvas: HTMLCanvasElement, eye: QrEyeStyle) {
  const size = canvas.width;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  const cell = size / 8;
  ctx.fillStyle = "#1e293b";
  drawFinderPattern(ctx, 0, 0, cell, cell / 2, cell / 2, eye, "#ffffff", false);
}
