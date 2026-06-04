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
  } else {
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

export async function generateQRForPdfWithCenter(
  text: string,
  options: QRCenterOptions,
  size: number = 1024,
  darkColor: string = "#1e1b4b",
  lightColor: string = "#ffffff"
): Promise<string> {
  return generateQRWithCenter(text, options, size, darkColor, lightColor);
}
