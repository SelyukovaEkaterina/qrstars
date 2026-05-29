import { TemplateLayout } from "@/types/template";
import { generateQRWithCenter, type QRCenterOptions } from "./qr-generator";
import { toSameOriginStorageUrl } from "@/lib/utils";

const DPI = 300;
const MM_TO_PX = DPI / 25.4;

function loadImg(src: string): Promise<HTMLImageElement> {
  const canvasSrc = toSameOriginStorageUrl(src);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      if (canvasSrc !== src) {
        const fallback = new Image();
        fallback.crossOrigin = "anonymous";
        fallback.onload = () => resolve(fallback);
        fallback.onerror = reject;
        fallback.src = src;
        return;
      }
      reject(new Error("Failed to load image"));
    };
    img.src = canvasSrc;
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const lines = text.split("\n");
  let currentY = y;
  for (const line of lines) {
    const words = line.split(" ");
    let currentLine = "";
    for (const word of words) {
      const testLine = currentLine + word + " ";
      if (ctx.measureText(testLine).width > maxWidth && currentLine !== "") {
        ctx.fillText(currentLine.trim(), x, currentY);
        currentLine = word + " ";
        currentY += lineHeight;
      } else {
        currentLine = testLine;
      }
    }
    ctx.fillText(currentLine.trim(), x, currentY);
    currentY += lineHeight;
  }
}

function roundRect(
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

export async function generatePDFFromLayout(
  layout: TemplateLayout,
  qrDataUrl?: string
): Promise<void> {
  const canvasW = Math.round(layout.width * MM_TO_PX);
  const canvasH = Math.round(layout.height * MM_TO_PX);

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d")!;

  // Background
  if (layout.background.type === "gradient" && layout.background.gradientFrom && layout.background.gradientTo) {
    const angle = ((layout.background.gradientAngle || 180) * Math.PI) / 180;
    const cx = canvasW / 2;
    const cy = canvasH / 2;
    const len = Math.max(canvasW, canvasH);
    const grad = ctx.createLinearGradient(
      cx - (Math.cos(angle) * len) / 2,
      cy - (Math.sin(angle) * len) / 2,
      cx + (Math.cos(angle) * len) / 2,
      cy + (Math.sin(angle) * len) / 2
    );
    grad.addColorStop(0, layout.background.gradientFrom);
    grad.addColorStop(1, layout.background.gradientTo);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);
  } else {
    ctx.fillStyle = layout.background.color || "#ffffff";
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  // Elements (draw in order)
  for (const el of layout.elements) {
    const x = (el.x / 100) * canvasW;
    const y = (el.y / 100) * canvasH;
    const w = (el.width / 100) * canvasW;
    const h = (el.height / 100) * canvasH;

    ctx.globalAlpha = el.opacity ?? 1;

    switch (el.type) {
      case "text": {
        const baseFontSize = (el.fontSize || 4) * MM_TO_PX;
        ctx.fillStyle = el.color || "#000000";
        ctx.font = `${el.fontWeight || "normal"} ${baseFontSize}px Inter, sans-serif`;
        ctx.textAlign = el.textAlign || "center";
        ctx.textBaseline = "top";
        const textX = el.textAlign === "center" ? x + w / 2 : el.textAlign === "right" ? x + w : x;
        wrapText(ctx, el.text || "", textX, y, w, baseFontSize * 1.3);
        break;
      }
      case "qr": {
        const qrSrc = qrDataUrl;
        if (qrSrc) {
          try {
            const img = await loadImg(qrSrc);
            const padding = w * 0.04;
            const qrW = w - padding * 2;
            const qrH = h - padding * 2;

            if (el.qrBgColor && el.qrBgColor !== "transparent") {
              ctx.fillStyle = el.qrBgColor;
              const r = Math.max(1, w * 0.03);
              roundRect(ctx, x, y, w, h, r);
              ctx.fill();
            }

            ctx.drawImage(img, x + padding, y + padding, qrW, qrH);
          } catch {
            ctx.fillStyle = "#ccc";
            ctx.fillRect(x, y, w, h);
          }
        } else {
          ctx.fillStyle = "#e5e7eb";
          ctx.fillRect(x, y, w, h);
          ctx.fillStyle = "#9ca3af";
          ctx.font = `bold ${w * 0.08}px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("QR", x + w / 2, y + h / 2);
        }
        break;
      }
      case "shape": {
        if (el.fill && el.fill !== "transparent") {
          ctx.fillStyle = el.fill;
          if (el.shape === "circle") {
            ctx.beginPath();
            ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
            ctx.fill();
          } else {
            const r = ((el.borderRadius || 0) / 100) * Math.min(w, h);
            roundRect(ctx, x, y, w, h, r);
            ctx.fill();
          }
        }
        if (el.stroke) {
          ctx.strokeStyle = el.stroke;
          ctx.lineWidth = (el.strokeWidth || 1) * MM_TO_PX;
          if (el.shape === "circle") {
            ctx.beginPath();
            ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            const r = ((el.borderRadius || 0) / 100) * Math.min(w, h);
            roundRect(ctx, x, y, w, h, r);
            ctx.stroke();
          }
        }
        break;
      }
      case "image": {
        if (el.imageUrl) {
          try {
            const img = await loadImg(el.imageUrl);
            ctx.drawImage(img, x, y, w, h);
          } catch {
            // skip
          }
        }
        break;
      }
    }

    ctx.globalAlpha = 1;
  }

  // Generate PDF
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: layout.width > layout.height ? "landscape" : "portrait",
    unit: "mm",
    format: [layout.width, layout.height],
  });

  const imgData = canvas.toDataURL("image/png", 1.0);
  doc.addImage(imgData, "PNG", 0, 0, layout.width, layout.height);
  doc.save("qrstars-template.pdf");
}

function normalizeColor(color: string, fallback: string): string {
  if (!color || color === "transparent") return fallback;
  return color;
}

export async function generateQRForPDF(
  qrText: string,
  darkColor: string = "#1e1b4b",
  lightColor: string = "#ffffff",
  centerOptions?: QRCenterOptions
): Promise<string> {
  if (centerOptions) {
    return generateQRWithCenter(qrText, centerOptions, 1024, darkColor, lightColor);
  }

  const QRCodeLib = await import("qrcode");
  return QRCodeLib.default.toDataURL(qrText, {
    width: 1024,
    margin: 1,
    color: {
      dark: normalizeColor(darkColor, "#1e1b4b"),
      light: normalizeColor(lightColor, "#ffffff"),
    },
  });
}
