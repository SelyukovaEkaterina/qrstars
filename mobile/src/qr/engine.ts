import { Skia, TileMode } from "@shopify/react-native-skia";
import type { SkCanvas, SkImage, SkPaint, SkPath, SkShader, SkFont } from "@shopify/react-native-skia";
import qrcode from "qrcode/lib/core/qrcode";

import type { QRDotStyle, QREyeStyle, QRScatterShape, QRTemplateConfig } from "./types";
import { parseCenterTextLines } from "./payload";

const FRAME_BAR_HEIGHT_RATIO = 80 / 600;

function frameBarHeight(qrSize: number): number {
  return Math.max(28, Math.round(qrSize * FRAME_BAR_HEIGHT_RATIO));
}

function safeEmbolden(font: SkFont, bold: boolean): void {
  try {
    const f = font as unknown as { setEmbolden?: (v: boolean | number) => void };
    f.setEmbolden?.(bold ? 1 : 0);
  } catch {
    // Skia JSI may reject boolean — ignore, text stays regular weight
  }
}

export function createQRMatrix(payload: string, ecc: QRTemplateConfig["ecc"]) {
  const qrData = qrcode.create(payload, { errorCorrectionLevel: ecc });
  return qrData.modules;
}

function makeFgShader(
  cfg: QRTemplateConfig,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): SkShader | null {
  if (!cfg.gradient) return null;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const c1 = Skia.Color(cfg.grad1);
  const c2 = Skia.Color(cfg.grad2);
  const colors = [c1, c2];
  switch (cfg.gradType) {
    case "linear-tb":
      return Skia.Shader.MakeLinearGradient(
        Skia.Point(x0, y0),
        Skia.Point(x0, y1),
        colors,
        null,
        TileMode.Clamp,
      );
    case "linear-lr":
      return Skia.Shader.MakeLinearGradient(
        Skia.Point(x0, y0),
        Skia.Point(x1, y0),
        colors,
        null,
        TileMode.Clamp,
      );
    case "linear-diag":
      return Skia.Shader.MakeLinearGradient(
        Skia.Point(x0, y0),
        Skia.Point(x1, y1),
        colors,
        null,
        TileMode.Clamp,
      );
    case "radial":
      return Skia.Shader.MakeRadialGradient(
        Skia.Point(cx, cy),
        Math.max(x1 - x0, y1 - y0) / 2,
        colors,
        null,
        TileMode.Clamp,
      );
    default:
      return Skia.Shader.MakeLinearGradient(
        Skia.Point(x0, y0),
        Skia.Point(x0, y1),
        colors,
        null,
        TileMode.Clamp,
      );
  }
}

function drawDot(
  canvas: SkCanvas,
  paint: SkPaint,
  x: number,
  y: number,
  size: number,
  style: QRDotStyle,
) {
  if (style === "classic") {
    canvas.drawRect(Skia.XYWHRect(x, y, size, size), paint);
  } else {
    const gap = size * 0.1;
    const s = size - gap * 2;
    const r = s * 0.3;
    canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x + gap, y + gap, s, s), r, r), paint);
  }
}

function isInFinder(row: number, col: number, count: number): boolean {
  if (row < 8 && col < 8) return true;
  if (row < 8 && col >= count - 8) return true;
  if (row >= count - 8 && col < 8) return true;
  return false;
}

function buildLeafPath(
  x: number,
  y: number,
  s: number,
  tl: number,
  tr: number,
  br: number,
  bl: number,
): SkPath {
  const path = Skia.Path.Make();
  path.moveTo(x + tl, y);
  path.lineTo(x + s - tr, y);
  path.quadTo(x + s, y, x + s, y + tr);
  path.lineTo(x + s, y + s - br);
  path.quadTo(x + s, y + s, x + s - br, y + s);
  path.lineTo(x + bl, y + s);
  path.quadTo(x, y + s, x, y + s - bl);
  path.lineTo(x, y + tl);
  path.quadTo(x, y, x + tl, y);
  path.close();
  return path;
}

function drawEyeShape(
  canvas: SkCanvas,
  paint: SkPaint,
  eye: QREyeStyle,
  x: number,
  y: number,
  s: number,
  cellSize: number,
  isTL: boolean,
  isTR: boolean,
  scale: number,
) {
  switch (eye) {
    case "square":
      canvas.drawRect(Skia.XYWHRect(x, y, s, s), paint);
      break;
    case "rounded": {
      const r = cellSize * scale;
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, s, s), r, r), paint);
      break;
    }
    case "circle":
    case "dot": {
      const radius = eye === "dot" ? s * 0.45 : s / 2;
      canvas.drawCircle(x + s / 2, y + s / 2, radius, paint);
      break;
    }
    case "leaf": {
      const bigR = cellSize * (scale === 1.6 ? 2.2 : scale === 1.0 ? 1.4 : 0.9);
      const smallR = cellSize * (scale === 1.6 ? 0.5 : scale === 1.0 ? 0.35 : 0.25);
      const tl = isTL ? bigR : isTR ? smallR : bigR;
      const tr = isTL ? bigR : isTR ? bigR : smallR;
      const br = isTL ? smallR : isTR ? bigR : bigR;
      const bl = isTL ? bigR : isTR ? smallR : smallR;
      const path = buildLeafPath(x, y, s, tl, tr, br, bl);
      canvas.drawPath(path, paint);
      break;
    }
  }
}

function drawFinderPattern(
  canvas: SkCanvas,
  fgPaint: SkPaint,
  bgPaint: SkPaint,
  startRow: number,
  startCol: number,
  cellSize: number,
  offX: number,
  offY: number,
  eye: QREyeStyle,
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

  drawEyeShape(canvas, fgPaint, eye, x, y, s7, cellSize, isTL, isTR, 1.6);
  drawEyeShape(canvas, bgPaint, eye, x5, y5, s5, cellSize, isTL, isTR, 1.0);
  drawEyeShape(canvas, fgPaint, eye, x3, y3, s3, cellSize, isTL, isTR, 0.7);
}

function drawLogo(
  canvas: SkCanvas,
  img: SkImage,
  qrLeft: number,
  qrTop: number,
  qrSize: number,
  bgPaint: SkPaint,
  logoSizePct: number,
  logoFill: boolean,
) {
  const logoSize = qrSize * (logoSizePct / 100);
  const padding = qrSize * 0.02;
  const boxSize = logoSize + padding * 2;
  const cx = qrLeft + qrSize / 2;
  const cy = qrTop + qrSize / 2;
  const boxX = cx - boxSize / 2;
  const boxY = cy - boxSize / 2;

  if (!logoFill) {
    canvas.drawRRect(
      Skia.RRectXY(Skia.XYWHRect(boxX, boxY, boxSize, boxSize), boxSize * 0.18, boxSize * 0.18),
      bgPaint,
    );
  }
  const iw = img.width();
  const ih = img.height();
  const ratio = iw / ih;
  let dw = logoSize;
  let dh = logoSize;
  if (ratio > 1) dh = logoSize / ratio;
  else dw = logoSize * ratio;
  const srcPaint = Skia.Paint();
  srcPaint.setAntiAlias(true);
  canvas.drawImageRect(
    img,
    Skia.XYWHRect(0, 0, iw, ih),
    Skia.XYWHRect(cx - dw / 2, cy - dh / 2, dw, dh),
    srcPaint,
  );
}

function drawCenterText(
  canvas: SkCanvas,
  lines: string[],
  qrLeft: number,
  qrTop: number,
  qrSize: number,
  bgPaint: SkPaint,
  textPaint: SkPaint,
  sizePct: number,
  fillBehind: boolean,
  textColor: string,
  bold: boolean,
) {
  if (lines.length === 0) return;
  const logoSize = qrSize * (sizePct / 100);
  const padding = qrSize * 0.02;
  const boxSize = logoSize + padding * 2;
  const cx = qrLeft + qrSize / 2;
  const cy = qrTop + qrSize / 2;
  const boxX = cx - boxSize / 2;
  const boxY = cy - boxSize / 2;
  const padX = boxSize * 0.1;
  const maxW = boxSize - padX * 2;
  const lineCount = lines.length;
  const lineGap = 1.15;

  if (!fillBehind) {
    canvas.drawRRect(
      Skia.RRectXY(Skia.XYWHRect(boxX, boxY, boxSize, boxSize), boxSize * 0.18, boxSize * 0.18),
      bgPaint,
    );
  }

  const font = Skia.Font();
  font.setEdging(1);
  if (bold) safeEmbolden(font, true);

  let fontSize = Math.round((boxSize / lineCount) * 0.38);
  const minFont = Math.max(7, Math.round(boxSize * 0.08));

  const fits = (size: number): boolean => {
    font.setSize(size);
    const tooWide = lines.some((line) => font.measureText(line).width > maxW);
    const lineH = size * lineGap;
    const totalH = lineCount * lineH - (lineGap - 1) * size;
    return !tooWide && totalH <= boxSize * 0.88;
  };

  while (fontSize > minFont && !fits(fontSize)) fontSize -= 1;

  font.setSize(fontSize);
  textPaint.setColor(Skia.Color(textColor));
  const metrics = font.getMetrics();
  const baselineOffset = -(metrics.ascent + metrics.descent) / 2;
  const lineH = fontSize * lineGap;
  const totalH = lineCount * lineH - (lineGap - 1) * fontSize;
  let y = cy - totalH / 2 + lineH / 2 + baselineOffset;
  for (const line of lines) {
    const textWidth = font.measureText(line).width;
    canvas.drawText(line, cx - textWidth / 2, y, textPaint, font);
    y += lineH;
  }
}

function isInsideScatterShape(
  dx: number,
  dy: number,
  shape: QRScatterShape,
  outerR: number,
): boolean {
  const normDist = Math.sqrt(dx * dx + dy * dy) / outerR;
  const angle = Math.atan2(dy, dx);
  switch (shape) {
    case "square":
      return true;
    case "circle":
      return normDist <= 1;
    case "star": {
      const a2 = angle + Math.PI / 2;
      const points = 5;
      const sa = ((a2 + Math.PI * 2) % (Math.PI * 2)) / ((Math.PI * 2) / points);
      const sectorAngle = sa % 1;
      const outerStarR = 1;
      const innerStarR = 0.45;
      const t = sectorAngle < 0.5 ? sectorAngle * 2 : (1 - sectorAngle) * 2;
      const maxR = outerStarR + (innerStarR - outerStarR) * t;
      return normDist <= maxR;
    }
    case "diamond":
      return Math.abs(dx) / outerR + Math.abs(dy) / outerR <= 1;
    case "hexagon": {
      const s3 = Math.sqrt(3);
      const nx = Math.abs(dx) / outerR;
      const ny = Math.abs(dy) / outerR;
      return ny <= 1 && nx <= s3 / 2 && s3 * ny + nx <= s3;
    }
    case "heart": {
      const s = 0.8;
      const hx = dx / outerR / s;
      const hy = (-dy / outerR + 0.2) / s;
      const eq = hx * hx + hy * hy - 1;
      return eq * eq * eq - hx * hx * hy * hy * hy <= 0;
    }
    case "cross": {
      const nx = Math.abs(dx) / outerR;
      const ny = Math.abs(dy) / outerR;
      return (nx <= 0.35 && ny <= 1) || (ny <= 0.35 && nx <= 1);
    }
    case "octagon": {
      const nx = Math.abs(dx) / outerR;
      const ny = Math.abs(dy) / outerR;
      return nx <= 1 && ny <= 1 && nx + ny <= 1 + Math.SQRT2 - 1;
    }
    case "triangle": {
      const nx = dx / outerR;
      const ny = -(dy / outerR) - 0.15;
      const side = 2 / Math.sqrt(3);
      return ny >= -side && ny <= side && Math.abs(nx) <= ((side - ny) * 0.5) / side * 2;
    }
    default:
      return true;
  }
}

function drawFrameLabel(
  canvas: SkCanvas,
  text: string,
  box: { x: number; y: number; w: number; h: number },
  bgPaint: SkPaint | null,
  textPaint: SkPaint,
) {
  if (bgPaint) {
    canvas.drawRect(Skia.XYWHRect(box.x, box.y, box.w, box.h), bgPaint);
  }
  const padX = Math.max(6, box.w * 0.04);
  const maxW = box.w - padX * 2;
  let fontSize = Math.max(10, Math.round(box.h * 0.42));
  const minFont = Math.max(8, Math.round(box.h * 0.22));

  const font = Skia.Font();
  safeEmbolden(font, true);

  while (fontSize >= minFont) {
    font.setSize(fontSize);
    if (font.measureText(text).width <= maxW) break;
    fontSize -= 1;
  }

  font.setSize(fontSize);
  textPaint.setColor(Skia.Color("#ffffff"));
  const metrics = font.getMetrics();
  const baselineOffset = -(metrics.ascent + metrics.descent) / 2;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2 + baselineOffset;
  const textWidth = font.measureText(text).width;
  canvas.drawText(text, cx - textWidth / 2, cy, textPaint, font);
}

export interface DrawQROptions {
  logoImage?: SkImage | null;
  photoImage?: SkImage | null;
  qrSize?: number;
}

export interface DrawQRResult {
  width: number;
  height: number;
}

export function computeLayout(
  cfg: QRTemplateConfig,
  payload: string,
  qrSize: number,
): { width: number; height: number } {
  const modules = createQRMatrix(payload, cfg.ecc);
  const count = modules.size;
  const margin = cfg.margin;
  const cellSize = qrSize / (count + margin * 2);

  const hasFrame = cfg.frame;
  const barH = hasFrame ? frameBarHeight(qrSize) : 0;
  const captionH = hasFrame && cfg.frameStyle === "bottom" ? barH : 0;
  const ribbonH = hasFrame && cfg.frameStyle === "ribbon" ? barH : 0;
  const framePad =
    hasFrame && cfg.frameStyle === "rounded" ? Math.max(12, Math.round(qrSize * 0.06)) : 0;
  const cellsOut = cfg.scatter ? cfg.scatterDensity : 0;
  const scatterPad = cellsOut * cellSize;
  const canvasW = qrSize + framePad * 2 + scatterPad * 2;
  const canvasH =
    qrSize +
    framePad * 2 +
    scatterPad * 2 +
    (cfg.frameStyle === "bottom" ? captionH : 0) +
    (cfg.frameStyle === "ribbon" ? ribbonH : 0);
  void cellSize;
  return { width: canvasW, height: canvasH };
}

export function drawQR(
  canvas: SkCanvas,
  cfg: QRTemplateConfig,
  payload: string,
  options: DrawQROptions = {},
): DrawQRResult {
  const modules = createQRMatrix(payload, cfg.ecc);
  const count = modules.size;

  const qrSize = options.qrSize ?? 600;
  const margin = cfg.margin;
  const cellSize = qrSize / (count + margin * 2);

  const hasFrame = cfg.frame;
  const barH = hasFrame ? frameBarHeight(qrSize) : 0;
  const captionH = hasFrame && cfg.frameStyle === "bottom" ? barH : 0;
  const ribbonH = hasFrame && cfg.frameStyle === "ribbon" ? barH : 0;
  const framePad =
    hasFrame && cfg.frameStyle === "rounded" ? Math.max(12, Math.round(qrSize * 0.06)) : 0;
  const cellsOut = cfg.scatter ? cfg.scatterDensity : 0;
  const scatterPad = cellsOut * cellSize;
  const canvasW = qrSize + framePad * 2 + scatterPad * 2;
  const canvasH =
    qrSize +
    framePad * 2 +
    scatterPad * 2 +
    (cfg.frameStyle === "bottom" ? captionH : 0) +
    (cfg.frameStyle === "ribbon" ? ribbonH : 0);

  const bgPaint = Skia.Paint();
  bgPaint.setAntiAlias(true);
  const fgPaint = Skia.Paint();
  fgPaint.setAntiAlias(true);

  if (!cfg.bgTransparent) {
    bgPaint.setColor(Skia.Color(cfg.bg));
    canvas.drawRect(Skia.XYWHRect(0, 0, canvasW, canvasH), bgPaint);
  } else {
    canvas.clear(Skia.Color("#00000000"));
  }

  const qrLeft = framePad + scatterPad;
  const qrTop = framePad + scatterPad + (cfg.frameStyle === "ribbon" ? ribbonH : 0);

  if (!cfg.bgTransparent) {
    bgPaint.setColor(Skia.Color(cfg.bg));
    canvas.drawRect(Skia.XYWHRect(qrLeft, qrTop, qrSize, qrSize), bgPaint);
  }

  const offX = qrLeft + margin * cellSize;
  const offY = qrTop + margin * cellSize;

  const fgShader = makeFgShader(cfg, qrLeft, qrTop, qrLeft + qrSize, qrTop + qrSize);
  if (fgShader) {
    fgPaint.setShader(fgShader);
  } else {
    fgPaint.setColor(Skia.Color(cfg.fg));
  }

  const photoImage = options.photoImage ?? null;

  if (photoImage) {
    const iw = photoImage.width();
    const ih = photoImage.height();
    const imgRatio = iw / ih;
    const photoX = cfg.scatter ? 0 : qrLeft;
    const photoY = cfg.scatter ? 0 : qrTop;
    const photoW = cfg.scatter ? canvasW : qrSize;
    const photoH = cfg.scatter ? canvasH : qrSize;
    const photoRatio = photoW / photoH;
    let sx = 0;
    let sy = 0;
    let sw = iw;
    let sh = ih;
    if (imgRatio > photoRatio) {
      sw = ih * photoRatio;
      sx = (iw - sw) / 2;
    } else {
      sh = iw / photoRatio;
      sy = (ih - sh) / 2;
    }
    const imgPaint = Skia.Paint();
    imgPaint.setAntiAlias(true);
    canvas.drawImageRect(
      photoImage,
      Skia.XYWHRect(sx, sy, sw, sh),
      Skia.XYWHRect(photoX, photoY, photoW, photoH),
      imgPaint,
    );

    const lightPaint = Skia.Paint();
    lightPaint.setAntiAlias(true);
    lightPaint.setColor(Skia.Color("#ffffff"));
    lightPaint.setAlphaf(0.6);
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (!modules.data[row * count + col] && !isInFinder(row, col, count)) {
          canvas.drawRect(
            Skia.XYWHRect(offX + col * cellSize, offY + row * cellSize, cellSize, cellSize),
            lightPaint,
          );
        }
      }
    }
    const darkPaint = Skia.Paint();
    darkPaint.setAntiAlias(true);
    if (fgShader) darkPaint.setShader(fgShader);
    else darkPaint.setColor(Skia.Color("#000000"));
    darkPaint.setAlphaf(0.6);
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (modules.data[row * count + col] && !isInFinder(row, col, count)) {
          drawDot(canvas, darkPaint, offX + col * cellSize, offY + row * cellSize, cellSize, cfg.dotStyle);
        }
      }
    }
  } else {
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (modules.data[row * count + col] && !isInFinder(row, col, count)) {
          drawDot(canvas, fgPaint, offX + col * cellSize, offY + row * cellSize, cellSize, cfg.dotStyle);
        }
      }
    }
  }

  const eyeBgForHole = cfg.bgTransparent ? "#ffffff" : cfg.bg;
  const eyeFgPaint = Skia.Paint();
  eyeFgPaint.setAntiAlias(true);
  if (cfg.eyeCustom) {
    eyeFgPaint.setColor(Skia.Color(cfg.eyeColor));
  } else if (fgShader) {
    eyeFgPaint.setColor(Skia.Color(cfg.grad1));
  } else {
    eyeFgPaint.setColor(Skia.Color(cfg.fg));
  }
  const eyeBgPaint = Skia.Paint();
  eyeBgPaint.setAntiAlias(true);
  eyeBgPaint.setColor(Skia.Color(eyeBgForHole));

  drawFinderPattern(canvas, eyeFgPaint, eyeBgPaint, 0, 0, cellSize, offX, offY, cfg.eyeStyle);
  drawFinderPattern(
    canvas,
    eyeFgPaint,
    eyeBgPaint,
    0,
    count - 7,
    cellSize,
    offX,
    offY,
    cfg.eyeStyle,
  );
  drawFinderPattern(
    canvas,
    eyeFgPaint,
    eyeBgPaint,
    count - 7,
    0,
    cellSize,
    offX,
    offY,
    cfg.eyeStyle,
  );

  const bgForCenter = cfg.bgTransparent ? "#ffffff" : cfg.bg;
  const centerBgPaint = Skia.Paint();
  centerBgPaint.setAntiAlias(true);
  centerBgPaint.setColor(Skia.Color(bgForCenter));
  const centerTextPaint = Skia.Paint();
  centerTextPaint.setAntiAlias(true);

  if (cfg.centerMode === "text") {
    const lines = parseCenterTextLines(cfg.centerText);
    if (lines.length > 0) {
      drawCenterText(
        canvas,
        lines,
        qrLeft,
        qrTop,
        qrSize,
        centerBgPaint,
        centerTextPaint,
        cfg.logoSize,
        cfg.logoFill !== false,
        cfg.centerTextColor || cfg.fg,
        cfg.centerTextBold !== false,
      );
    }
  } else {
    const logoImage = options.logoImage;
    if (logoImage) {
      drawLogo(
        canvas,
        logoImage,
        qrLeft,
        qrTop,
        qrSize,
        centerBgPaint,
        cfg.logoSize,
        cfg.logoFill !== false,
      );
    }
  }

  if (hasFrame) {
    const frameColor = cfg.eyeCustom ? cfg.eyeColor : cfg.gradient ? cfg.grad1 : cfg.fg;
    const framePaint = Skia.Paint();
    framePaint.setAntiAlias(true);
    framePaint.setColor(Skia.Color(frameColor));
    const labelPaint = Skia.Paint();
    labelPaint.setAntiAlias(true);

    if (cfg.frameStyle === "rounded") {
      framePaint.setStyle(1);
      framePaint.setStrokeWidth(12);
      const path = Skia.Path.Make();
      path.addRRect(Skia.RRectXY(Skia.XYWHRect(6, 6, canvasW - 12, canvasH - 12), 36, 36));
      canvas.drawPath(path, framePaint);
    } else if (cfg.frameStyle === "bottom") {
      drawFrameLabel(
        canvas,
        cfg.frameText,
        { x: 0, y: qrTop + qrSize, w: canvasW, h: captionH },
        framePaint,
        labelPaint,
      );
    } else if (cfg.frameStyle === "ribbon") {
      const notch = Math.max(8, Math.round(ribbonH * 0.175));
      const ribbonPath = Skia.Path.Make();
      ribbonPath.moveTo(0, 0);
      ribbonPath.lineTo(canvasW, 0);
      ribbonPath.lineTo(canvasW, ribbonH - notch);
      ribbonPath.lineTo(canvasW / 2, ribbonH);
      ribbonPath.lineTo(0, ribbonH - notch);
      ribbonPath.close();
      canvas.drawPath(ribbonPath, framePaint);
      drawFrameLabel(
        canvas,
        cfg.frameText,
        { x: 0, y: 0, w: canvasW, h: ribbonH - notch },
        null,
        labelPaint,
      );
    }
  }

  if (cfg.scatter) {
    const centerX = (count - 1) / 2;
    const centerY = (count - 1) / 2;
    const outerR = centerX + cellsOut;
    const rng = (seed: number) => {
      const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    const scatterShader = makeFgShader(
      cfg,
      offX - cellsOut * cellSize,
      offY - cellsOut * cellSize,
      offX + count * cellSize + cellsOut * cellSize,
      offY + count * cellSize + cellsOut * cellSize,
    );
    const scatterPaint = Skia.Paint();
    scatterPaint.setAntiAlias(true);
    if (scatterShader) scatterPaint.setShader(scatterShader);
    else scatterPaint.setColor(Skia.Color(cfg.fg));

    for (let r = -cellsOut; r < count + cellsOut; r++) {
      for (let c = -cellsOut; c < count + cellsOut; c++) {
        if (r >= 0 && r < count && c >= 0 && c < count) continue;
        const dx = c - centerX;
        const dy = r - centerY;
        if (!isInsideScatterShape(dx, dy, cfg.scatterShape, outerR)) continue;
        if (rng(r * 997 + c + 7) < 0.5) continue;
        const x = offX + c * cellSize;
        const y = offY + r * cellSize;
        if (x < -cellSize || y < -cellSize || x > canvasW + cellSize || y > canvasH + cellSize)
          continue;
        drawDot(canvas, scatterPaint, x, y, cellSize, cfg.dotStyle);
      }
    }
  }

  return { width: canvasW, height: canvasH };
}
