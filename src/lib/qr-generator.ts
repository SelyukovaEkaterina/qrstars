import QRCodeLib from "qrcode";
import { toSameOriginStorageUrl } from "@/lib/utils";

const DEFAULT_WATERMARK = "qrstars.ru";

function loadImage(src: string): Promise<HTMLImageElement> {
  const canvasSrc = toSameOriginStorageUrl(src);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = canvasSrc;
  });
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
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

export interface QRCenterOptions {
  centerText?: string | null;
  centerLogoUrl?: string | null;
  isPro: boolean;
  /** No center overlay on FREE (default shows qrstars.ru watermark). */
  skipWatermark?: boolean;
}

export async function generateQRWithCenter(
  text: string,
  options: QRCenterOptions,
  size: number = 512,
  darkColor: string = "#1e1b4b",
  lightColor: string = "#ffffff"
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  await QRCodeLib.toCanvas(canvas, text, {
    width: size,
    margin: 2,
    color: { dark: darkColor, light: lightColor },
    errorCorrectionLevel: "H",
  });

  const ctx = canvas.getContext("2d")!;

  const centerSize = size * 0.22;
  const cx = size / 2;
  const cy = size / 2;
  const r = centerSize * 0.12;

  let overlayText: string | null = null;
  let overlayLogoUrl: string | null = null;

  if (options.isPro) {
    if (options.centerLogoUrl) {
      overlayLogoUrl = options.centerLogoUrl;
    } else if (options.centerText) {
      overlayText = options.centerText;
    }
  } else if (!options.skipWatermark) {
    overlayText = DEFAULT_WATERMARK;
  }

  if (overlayLogoUrl) {
    try {
      const img = await loadImage(overlayLogoUrl);
      const padding = centerSize * 0.15;
      const logoSize = centerSize - padding * 2;

      ctx.fillStyle = "#ffffff";
      drawRoundRect(
        ctx,
        cx - centerSize / 2,
        cy - centerSize / 2,
        centerSize,
        centerSize,
        r
      );
      ctx.fill();

      const aspect = img.width / img.height;
      let drawW = logoSize;
      let drawH = logoSize;
      if (aspect > 1) {
        drawH = logoSize / aspect;
      } else {
        drawW = logoSize * aspect;
      }

      ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
    } catch {
      if (options.isPro) {
        overlayText = options.centerText || null;
      } else {
        overlayText = overlayText || DEFAULT_WATERMARK;
      }
    }
  }

  if (overlayText) {
    ctx.fillStyle = "#ffffff";
    drawRoundRect(
      ctx,
      cx - centerSize / 2,
      cy - centerSize / 2,
      centerSize,
      centerSize,
      r
    );
    ctx.fill();

    const isWatermark = overlayText === DEFAULT_WATERMARK;
    const maxFontSize = isWatermark ? centerSize * 0.22 : centerSize * 0.32;

    let fontSize = maxFontSize;
    ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
    while (ctx.measureText(overlayText).width > centerSize * 0.85 && fontSize > 4) {
      fontSize -= 1;
      ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
    }

    ctx.fillStyle = darkColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(overlayText, cx, cy);
  }

  return canvas.toDataURL("image/png");
}

async function imageToDataUrl(src: string): Promise<string> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext("2d")!.drawImage(img, 0, 0);
  return canvas.toDataURL("image/png");
}

function svgRoundRect(cx: number, cy: number, w: number, h: number, r: number): string {
  const x = cx - w / 2;
  const y = cy - h / 2;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#ffffff"/>`;
}

export async function generateQRSvg(
  text: string,
  options: QRCenterOptions,
  size: number = 512,
  darkColor: string = "#1e1b4b",
  lightColor: string = "#ffffff",
): Promise<string> {
  let svg = await QRCodeLib.toString(text, {
    type: "svg",
    width: size,
    margin: 2,
    color: { dark: darkColor, light: lightColor },
    errorCorrectionLevel: "H",
  });

  const centerSize = size * 0.22;
  const cx = size / 2;
  const cy = size / 2;
  const r = centerSize * 0.12;

  let overlayText: string | null = null;
  let overlayLogoUrl: string | null = null;

  if (options.isPro) {
    if (options.centerLogoUrl) {
      overlayLogoUrl = options.centerLogoUrl;
    } else if (options.centerText) {
      overlayText = options.centerText;
    }
  } else if (!options.skipWatermark) {
    overlayText = DEFAULT_WATERMARK;
  }

  const overlayParts: string[] = [];

  if (overlayLogoUrl) {
    try {
      const logoData = await imageToDataUrl(overlayLogoUrl);
      const padding = centerSize * 0.15;
      const logoSize = centerSize - padding * 2;
      overlayParts.push(svgRoundRect(cx, cy, centerSize, centerSize, r));
      overlayParts.push(
        `<image href="${logoData}" x="${cx - logoSize / 2}" y="${cy - logoSize / 2}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`,
      );
    } catch {
      if (options.isPro) {
        overlayText = options.centerText || null;
      } else {
        overlayText = overlayText || DEFAULT_WATERMARK;
      }
    }
  }

  if (overlayText) {
    const isWatermark = overlayText === DEFAULT_WATERMARK;
    const fontSize = isWatermark ? centerSize * 0.22 : centerSize * 0.32;
    const escaped = overlayText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    overlayParts.push(svgRoundRect(cx, cy, centerSize, centerSize, r));
    overlayParts.push(
      `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" fill="${darkColor}" font-family="Inter, system-ui, sans-serif" font-weight="bold" font-size="${fontSize}">${escaped}</text>`,
    );
  }

  if (overlayParts.length > 0) {
    svg = svg.replace("</svg>", `${overlayParts.join("")}</svg>`);
  }

  return svg;
}

export async function generateQRForPdfWithCenter(
  text: string,
  options: QRCenterOptions,
  size: number = 1024,
  darkColor: string = "#1e1b4b",
  lightColor: string = "#ffffff"
): Promise<string> {
  return generateQRWithCenter(text, options, size, darkColor, lightColor);
}
