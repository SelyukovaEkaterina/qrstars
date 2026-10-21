/**
 * Отрисовка оформленного QR. Вся геометрия считается в базовых координатах (QR = 600),
 * масштаб задаёт `ctx.scale` — превью, PNG любого размера и SVG выглядят одинаково.
 */
import type { QrAssets, QrCenterTextFont, QrDesign, QrDotStyle, QrEyeStyle, QrModules, QrScatterShape } from "./types";
import { SvgContext } from "./svg-context";

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

export interface QrLayout {
  modules: QrModules;
  count: number;
  cellSize: number;
  qrSize: number;
  canvasW: number;
  canvasH: number;
  qrLeft: number;
  qrTop: number;
  offX: number;
  offY: number;
  captionH: number;
  ribbonH: number;
  framePad: number;
  /** Яркость фото под кодом в базовом масштабе — общая для PNG и SVG. */
  photoSnap: ImageData | null;
}

// ── Геометрия ────────────────────────────────────────────────────────────────

export function computeLayout(modules: QrModules, d: QrDesign, assets: QrAssets = {}): QrLayout {
  const qrSize = QR_BASE_SIZE;
  const count = modules.size;
  const cellSize = qrSize / (count + d.margin * 2);
  const captionH = d.frame && d.frameStyle === "bottom" ? FRAME_BAR_H : 0;
  const ribbonH = d.frame && d.frameStyle === "ribbon" ? FRAME_BAR_H : 0;
  const framePad = d.frame && d.frameStyle === "rounded" ? FRAME_PAD : 0;
  const scatterPad = (d.scatter ? d.scatterDensity : 0) * cellSize;
  const canvasW = qrSize + framePad * 2 + scatterPad * 2;
  const canvasH = qrSize + framePad * 2 + scatterPad * 2 + captionH + ribbonH;
  const qrLeft = framePad + scatterPad;
  const qrTop = framePad + scatterPad + ribbonH;
  const layout: QrLayout = {
    modules,
    count,
    cellSize,
    qrSize,
    canvasW,
    canvasH,
    qrLeft,
    qrTop,
    offX: qrLeft + d.margin * cellSize,
    offY: qrTop + d.margin * cellSize,
    captionH,
    ribbonH,
    framePad,
    photoSnap: null,
  };
  if (assets.photo && typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = Math.ceil(canvasW);
    c.height = Math.ceil(canvasH);
    const pctx = c.getContext("2d", { willReadFrequently: true });
    if (pctx) {
      drawPhoto(pctx, layout, d, assets.photo);
      layout.photoSnap = pctx.getImageData(qrLeft, qrTop, qrSize, qrSize);
    }
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
  const bleed = ctx.globalAlpha === 1 ? size * 0.02 : 0;
  ctx.fillRect(x, y, size + bleed, size + bleed);
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

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0) as [number, number, number];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

// ── Фото-режим: прозрачность подложки по яркости фото под каждым модулем ────

function photoLightAlpha(lum: number): number {
  const target = 200;
  if (lum >= target) return 0;
  return Math.min(0.38, ((target - lum) / (255 - lum)) * 0.72);
}

function photoDarkAlpha(lum: number): number {
  if (lum <= 45) return 0.55;
  if (lum <= 58) return 0.5;
  return Math.min(0.92, Math.max(0.5, 1 - 58 / lum));
}

function sampleLuminance(L: QrLayout, row: number, col: number): number {
  const snap = L.photoSnap!;
  const px = Math.min(L.qrSize - 1, Math.max(0, Math.floor(L.offX - L.qrLeft + (col + 0.5) * L.cellSize)));
  const py = Math.min(L.qrSize - 1, Math.max(0, Math.floor(L.offY - L.qrTop + (row + 0.5) * L.cellSize)));
  const idx = (py * L.qrSize + px) * 4;
  return 0.2126 * snap.data[idx] + 0.7152 * snap.data[idx + 1] + 0.0722 * snap.data[idx + 2];
}

function drawPhoto(ctx: CanvasRenderingContext2D, L: QrLayout, d: QrDesign, img: HTMLImageElement | HTMLCanvasElement) {
  const iw = (img as HTMLImageElement).naturalWidth || img.width;
  const ih = (img as HTMLImageElement).naturalHeight || img.height;
  const x = d.scatter ? 0 : L.qrLeft;
  const y = d.scatter ? 0 : L.qrTop;
  const w = d.scatter ? L.canvasW : L.qrSize;
  const h = d.scatter ? L.canvasH : L.qrSize;
  let sx = 0, sy = 0, sw = iw, sh = ih;
  if (iw / ih > w / h) {
    sw = ih * (w / h);
    sx = (iw - sw) / 2;
  } else {
    sh = iw / (w / h);
    sy = (ih - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// ── Центр: логотип или текст ─────────────────────────────────────────────────

function centerBox(L: QrLayout, sizePct: number) {
  const inner = L.qrSize * (sizePct / 100);
  const padding = L.qrSize * 0.02;
  const box = inner + padding * 2;
  const cx = L.qrLeft + L.qrSize / 2;
  const cy = L.qrTop + L.qrSize / 2;
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

function drawScatter(ctx: CanvasRenderingContext2D, L: QrLayout, d: QrDesign) {
  const { count, cellSize, offX, offY, canvasW, canvasH } = L;
  const cellsOut = d.scatterDensity;
  const center = (count - 1) / 2;
  const outerR = center + cellsOut;
  const rng = (seed: number) => {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  ctx.fillStyle = makeFgFill(
    ctx,
    d,
    offX - cellsOut * cellSize,
    offY - cellsOut * cellSize,
    offX + (count + cellsOut) * cellSize,
    offY + (count + cellsOut) * cellSize,
  );
  for (let r = -cellsOut; r < count + cellsOut; r++) {
    for (let c = -cellsOut; c < count + cellsOut; c++) {
      if (r >= 0 && r < count && c >= 0 && c < count) continue;
      if (!isInsideScatterShape(c - center, r - center, d.scatterShape, outerR)) continue;
      if (rng(r * 997 + c + 7) < 0.5) continue;
      const x = offX + c * cellSize;
      const y = offY + r * cellSize;
      if (x < -cellSize || y < -cellSize || x > canvasW + cellSize || y > canvasH + cellSize) continue;
      drawDot(ctx, x, y, cellSize, d.dotStyle);
    }
  }
}

// ── Основная отрисовка ───────────────────────────────────────────────────────

/** Рисует код в базовых координатах. Масштаб (если нужен) выставляет вызывающий. */
export function drawQr(ctx: CanvasRenderingContext2D, L: QrLayout, d: QrDesign, assets: QrAssets = {}) {
  const { modules, count, cellSize, qrSize, canvasW, canvasH, qrLeft, qrTop, offX, offY } = L;
  const photo = assets.photo && L.photoSnap ? assets.photo : null;

  if (d.bgTransparent) ctx.clearRect(0, 0, canvasW, canvasH);
  else {
    ctx.fillStyle = d.bg;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  const fgFill = makeFgFill(ctx, d, qrLeft, qrTop, qrLeft + qrSize, qrTop + qrSize);
  const lightColor = d.bgTransparent ? "#ffffff" : d.bg;

  if (photo) {
    drawPhoto(ctx, L, d, photo);
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (modules.data[row * count + col] || isInFinder(row, col, count)) continue;
        const alpha = photoLightAlpha(sampleLuminance(L, row, col));
        if (alpha < 0.02) continue;
        ctx.fillStyle = rgba(lightColor, alpha);
        ctx.fillRect(offX + col * cellSize, offY + row * cellSize, cellSize, cellSize);
      }
    }
    ctx.fillStyle = fgFill;
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (!modules.data[row * count + col] || isInFinder(row, col, count)) continue;
        ctx.globalAlpha = photoDarkAlpha(sampleLuminance(L, row, col));
        drawDot(ctx, offX + col * cellSize, offY + row * cellSize, cellSize, d.dotStyle);
      }
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = fgFill;
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (modules.data[row * count + col] && !isInFinder(row, col, count)) {
          drawDot(ctx, offX + col * cellSize, offY + row * cellSize, cellSize, d.dotStyle);
        }
      }
    }
  }

  ctx.fillStyle = d.eyeCustom ? d.eyeColor : typeof fgFill === "string" ? fgFill : d.grad1;
  const transparentHole = !!photo || d.bgTransparent;
  drawFinderPattern(ctx, 0, 0, cellSize, offX, offY, d.eyeStyle, lightColor, transparentHole);
  drawFinderPattern(ctx, 0, count - 7, cellSize, offX, offY, d.eyeStyle, lightColor, transparentHole);
  drawFinderPattern(ctx, count - 7, 0, cellSize, offX, offY, d.eyeStyle, lightColor, transparentHole);

  const textLines = d.centerMode === "text" ? parseCenterTextLines(d.centerText) : [];
  if (textLines.length > 0) drawCenterText(ctx, L, d, textLines, lightColor);
  else if (d.centerMode !== "text" && assets.logo) drawLogo(ctx, L, d, assets.logo, lightColor);

  if (d.frame) {
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

  if (d.scatter) drawScatter(ctx, L, d);
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
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      if (pattern[row][col]) drawDot(ctx, col * cell, row * cell, cell, style);
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
