/**
 * Free QR generator — render & payload logic aligned with qrwin-landing free-qr-generator.astro
 */
import type {
  QRCenterTextFont,
  QRDotStyle,
  QREyeStyle,
  QRFrameStyle,
  QRGradientType,
  QRScatterShape,
  QRTemplateConfig,
} from "@/lib/qr-code-templates";

export const CENTER_TEXT_FONTS: { id: QRCenterTextFont; label: string; stack: string }[] = [
  { id: "inter", label: "Inter", stack: "Inter, system-ui, sans-serif" },
  { id: "sans", label: "Без засечек", stack: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" },
  { id: "serif", label: "С засечками", stack: 'Georgia, "Times New Roman", serif' },
  { id: "mono", label: "Моноширинный", stack: 'ui-monospace, "Courier New", monospace' },
  { id: "display", label: "Акцидент", stack: 'Impact, "Arial Black", sans-serif' },
];

export function parseCenterTextLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export function centerTextFontStack(id: QRCenterTextFont | undefined): string {
  return CENTER_TEXT_FONTS.find((f) => f.id === id)?.stack ?? CENTER_TEXT_FONTS[0].stack;
}

export type QRContentType = "url" | "wifi" | "text" | "email" | "phone" | "vcard" | "sms";

export interface QRContentState {
  type: QRContentType;
  url: string;
  wifiSsid: string;
  wifiPass: string;
  wifiEnc: "WPA" | "WEP" | "nopass";
  text: string;
  emailAddr: string;
  emailSubj: string;
  emailBody: string;
  phone: string;
  vcardFname: string;
  vcardLname: string;
  vcardPhone: string;
  vcardEmail: string;
  vcardOrg: string;
  vcardUrl: string;
  smsPhone: string;
  smsBody: string;
}

export const DEFAULT_QR_CONTENT: QRContentState = {
  type: "url",
  url: "https://qrstars.ru",
  wifiSsid: "",
  wifiPass: "",
  wifiEnc: "WPA",
  text: "",
  emailAddr: "",
  emailSubj: "",
  emailBody: "",
  phone: "",
  vcardFname: "",
  vcardLname: "",
  vcardPhone: "",
  vcardEmail: "",
  vcardOrg: "",
  vcardUrl: "",
  smsPhone: "",
  smsBody: "",
};

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
];

export const PHOTO_PRESETS = [
  { name: "Космос", src: "/photo-presets/cosmos.jpg" },
  { name: "Закат", src: "/photo-presets/sunset.jpg" },
  { name: "Лес", src: "/photo-presets/forest.jpg" },
  { name: "Мрамор", src: "/photo-presets/marble.jpg" },
  { name: "Цветы", src: "/photo-presets/flowers.jpg" },
];

function escapeWifiField(val: string): string {
  return val.replace(/([\\;,:"'])/g, "\\$1");
}

export function buildQRPayload(content: QRContentState): string | null {
  switch (content.type) {
    case "url":
      return content.url.trim() || null;
    case "wifi": {
      const ssid = content.wifiSsid.trim();
      if (!ssid) return null;
      return `WIFI:T:${content.wifiEnc};S:${escapeWifiField(ssid)};P:${escapeWifiField(content.wifiPass)};;`;
    }
    case "text":
      return content.text.trim() || null;
    case "email": {
      const addr = content.emailAddr.trim();
      if (!addr) return null;
      let mailto = `mailto:${addr}`;
      const params: string[] = [];
      if (content.emailSubj.trim()) params.push(`subject=${encodeURIComponent(content.emailSubj.trim())}`);
      if (content.emailBody.trim()) params.push(`body=${encodeURIComponent(content.emailBody.trim())}`);
      if (params.length) mailto += "?" + params.join("&");
      return mailto;
    }
    case "phone": {
      const v = content.phone.trim();
      if (!v) return null;
      const digits = v.replace(/[^\d+\-() ]/g, "").replace(/[\-() ]/g, "");
      return `tel:${digits}`;
    }
    case "vcard": {
      const fname = content.vcardFname.trim();
      const lname = content.vcardLname.trim();
      if (!fname && !lname) return null;
      const lines = ["BEGIN:VCARD", "VERSION:3.0"];
      lines.push(`N:${lname};${fname};;;`);
      lines.push(`FN:${[fname, lname].filter(Boolean).join(" ")}`);
      if (content.vcardOrg.trim()) lines.push(`ORG:${content.vcardOrg.trim()}`);
      if (content.vcardPhone.trim()) lines.push(`TEL;TYPE=CELL:${content.vcardPhone.trim()}`);
      if (content.vcardEmail.trim()) lines.push(`EMAIL:${content.vcardEmail.trim()}`);
      if (content.vcardUrl.trim()) lines.push(`URL:${content.vcardUrl.trim()}`);
      lines.push("END:VCARD");
      return lines.join("\n");
    }
    case "sms": {
      const phone = content.smsPhone.trim();
      if (!phone) return null;
      const body = content.smsBody.trim();
      const digits = phone.replace(/[^\d+]/g, "");
      return body ? `SMSTO:${digits}:${body}` : `sms:${digits}`;
    }
    default:
      return null;
  }
}

export function emojiToImage(emoji: string): HTMLImageElement {
  const size = 200;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ectx = c.getContext("2d")!;
  ectx.clearRect(0, 0, size, size);
  ectx.font = `${size * 0.7}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ectx.textAlign = "center";
  ectx.textBaseline = "middle";
  ectx.fillText(emoji, size / 2, size / 2);
  const img = new Image();
  img.src = c.toDataURL();
  return img;
}

export function loadLogoPreset(p: LogoPreset): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (p.src) {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = p.src;
      return;
    }
    if (p.emoji) {
      const img = emojiToImage(p.emoji);
      if (img.complete) resolve(img);
      else img.onload = () => resolve(img);
      return;
    }
    reject(new Error("empty preset"));
  });
}

export async function resolveLogoImage(
  cfg: QRTemplateConfig,
  override?: HTMLImageElement | null,
): Promise<HTMLImageElement | null> {
  if (override) return override;
  if (cfg.logoDataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = cfg.logoDataUrl!;
    });
  }
  if (cfg.logoSrc) {
    return loadLogoPreset({ name: "", src: cfg.logoSrc });
  }
  if (cfg.logoPreset) {
    return Promise.resolve(emojiToImage(cfg.logoPreset));
  }
  return null;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
  ctx.fill();
}

function strokeRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
  ctx.stroke();
}

function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, style: QRDotStyle) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const gap = style === "classic" ? 0 : size * 0.1;
  const s = size - gap * 2;
  const r = s / 2;
  switch (style) {
    case "classic":
      ctx.fillRect(x, y, size, size);
      break;
    case "rounded":
      roundRect(ctx, x + gap, y + gap, s, s, s * 0.3);
      break;
    default:
      ctx.fillRect(x, y, size, size);
  }
  void cx;
  void cy;
  void r;
}

function isInFinder(row: number, col: number, count: number): boolean {
  if (row < 8 && col < 8) return true;
  if (row < 8 && col >= count - 8) return true;
  if (row >= count - 8 && col < 8) return true;
  return false;
}

function drawFinderPattern(
  ctx: CanvasRenderingContext2D,
  startRow: number,
  startCol: number,
  cellSize: number,
  offX: number,
  offY: number,
  eye: QREyeStyle,
  bgColor: string,
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

  const drawOuter = () => {
    switch (eye) {
      case "square":
        ctx.fillRect(x, y, s7, s7);
        break;
      case "rounded":
        roundRect(ctx, x, y, s7, s7, cellSize * 1.6);
        break;
      case "circle":
        ctx.beginPath();
        ctx.arc(x + s7 / 2, y + s7 / 2, s7 / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "leaf": {
        const r = cellSize * 2.2;
        const small = cellSize * 0.5;
        const tl = isTL ? r : isTR ? small : r;
        const tr = isTL ? r : isTR ? r : small;
        const br = isTL ? small : isTR ? r : r;
        const bl = isTL ? r : isTR ? small : small;
        ctx.beginPath();
        ctx.moveTo(x + tl, y);
        ctx.lineTo(x + s7 - tr, y);
        ctx.quadraticCurveTo(x + s7, y, x + s7, y + tr);
        ctx.lineTo(x + s7, y + s7 - br);
        ctx.quadraticCurveTo(x + s7, y + s7, x + s7 - br, y + s7);
        ctx.lineTo(x + bl, y + s7);
        ctx.quadraticCurveTo(x, y + s7, x, y + s7 - bl);
        ctx.lineTo(x, y + tl);
        ctx.quadraticCurveTo(x, y, x + tl, y);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "dot":
        ctx.beginPath();
        ctx.arc(x + s7 / 2, y + s7 / 2, s7 / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
  };

  const drawInnerHole = () => {
    switch (eye) {
      case "square":
        ctx.fillRect(x5, y5, s5, s5);
        break;
      case "rounded":
        roundRect(ctx, x5, y5, s5, s5, cellSize * 1.0);
        break;
      case "circle":
        ctx.beginPath();
        ctx.arc(x5 + s5 / 2, y5 + s5 / 2, s5 / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "leaf": {
        const r = cellSize * 1.4;
        const small = cellSize * 0.35;
        const tl = isTL ? r : isTR ? small : r;
        const tr = isTL ? r : isTR ? r : small;
        const br = isTL ? small : isTR ? r : r;
        const bl = isTL ? r : isTR ? small : small;
        ctx.beginPath();
        ctx.moveTo(x5 + tl, y5);
        ctx.lineTo(x5 + s5 - tr, y5);
        ctx.quadraticCurveTo(x5 + s5, y5, x5 + s5, y5 + tr);
        ctx.lineTo(x5 + s5, y5 + s5 - br);
        ctx.quadraticCurveTo(x5 + s5, y5 + s5, x5 + s5 - br, y5 + s5);
        ctx.lineTo(x5 + bl, y5 + s5);
        ctx.quadraticCurveTo(x5, y5 + s5, x5, y5 + s5 - bl);
        ctx.lineTo(x5, y5 + tl);
        ctx.quadraticCurveTo(x5, y5, x5 + tl, y5);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "dot":
        ctx.beginPath();
        ctx.arc(x5 + s5 / 2, y5 + s5 / 2, s5 / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
  };

  const drawCenter = () => {
    switch (eye) {
      case "square":
        ctx.fillRect(x3, y3, s3, s3);
        break;
      case "rounded":
        roundRect(ctx, x3, y3, s3, s3, cellSize * 0.7);
        break;
      case "circle":
        ctx.beginPath();
        ctx.arc(x3 + s3 / 2, y3 + s3 / 2, s3 / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "leaf": {
        const r = cellSize * 0.9;
        const small = cellSize * 0.25;
        const tl = isTL ? r : isTR ? small : r;
        const tr = isTL ? r : isTR ? r : small;
        const br = isTL ? small : isTR ? r : r;
        const bl = isTL ? r : isTR ? small : small;
        ctx.beginPath();
        ctx.moveTo(x3 + tl, y3);
        ctx.lineTo(x3 + s3 - tr, y3);
        ctx.quadraticCurveTo(x3 + s3, y3, x3 + s3, y3 + tr);
        ctx.lineTo(x3 + s3, y3 + s3 - br);
        ctx.quadraticCurveTo(x3 + s3, y3 + s3, x3 + s3 - br, y3 + s3);
        ctx.lineTo(x3 + bl, y3 + s3);
        ctx.quadraticCurveTo(x3, y3 + s3, x3, y3 + s3 - bl);
        ctx.lineTo(x3, y3 + tl);
        ctx.quadraticCurveTo(x3, y3, x3 + tl, y3);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "dot":
        ctx.beginPath();
        ctx.arc(x3 + s3 / 2, y3 + s3 / 2, s3 * 0.45, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
  };

  const savedFill = ctx.fillStyle;
  drawOuter();
  ctx.fillStyle = bgColor;
  drawInnerHole();
  ctx.fillStyle = savedFill;
  drawCenter();
}

function makeFgFill(
  ctx: CanvasRenderingContext2D,
  cfg: QRTemplateConfig,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): CanvasGradient | string {
  if (!cfg.gradient) return cfg.fg;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  let g: CanvasGradient;
  switch (cfg.gradType) {
    case "linear-tb":
      g = ctx.createLinearGradient(x0, y0, x0, y1);
      break;
    case "linear-lr":
      g = ctx.createLinearGradient(x0, y0, x1, y0);
      break;
    case "linear-diag":
      g = ctx.createLinearGradient(x0, y0, x1, y1);
      break;
    case "radial":
      g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(x1 - x0, y1 - y0) / 2);
      break;
    default:
      g = ctx.createLinearGradient(x0, y0, x0, y1);
  }
  g.addColorStop(0, cfg.grad1);
  g.addColorStop(1, cfg.grad2);
  return g;
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  qrLeft: number,
  qrTop: number,
  qrSize: number,
  bgColor: string,
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
  ctx.save();
  if (!logoFill) {
    ctx.fillStyle = bgColor;
    roundRect(ctx, boxX, boxY, boxSize, boxSize, boxSize * 0.18);
  }
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const ratio = iw / ih;
  let dw = logoSize;
  let dh = logoSize;
  if (ratio > 1) dh = logoSize / ratio;
  else dw = logoSize * ratio;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
}

function drawCenterText(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  qrLeft: number,
  qrTop: number,
  qrSize: number,
  bgColor: string,
  sizePct: number,
  fillBehind: boolean,
  textColor: string,
  fontStack: string,
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
  const weight = bold ? "800" : "600";

  ctx.save();
  if (!fillBehind) {
    ctx.fillStyle = bgColor;
    roundRect(ctx, boxX, boxY, boxSize, boxSize, boxSize * 0.18);
  }

  let fontSize = Math.round((boxSize / lineCount) * 0.38);
  const minFont = Math.max(7, Math.round(boxSize * 0.08));
  const lineGap = 1.15;

  const fits = (size: number) => {
    ctx.font = `${weight} ${size}px ${fontStack}`;
    const tooWide = lines.some((line) => ctx.measureText(line).width > maxW);
    const lineH = size * lineGap;
    const totalH = lineCount * lineH - (lineGap - 1) * size;
    return !tooWide && totalH <= boxSize * 0.88;
  };

  while (fontSize > minFont && !fits(fontSize)) fontSize -= 1;

  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${weight} ${fontSize}px ${fontStack}`;
  const lineH = fontSize * lineGap;
  const totalH = lineCount * lineH - (lineGap - 1) * fontSize;
  let y = cy - totalH / 2 + lineH / 2;
  for (const line of lines) {
    ctx.fillText(line, cx, y);
    y += lineH;
  }
  ctx.restore();
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

/** Caption / ribbon bar height scales with QR size (reference: 80px at 600px QR). */
const FRAME_BAR_HEIGHT_RATIO = 80 / 600;

function frameBarHeight(qrSize: number): number {
  return Math.max(28, Math.round(qrSize * FRAME_BAR_HEIGHT_RATIO));
}

/** Draw label on a frame bar; shrinks font until text fits horizontally. */
function drawFrameLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: { x: number; y: number; w: number; h: number },
  bgColor: string | null,
): void {
  ctx.save();
  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(box.x, box.y, box.w, box.h);
  }
  const padX = Math.max(6, box.w * 0.04);
  const maxW = box.w - padX * 2;
  let fontSize = Math.max(10, Math.round(box.h * 0.42));
  const minFont = Math.max(8, Math.round(box.h * 0.22));
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  while (fontSize >= minFont) {
    ctx.font = `800 ${fontSize}px Inter, system-ui, sans-serif`;
    if (ctx.measureText(text).width <= maxW) break;
    fontSize -= 1;
  }
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

export interface RenderFreeQROptions {
  logoImage?: HTMLImageElement | null;
  photoImage?: HTMLImageElement | null;
  qrSize?: number;
}

/** Render QR to canvas — same algorithm as landing free-qr-generator */
export async function renderFreeQR(
  canvas: HTMLCanvasElement,
  cfg: QRTemplateConfig,
  payload: string,
  options: RenderFreeQROptions = {},
): Promise<void> {
  const QRLib = await import("qrcode");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qrData = (QRLib as any).create(payload, { errorCorrectionLevel: cfg.ecc });
  const modules = qrData.modules;
  const count = modules.size;

  const qrSize = options.qrSize ?? 600;
  const margin = cfg.margin;
  const cellSize = qrSize / (count + margin * 2);

  const hasFrame = cfg.frame;
  const barH = hasFrame ? frameBarHeight(qrSize) : 0;
  const captionH = hasFrame && cfg.frameStyle === "bottom" ? barH : 0;
  const ribbonH = hasFrame && cfg.frameStyle === "ribbon" ? barH : 0;
  const framePad = hasFrame && cfg.frameStyle === "rounded" ? Math.max(12, Math.round(qrSize * 0.06)) : 0;
  const cellsOut = cfg.scatter ? cfg.scatterDensity : 0;
  const scatterPad = cellsOut * cellSize;
  const canvasW = qrSize + framePad * 2 + scatterPad * 2;
  const canvasH =
    qrSize +
    framePad * 2 +
    scatterPad * 2 +
    (cfg.frameStyle === "bottom" ? captionH : 0) +
    (cfg.frameStyle === "ribbon" ? ribbonH : 0);

  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d")!;

  if (!cfg.bgTransparent) {
    ctx.fillStyle = cfg.bg;
    ctx.fillRect(0, 0, canvasW, canvasH);
  } else {
    ctx.clearRect(0, 0, canvasW, canvasH);
  }

  const qrLeft = framePad + scatterPad;
  const qrTop = framePad + scatterPad + (cfg.frameStyle === "ribbon" ? ribbonH : 0);

  if (!cfg.bgTransparent) {
    ctx.fillStyle = cfg.bg;
    ctx.fillRect(qrLeft, qrTop, qrSize, qrSize);
  }

  const offX = qrLeft + margin * cellSize;
  const offY = qrTop + margin * cellSize;
  const fgFill = makeFgFill(ctx, cfg, qrLeft, qrTop, qrLeft + qrSize, qrTop + qrSize);
  const photoImage = options.photoImage ?? null;

  if (photoImage) {
    const iw = photoImage.naturalWidth || photoImage.width;
    const ih = photoImage.naturalHeight || photoImage.height;
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
    ctx.drawImage(photoImage, sx, sy, sw, sh, photoX, photoY, photoW, photoH);

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (!modules.data[row * count + col] && !isInFinder(row, col, count)) {
          ctx.fillRect(offX + col * cellSize, offY + row * cellSize, cellSize, cellSize);
        }
      }
    }
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (modules.data[row * count + col] && !isInFinder(row, col, count)) {
          drawDot(ctx, offX + col * cellSize, offY + row * cellSize, cellSize, cfg.dotStyle);
        }
      }
    }
  } else {
    ctx.fillStyle = fgFill;
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (modules.data[row * count + col] && !isInFinder(row, col, count)) {
          drawDot(ctx, offX + col * cellSize, offY + row * cellSize, cellSize, cfg.dotStyle);
        }
      }
    }
  }

  const eyeBgForHole = cfg.bgTransparent ? "#ffffff" : cfg.bg;
  ctx.fillStyle = cfg.eyeCustom ? cfg.eyeColor : typeof fgFill === "string" ? fgFill : cfg.grad1;
  drawFinderPattern(ctx, 0, 0, cellSize, offX, offY, cfg.eyeStyle, eyeBgForHole);
  drawFinderPattern(ctx, 0, count - 7, cellSize, offX, offY, cfg.eyeStyle, eyeBgForHole);
  drawFinderPattern(ctx, count - 7, 0, cellSize, offX, offY, cfg.eyeStyle, eyeBgForHole);

  const bgForCenter = cfg.bgTransparent ? "#ffffff" : cfg.bg;
  if (cfg.centerMode === "text") {
    const lines = parseCenterTextLines(cfg.centerText);
    if (lines.length > 0) {
      drawCenterText(
        ctx,
        lines,
        qrLeft,
        qrTop,
        qrSize,
        bgForCenter,
        cfg.logoSize,
        cfg.logoFill !== false,
        cfg.centerTextColor || cfg.fg,
        centerTextFontStack(cfg.centerTextFont),
        cfg.centerTextBold !== false,
      );
    }
  } else {
    const logoImage = options.logoImage ?? (await resolveLogoImage(cfg));
    if (logoImage) {
      drawLogo(
        ctx,
        logoImage,
        qrLeft,
        qrTop,
        qrSize,
        bgForCenter,
        cfg.logoSize,
        cfg.logoFill !== false,
      );
    }
  }

  if (hasFrame) {
    const frameColor = cfg.eyeCustom ? cfg.eyeColor : cfg.gradient ? cfg.grad1 : cfg.fg;
    if (cfg.frameStyle === "rounded") {
      ctx.save();
      ctx.strokeStyle = frameColor;
      ctx.lineWidth = 12;
      strokeRoundRect(ctx, 6, 6, canvasW - 12, canvasH - 12, 36);
      ctx.restore();
    } else if (cfg.frameStyle === "bottom") {
      drawFrameLabel(ctx, cfg.frameText, {
        x: 0,
        y: qrTop + qrSize,
        w: canvasW,
        h: captionH,
      }, frameColor);
    } else if (cfg.frameStyle === "ribbon") {
      const notch = Math.max(8, Math.round(ribbonH * 0.175));
      ctx.save();
      ctx.fillStyle = frameColor;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(canvasW, 0);
      ctx.lineTo(canvasW, ribbonH - notch);
      ctx.lineTo(canvasW / 2, ribbonH);
      ctx.lineTo(0, ribbonH - notch);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      drawFrameLabel(ctx, cfg.frameText, {
        x: 0,
        y: 0,
        w: canvasW,
        h: ribbonH - notch,
      }, null);
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
    const scatterFill = makeFgFill(
      ctx,
      cfg,
      offX - cellsOut * cellSize,
      offY - cellsOut * cellSize,
      offX + count * cellSize + cellsOut * cellSize,
      offY + count * cellSize + cellsOut * cellSize,
    );
    ctx.fillStyle = scatterFill;
    for (let r = -cellsOut; r < count + cellsOut; r++) {
      for (let c = -cellsOut; c < count + cellsOut; c++) {
        if (r >= 0 && r < count && c >= 0 && c < count) continue;
        const dx = c - centerX;
        const dy = r - centerY;
        if (!isInsideScatterShape(dx, dy, cfg.scatterShape, outerR)) continue;
        if (rng(r * 997 + c + 7) < 0.5) continue;
        const x = offX + c * cellSize;
        const y = offY + r * cellSize;
        if (x < -cellSize || y < -cellSize || x > canvasW + cellSize || y > canvasH + cellSize) continue;
        drawDot(ctx, x, y, cellSize, cfg.dotStyle);
      }
    }
  }
}

/** Returns true if photo QR contrast looks OK */
export function photoReadabilityOk(
  canvas: HTMLCanvasElement,
  qrLeft: number,
  qrTop: number,
  qrSize: number,
  moduleCount: number,
  margin: number,
  modulesData: Uint8Array,
): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return true;
  const cellSize = qrSize / (moduleCount + margin * 2);
  const offX = qrLeft + margin * cellSize;
  const offY = qrTop + margin * cellSize;
  const rendered = ctx.getImageData(qrLeft, qrTop, qrSize, qrSize);
  let darkLum = 0;
  let lightLum = 0;
  let darkN = 0;
  let lightN = 0;
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (isInFinder(row, col, moduleCount)) continue;
      const px = Math.floor(offX - qrLeft + (col + 0.5) * cellSize);
      const py = Math.floor(offY - qrTop + (row + 0.5) * cellSize);
      const idx = (py * qrSize + px) * 4;
      const r = rendered.data[idx];
      const g = rendered.data[idx + 1];
      const b = rendered.data[idx + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (modulesData[row * moduleCount + col]) {
        darkLum += lum;
        darkN++;
      } else {
        lightLum += lum;
        lightN++;
      }
    }
  }
  const avgDark = darkN ? darkLum / darkN : 0;
  const avgLight = lightN ? lightLum / lightN : 255;
  const L1 = Math.max(avgDark, avgLight);
  const L2 = Math.min(avgDark, avgLight);
  const contrast = (L1 - L2) / 255;
  return contrast >= 0.25;
}

/** Style preview thumbnails for dot/eye pickers */
export function renderDotStylePreview(canvas: HTMLCanvasElement, style: QRDotStyle) {
  const size = canvas.width;
  const ctx = canvas.getContext("2d")!;
  const cellSize = size / 5;
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
      if (pattern[row][col]) drawDot(ctx, col * cellSize, row * cellSize, cellSize, style);
    }
  }
}

export function renderEyeStylePreview(canvas: HTMLCanvasElement, eye: QREyeStyle) {
  const size = canvas.width;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  const cell = size / 8;
  const offX = cell / 2;
  const offY = cell / 2;
  ctx.fillStyle = "#1e293b";
  drawFinderPattern(ctx, 0, 0, cell, offX, offY, eye, "#ffffff");
}
