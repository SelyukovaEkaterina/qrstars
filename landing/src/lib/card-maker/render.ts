/**
 * Отрисовка бумажной визитки 90×50 мм на canvas.
 *
 * Координаты шаблонов — в десятых долях миллиметра (u): визитка 900×500 u, вылеты по 20 u.
 * Шрифты задаются в u, поэтому на любом масштабе текст рисуется крупным размером
 * (без микроскопических font-size, которые браузеры рендерят неровно).
 */

export const CARD_W = 900;
export const CARD_H = 500;
export const BLEED = 20;
export const SAFE = 40;
/** Пикселей на u при 300 dpi: 300 / 25.4 / 10. */
export const U_PER_MM = 10;

export type TemplateId = 'minimal' | 'dark' | 'band' | 'gradient' | 'master' | 'soft' | 'mono' | 'bold';
export type QrPlace = 'none' | 'front' | 'back';
export type FontId = 'sans' | 'serif';

export interface CardData {
  name: string;
  title: string;
  phone: string;
  line2: string;
  line3: string;
  tagline: string;
}

export interface QrMatrix {
  size: number;
  get(row: number, col: number): boolean;
}

export interface RenderInput {
  template: TemplateId;
  data: CardData;
  accent: string;
  font: FontId;
  qr: QrMatrix | null;
  qrPlace: QrPlace;
  qrCaption: string;
  logo: CanvasImageSource | null;
}

export const TEMPLATES: { id: TemplateId; label: string; font: FontId }[] = [
  { id: 'minimal', label: 'Минимал', font: 'sans' },
  { id: 'master', label: 'Мастер', font: 'sans' },
  { id: 'dark', label: 'Тёмная', font: 'sans' },
  { id: 'band', label: 'Полоса', font: 'sans' },
  { id: 'gradient', label: 'Градиент', font: 'sans' },
  { id: 'soft', label: 'Нежная', font: 'serif' },
  { id: 'mono', label: 'Монограмма', font: 'sans' },
  { id: 'bold', label: 'Яркая', font: 'sans' },
];

export const ACCENTS = [
  '#4F46E5', '#111827', '#1E3A8A', '#0F766E', '#047857',
  '#DC2626', '#EA580C', '#B45309', '#DB2777', '#7C3AED',
];

// ───────────────────────── цвета ─────────────────────────

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return [79, 70, 229];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: Rgb): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

/** Смесь цветов: t — доля второго цвета. */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

function luminance(hex: string): number {
  const c = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Текст поверх цвета: белый, если читается, иначе почти чёрный. */
function onColor(bg: string): string {
  return contrast(bg, '#ffffff') >= 2.6 ? '#ffffff' : '#111827';
}

function withAlpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function hueShift(hex: string, deg: number): string {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  h = (h + deg / 360 + 1) % 1;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return s === 0 ? hex : rgbToHex([f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]);
}

/** Цвет модулей QR на белой подложке: акцент, если хватает контраста. */
function qrInk(accent: string): string {
  return contrast(accent, '#ffffff') >= 4.5 ? accent : '#111827';
}

// ───────────────────────── шрифты и текст ─────────────────────────

const SANS = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const SERIF = 'Georgia, "Times New Roman", "PT Serif", serif';

type Ctx = CanvasRenderingContext2D;

function setFont(ctx: Ctx, weight: number, size: number, family: string, italic = false) {
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`;
}

/** Подбирает размер, чтобы строка влезла по ширине; если и на минимуме не влезает — обрезает с «…». */
function fitText(
  ctx: Ctx,
  text: string,
  maxW: number,
  size: number,
  min: number,
  weight: number,
  family: string,
  italic = false,
): { text: string; size: number } {
  let s = size;
  setFont(ctx, weight, s, family, italic);
  while (s > min && ctx.measureText(text).width > maxW) {
    s -= 1;
    setFont(ctx, weight, s, family, italic);
  }
  let t = text;
  if (ctx.measureText(t).width > maxW) {
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    t = t.trimEnd() + '…';
  }
  return { text: t, size: s };
}

function drawFitted(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  maxW: number,
  o: { size: number; min?: number; weight: number; family: string; color: string; align?: CanvasTextAlign; italic?: boolean },
): number {
  if (!text) return 0;
  const f = fitText(ctx, text, maxW, o.size, o.min ?? Math.round(o.size * 0.6), o.weight, o.family, o.italic);
  ctx.fillStyle = o.color;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(f.text, x, y);
  return f.size;
}

/** Текст с трекингом (canvas letterSpacing есть не во всех браузерах). */
function drawSpaced(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  maxW: number,
  o: { size: number; weight: number; family: string; color: string; spacing: number; align?: 'left' | 'center' },
) {
  if (!text) return;
  let size = o.size;
  let spacing = o.spacing;
  const width = () => {
    setFont(ctx, o.weight, size, o.family);
    let w = 0;
    for (const ch of text) w += ctx.measureText(ch).width + spacing;
    return w - spacing;
  };
  let w = width();
  while (w > maxW && size > o.size * 0.6) {
    size -= 1;
    spacing = Math.max(0, spacing * 0.92);
    w = width();
  }
  if (w > maxW) {
    drawFitted(ctx, text, x, y, maxW, { size, weight: o.weight, family: o.family, color: o.color, align: o.align });
    return;
  }
  ctx.fillStyle = o.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let cx = o.align === 'center' ? x - w / 2 : x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

// ───────────────────────── иконки ─────────────────────────

type IconId = 'phone' | 'mail' | 'globe' | 'pin' | 'send' | 'whatsapp';

const ICONS: Record<IconId, string[]> = {
  phone: [
    'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
  ],
  mail: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'm22 6-10 7L2 6'],
  globe: [
    'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20z',
    'M2 12h20',
    'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  ],
  pin: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', 'M12 7a3 3 0 1 0 0 6a3 3 0 1 0 0-6z'],
  send: ['m22 2-7 20-4-9-9-4Z', 'M22 2 11 13'],
  whatsapp: ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z'],
};

const pathCache = new Map<string, Path2D>();
function path2d(d: string): Path2D {
  let p = pathCache.get(d);
  if (!p) {
    p = new Path2D(d);
    pathCache.set(d, p);
  }
  return p;
}

function drawIcon(ctx: Ctx, id: IconId, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const d of ICONS[id]) ctx.stroke(path2d(d));
  ctx.restore();
}

/** Иконка по содержимому строки контакта. */
export function iconFor(line: string, isPhone: boolean): IconId {
  const v = line.trim().toLowerCase();
  if (isPhone) return 'phone';
  if (/^\+?[\d\s()\-]{7,}$/.test(v)) return 'phone';
  if (/whatsapp|wa\.me/.test(v)) return 'whatsapp';
  if (/^@|t\.me|telegram|tg:/.test(v)) return 'send';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'mail';
  if (/^(https?:\/\/)?(www\.)?[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v)) return 'globe';
  return 'pin';
}

interface ContactLine {
  text: string;
  icon: IconId;
}

function contactLines(d: CardData, includePhone = true): ContactLine[] {
  const out: ContactLine[] = [];
  if (includePhone && d.phone.trim()) out.push({ text: d.phone.trim(), icon: iconFor(d.phone, true) });
  for (const l of [d.line2, d.line3]) if (l.trim()) out.push({ text: l.trim(), icon: iconFor(l, false) });
  return out;
}

/** Колонка контактов, выровненная по нижнему краю bottom (базовая линия последней строки). */
function drawContacts(
  ctx: Ctx,
  lines: ContactLine[],
  x: number,
  bottom: number,
  maxW: number,
  o: { size: number; lh: number; color: string; iconColor: string; family: string; align?: 'left' | 'center'; weight?: number },
) {
  const n = lines.length;
  lines.forEach((l, i) => {
    const y = bottom - (n - 1 - i) * o.lh;
    const iconSize = o.size * 0.95;
    const gap = o.size * 0.55;
    const f = fitText(ctx, l.text, maxW - iconSize - gap, o.size, o.size * 0.7, o.weight ?? 500, o.family);
    const textW = ctx.measureText(f.text).width;
    const startX = o.align === 'center' ? x - (iconSize + gap + textW) / 2 : x;
    drawIcon(ctx, l.icon, startX, y - iconSize * 0.86, iconSize, o.iconColor);
    ctx.fillStyle = o.color;
    ctx.textAlign = 'left';
    ctx.fillText(f.text, startX + iconSize + gap, y);
  });
}

// ───────────────────────── фигуры ─────────────────────────

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function fillBleed(ctx: Ctx, fill: string | CanvasGradient) {
  ctx.fillStyle = fill;
  ctx.fillRect(-BLEED, -BLEED, CARD_W + BLEED * 2, CARD_H + BLEED * 2);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'A';
  const a = parts[0][0] ?? '';
  const b = parts.length > 1 ? parts[1][0] ?? '' : '';
  return (a + b).toUpperCase();
}

function drawLogoContain(ctx: Ctx, img: CanvasImageSource, x: number, y: number, w: number, h: number) {
  const el = img as HTMLImageElement;
  const iw = el.naturalWidth || (img as HTMLCanvasElement).width || 1;
  const ih = el.naturalHeight || (img as HTMLCanvasElement).height || 1;
  const k = Math.min(w / iw, h / ih);
  const dw = iw * k;
  const dh = ih * k;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** Круглый медальон: логотип на белом или инициалы. */
function drawBadge(ctx: Ctx, cx: number, cy: number, r: number, inp: RenderInput, o: { bg: string; fg: string; family: string }) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (inp.logo) {
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.save();
    ctx.clip();
    drawLogoContain(ctx, inp.logo, cx - r * 0.72, cy - r * 0.72, r * 1.44, r * 1.44);
    ctx.restore();
    return;
  }
  ctx.fillStyle = o.bg;
  ctx.fill();
  setFont(ctx, 700, r * 0.82, o.family);
  ctx.fillStyle = o.fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials(inp.data.name), cx, cy + r * 0.04);
  ctx.textBaseline = 'alphabetic';
}

// ───────────────────────── QR ─────────────────────────

function inFinder(r: number, c: number, n: number): boolean {
  return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
}

/** Белая плашка с QR. size — сторона плашки вместе с тихой зоной (2 модуля). */
function drawQrTile(ctx: Ctx, qr: QrMatrix, x: number, y: number, size: number, ink: string, radius = 14) {
  const n = qr.size;
  const cell = size / (n + 4);
  rr(ctx, x, y, size, size, radius);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  const ox = x + cell * 2;
  const oy = y + cell * 2;
  ctx.fillStyle = ink;
  const m = cell * 0.04;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.get(r, c) || inFinder(r, c, n)) continue;
      rr(ctx, ox + c * cell + m, oy + r * cell + m, cell - 2 * m, cell - 2 * m, cell * 0.32);
      ctx.fill();
    }
  }
  for (const [fr, fc] of [[0, 0], [0, n - 7], [n - 7, 0]] as const) {
    const fx = ox + fc * cell;
    const fy = oy + fr * cell;
    rr(ctx, fx, fy, cell * 7, cell * 7, cell * 1.9);
    ctx.fillStyle = ink;
    ctx.fill();
    rr(ctx, fx + cell, fy + cell, cell * 5, cell * 5, cell * 1.3);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    rr(ctx, fx + cell * 2, fy + cell * 2, cell * 3, cell * 3, cell * 0.9);
    ctx.fillStyle = ink;
    ctx.fill();
  }
}

const QR_FRONT = 220;

function qrFront(inp: RenderInput): boolean {
  return inp.qrPlace === 'front' && !!inp.qr;
}

/** QR в правом нижнем углу лицевой стороны. */
function drawFrontQr(ctx: Ctx, inp: RenderInput, shadow = false) {
  if (!qrFront(inp)) return;
  const x = CARD_W - SAFE - QR_FRONT;
  const y = CARD_H - SAFE - QR_FRONT;
  if (shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
    rr(ctx, x, y, QR_FRONT, QR_FRONT, 14);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
  }
  drawQrTile(ctx, inp.qr!, x, y, QR_FRONT, qrInk(inp.accent));
}

// ───────────────────────── шаблоны ─────────────────────────

interface Env {
  ctx: Ctx;
  inp: RenderInput;
  d: CardData;
  a: string;
  fam: string;
  famBody: string;
  italic: boolean;
}

function textRight(inp: RenderInput): number {
  return qrFront(inp) ? CARD_W - SAFE - QR_FRONT - 30 : CARD_W - SAFE;
}

function minimal({ ctx, inp, d, a, fam, famBody, italic }: Env) {
  fillBleed(ctx, '#ffffff');
  ctx.fillStyle = a;
  ctx.fillRect(-BLEED, -BLEED, CARD_W + BLEED * 2, BLEED + 8);
  const right = textRight(inp);
  const maxW = right - SAFE;
  if (inp.logo && !qrFront(inp)) drawLogoContain(ctx, inp.logo, CARD_W - SAFE - 130, SAFE + 10, 130, 90);
  const nameRight = inp.logo && !qrFront(inp) ? CARD_W - SAFE - 150 : right;
  drawFitted(ctx, d.name, SAFE, 130, nameRight - SAFE, { size: 60, min: 34, weight: 800, family: fam, color: '#0f172a', italic });
  drawSpaced(ctx, d.title.toUpperCase(), SAFE, 172, nameRight - SAFE, { size: 22, weight: 600, family: famBody, color: a, spacing: 3 });
  ctx.fillStyle = a;
  ctx.fillRect(SAFE, 196, 70, 6);
  drawFitted(ctx, d.tagline, SAFE, 246, maxW, { size: 24, min: 17, weight: 400, family: famBody, color: '#64748b' });
  drawContacts(ctx, contactLines(d), SAFE, CARD_H - SAFE - 4, maxW, { size: 27, lh: 43, color: '#1e293b', iconColor: a, family: famBody });
  drawFrontQr(ctx, inp);
}

function dark({ ctx, inp, d, a, fam, famBody, italic }: Env) {
  const bg = '#0f1115';
  fillBleed(ctx, bg);
  const light = contrast(a, bg) < 3 ? mix(a, '#ffffff', 0.45) : a;
  const g = ctx.createRadialGradient(CARD_W - 60, 40, 10, CARD_W - 60, 40, 520);
  g.addColorStop(0, withAlpha(light, 0.38));
  g.addColorStop(1, withAlpha(light, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-BLEED, -BLEED, CARD_W + BLEED * 2, CARD_H + BLEED * 2);
  const right = textRight(inp);
  const maxW = right - SAFE;
  if (inp.logo && !qrFront(inp)) drawBadge(ctx, CARD_W - SAFE - 55, SAFE + 55, 55, inp, { bg: light, fg: bg, family: fam });
  const nameRight = inp.logo && !qrFront(inp) ? CARD_W - SAFE - 130 : right;
  drawFitted(ctx, d.name, SAFE, 128, nameRight - SAFE, { size: 60, min: 34, weight: 800, family: fam, color: '#ffffff', italic });
  drawSpaced(ctx, d.title.toUpperCase(), SAFE, 170, nameRight - SAFE, { size: 22, weight: 600, family: famBody, color: light, spacing: 3 });
  drawFitted(ctx, d.tagline, SAFE, 222, maxW, { size: 24, min: 17, weight: 400, family: famBody, color: '#94a3b8' });
  drawContacts(ctx, contactLines(d), SAFE, CARD_H - SAFE - 4, maxW, { size: 27, lh: 43, color: '#e2e8f0', iconColor: light, family: famBody });
  drawFrontQr(ctx, inp);
}

function band({ ctx, inp, d, a, fam, famBody, italic }: Env) {
  fillBleed(ctx, '#ffffff');
  const bw = 300;
  ctx.fillStyle = a;
  ctx.fillRect(-BLEED, -BLEED, bw + BLEED, CARD_H + BLEED * 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-BLEED, -BLEED, bw + BLEED, CARD_H + BLEED * 2);
  ctx.clip();
  ctx.strokeStyle = withAlpha('#ffffff', 0.07);
  ctx.lineWidth = 10;
  for (let i = -CARD_H; i < bw + 40; i += 34) {
    ctx.beginPath();
    ctx.moveTo(i, CARD_H + BLEED);
    ctx.lineTo(i + CARD_H + BLEED * 2, -BLEED);
    ctx.stroke();
  }
  ctx.restore();
  if (inp.qrPlace === 'front' && inp.qr) {
    drawQrTile(ctx, inp.qr, (bw - QR_FRONT) / 2, (CARD_H - QR_FRONT) / 2, QR_FRONT, qrInk(a));
  } else {
    drawBadge(ctx, bw / 2, CARD_H / 2, 88, inp, { bg: '#ffffff', fg: a, family: fam });
  }
  const x0 = bw + 40;
  const maxW = CARD_W - SAFE - x0;
  drawFitted(ctx, d.name, x0, 140, maxW, { size: 54, min: 30, weight: 800, family: fam, color: '#0f172a', italic });
  drawFitted(ctx, d.title, x0, 182, maxW, { size: 26, min: 18, weight: 600, family: famBody, color: a });
  drawFitted(ctx, d.tagline, x0, 228, maxW, { size: 22, min: 16, weight: 400, family: famBody, color: '#64748b' });
  drawContacts(ctx, contactLines(d), x0, CARD_H - SAFE - 4, maxW, { size: 26, lh: 42, color: '#1e293b', iconColor: a, family: famBody });
}

function gradientFill(ctx: Ctx, a: string): CanvasGradient {
  const g = ctx.createLinearGradient(-BLEED, -BLEED, CARD_W + BLEED, CARD_H + BLEED);
  g.addColorStop(0, mix(a, '#000000', 0.15));
  g.addColorStop(1, hueShift(mix(a, '#ffffff', 0.05), 38));
  return g;
}

function gradient({ ctx, inp, d, a, fam, famBody, italic }: Env) {
  fillBleed(ctx, gradientFill(ctx, a));
  ctx.fillStyle = withAlpha('#ffffff', 0.1);
  ctx.beginPath();
  ctx.arc(CARD_W - 40, -60, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = withAlpha('#ffffff', 0.07);
  ctx.beginPath();
  ctx.arc(CARD_W - 190, CARD_H + 70, 170, 0, Math.PI * 2);
  ctx.fill();
  const mid = mix(a, hueShift(a, 38), 0.5);
  const fg = onColor(mid);
  const soft = fg === '#ffffff' ? 'rgba(255,255,255,0.82)' : 'rgba(17,24,39,0.75)';
  const right = textRight(inp);
  const maxW = right - SAFE;
  drawFitted(ctx, d.name, SAFE, 140, maxW, { size: 64, min: 34, weight: 800, family: fam, color: fg, italic });
  drawFitted(ctx, d.title, SAFE, 184, maxW, { size: 27, min: 18, weight: 500, family: famBody, color: soft });
  drawFitted(ctx, d.tagline, SAFE, 232, maxW, { size: 22, min: 16, weight: 400, family: famBody, color: soft });
  drawContacts(ctx, contactLines(d), SAFE, CARD_H - SAFE - 4, maxW, { size: 27, lh: 43, color: fg, iconColor: fg, family: famBody });
  drawFrontQr(ctx, inp, true);
}

function stripes(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = color;
  for (let i = x - h; i < x + w + h; i += 30) {
    ctx.beginPath();
    ctx.moveTo(i, y + h);
    ctx.lineTo(i + 14, y + h);
    ctx.lineTo(i + 14 + h, y);
    ctx.lineTo(i + h, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function master({ ctx, inp, d, a, fam, famBody, italic }: Env) {
  fillBleed(ctx, '#ffffff');
  const top = 118;
  ctx.fillStyle = a;
  ctx.fillRect(-BLEED, -BLEED, CARD_W + BLEED * 2, top + BLEED);
  stripes(ctx, CARD_W - 230, -BLEED, 230 + BLEED, top + BLEED, withAlpha('#000000', 0.16));
  const fg = onColor(a);
  const soft = fg === '#ffffff' ? 'rgba(255,255,255,0.85)' : 'rgba(17,24,39,0.75)';
  drawFitted(ctx, d.name, SAFE, 62, CARD_W - SAFE - 260, { size: 40, min: 26, weight: 800, family: fam, color: fg, italic });
  drawFitted(ctx, d.title, SAFE, 98, CARD_W - SAFE - 260, { size: 24, min: 17, weight: 500, family: famBody, color: soft });
  const right = textRight(inp);
  const maxW = right - SAFE;
  if (d.phone.trim()) {
    drawSpaced(ctx, 'ТЕЛЕФОН', SAFE, 176, 300, { size: 17, weight: 700, family: famBody, color: '#94a3b8', spacing: 3 });
    drawFitted(ctx, d.phone.trim(), SAFE, 238, maxW, { size: 64, min: 34, weight: 800, family: famBody, color: '#0f172a' });
  }
  drawFitted(ctx, d.tagline, SAFE, 290, maxW, { size: 24, min: 16, weight: 500, family: famBody, color: '#475569' });
  drawContacts(ctx, contactLines(d, false), SAFE, CARD_H - SAFE - 4, maxW, { size: 26, lh: 42, color: '#1e293b', iconColor: a, family: famBody });
  drawFrontQr(ctx, inp);
}

function soft({ ctx, inp, d, a, fam, famBody, italic }: Env) {
  const bg = mix(a, '#ffffff', 0.9);
  fillBleed(ctx, bg);
  ctx.fillStyle = withAlpha(a, 0.1);
  ctx.beginPath();
  ctx.arc(CARD_W + 10, -10, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = withAlpha(a, 0.28);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(-30, CARD_H + 30, 190, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-30, CARD_H + 30, 150, 0, Math.PI * 2);
  ctx.stroke();
  const deep = mix(a, '#000000', 0.35);
  const left = SAFE + 20;
  const right = textRight(inp) - (qrFront(inp) ? 0 : 20);
  const cx = (left + right) / 2;
  const maxW = right - left;
  drawFitted(ctx, d.name, cx, 150, maxW, { size: 60, min: 32, weight: 600, family: fam, color: deep, align: 'center', italic: fam === SERIF || italic });
  ctx.fillStyle = a;
  ctx.fillRect(cx - 40, 178, 80, 3);
  drawSpaced(ctx, d.title.toUpperCase(), cx, 222, maxW, { size: 20, weight: 600, family: famBody, color: a, spacing: 4, align: 'center' });
  drawFitted(ctx, d.tagline, cx, 262, maxW, { size: 22, min: 16, weight: 400, family: famBody, color: '#64748b', align: 'center' });
  drawContacts(ctx, contactLines(d), cx, CARD_H - SAFE - 4, maxW, { size: 25, lh: 40, color: '#334155', iconColor: a, family: famBody, align: 'center' });
  drawFrontQr(ctx, inp);
}

function mono({ ctx, inp, d, a, fam, famBody, italic }: Env) {
  fillBleed(ctx, '#faf8f5');
  const col = 320;
  if (inp.qrPlace === 'front' && inp.qr) {
    drawQrTile(ctx, inp.qr, (col - QR_FRONT) / 2, (CARD_H - QR_FRONT) / 2, QR_FRONT, qrInk(a));
  } else if (inp.logo) {
    drawLogoContain(ctx, inp.logo, 50, 140, col - 100, 220);
  } else {
    ctx.strokeStyle = a;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(col / 2, CARD_H / 2, 112, 0, Math.PI * 2);
    ctx.stroke();
    setFont(ctx, 300, 120, fam);
    ctx.fillStyle = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(d.name), col / 2, CARD_H / 2 + 6);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.fillStyle = '#d6d3d1';
  ctx.fillRect(col, 70, 2, CARD_H - 140);
  const x0 = col + 40;
  const maxW = CARD_W - SAFE - x0;
  drawFitted(ctx, d.name, x0, 138, maxW, { size: 50, min: 28, weight: 700, family: fam, color: '#1c1917', italic });
  drawFitted(ctx, d.title, x0, 178, maxW, { size: 25, min: 17, weight: 600, family: famBody, color: a });
  drawFitted(ctx, d.tagline, x0, 222, maxW, { size: 22, min: 16, weight: 400, family: famBody, color: '#78716c' });
  drawContacts(ctx, contactLines(d), x0, CARD_H - SAFE - 4, maxW, { size: 25, lh: 41, color: '#292524', iconColor: a, family: famBody });
}

function bold({ ctx, inp, d, a, fam, famBody, italic }: Env) {
  fillBleed(ctx, a);
  const fg = onColor(a);
  const soft = fg === '#ffffff' ? 'rgba(255,255,255,0.8)' : 'rgba(17,24,39,0.72)';
  const right = textRight(inp);
  const maxW = right - SAFE;
  const words = d.name.trim().split(/\s+/).filter(Boolean);
  let y = 150;
  if (words.length >= 2) {
    const first = words[0];
    const rest = words.slice(1).join(' ');
    const s1 = fitText(ctx, first, maxW, 76, 40, 800, fam, italic);
    const s2 = fitText(ctx, rest, maxW, 76, 40, 800, fam, italic);
    const s = Math.min(s1.size, s2.size);
    drawFitted(ctx, first, SAFE, 104, maxW, { size: s, min: s, weight: 800, family: fam, color: fg, italic });
    drawFitted(ctx, rest, SAFE, 104 + s * 1.02, maxW, { size: s, min: s, weight: 800, family: fam, color: fg, italic });
    y = 104 + s * 1.02 + 44;
  } else {
    drawFitted(ctx, d.name, SAFE, 130, maxW, { size: 76, min: 40, weight: 800, family: fam, color: fg, italic });
    y = 176;
  }
  drawFitted(ctx, d.title, SAFE, y, maxW, { size: 26, min: 17, weight: 600, family: famBody, color: soft });
  drawContacts(ctx, contactLines(d), SAFE, CARD_H - SAFE - 4, maxW, { size: 26, lh: 42, color: fg, iconColor: fg, family: famBody });
  drawFrontQr(ctx, inp);
}

const FRONT: Record<TemplateId, (e: Env) => void> = { minimal, dark, band, gradient, master, soft, mono, bold };

/** Фон оборота: цвет и цвет текста на нём. */
function backBackground(ctx: Ctx, t: TemplateId, a: string): { fg: string; soft: string } {
  switch (t) {
    case 'dark':
      fillBleed(ctx, '#0f1115');
      return { fg: '#ffffff', soft: '#94a3b8' };
    case 'gradient':
      fillBleed(ctx, gradientFill(ctx, a));
      break;
    case 'soft': {
      const bg = mix(a, '#ffffff', 0.9);
      fillBleed(ctx, bg);
      return { fg: mix(a, '#000000', 0.35), soft: '#64748b' };
    }
    case 'mono':
      fillBleed(ctx, '#1c1917');
      return { fg: '#faf8f5', soft: '#a8a29e' };
    case 'master':
      fillBleed(ctx, a);
      stripes(ctx, -BLEED, CARD_H - 70, CARD_W + BLEED * 2, 70 + BLEED, withAlpha('#000000', 0.16));
      break;
    default:
      fillBleed(ctx, a);
  }
  const mid = t === 'gradient' ? mix(a, hueShift(a, 38), 0.5) : a;
  const fg = onColor(mid);
  return { fg, soft: fg === '#ffffff' ? 'rgba(255,255,255,0.8)' : 'rgba(17,24,39,0.7)' };
}

function drawBack(e: Env) {
  const { ctx, inp, d, a, fam, famBody, italic } = e;
  const { fg, soft } = backBackground(ctx, inp.template, a);
  const cx = CARD_W / 2;
  if (inp.qrPlace === 'back' && inp.qr) {
    const size = 290;
    const y = 44;
    drawQrTile(ctx, inp.qr, cx - size / 2, y, size, qrInk(a), 18);
    drawFitted(ctx, inp.qrCaption, cx, y + size + 50, CARD_W - 2 * SAFE, { size: 24, min: 16, weight: 600, family: famBody, color: fg, align: 'center' });
    drawFitted(ctx, d.name, cx, y + size + 92, CARD_W - 2 * SAFE, { size: 22, min: 15, weight: 500, family: fam, color: soft, align: 'center', italic });
    return;
  }
  drawBadge(ctx, cx, 190, 92, inp, {
    bg: fg === '#ffffff' ? 'rgba(255,255,255,0.16)' : 'rgba(17,24,39,0.08)',
    fg,
    family: fam,
  });
  drawFitted(ctx, d.name, cx, 350, CARD_W - 2 * SAFE, { size: 40, min: 24, weight: 700, family: fam, color: fg, align: 'center', italic });
  drawFitted(ctx, d.tagline || d.title, cx, 400, CARD_W - 2 * SAFE, { size: 23, min: 16, weight: 400, family: famBody, color: soft, align: 'center' });
}

export type Side = 'front' | 'back';

/**
 * Рисует сторону визитки. pxPerU — пикселей на 0,1 мм (300 dpi ≈ 1.181).
 * withBleed: true — холст с вылетами 2 мм (для типографии), false — только обрезной формат.
 */
export function renderSide(canvas: HTMLCanvasElement, inp: RenderInput, side: Side, pxPerU: number, withBleed: boolean) {
  const off = withBleed ? BLEED : 0;
  canvas.width = Math.round((CARD_W + off * 2) * pxPerU);
  canvas.height = Math.round((CARD_H + off * 2) * pxPerU);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(pxPerU, 0, 0, pxPerU, off * pxPerU, off * pxPerU);
  ctx.clearRect(-off, -off, CARD_W + off * 2, CARD_H + off * 2);
  const fontId = inp.font;
  const fam = fontId === 'serif' ? SERIF : SANS;
  const env: Env = {
    ctx,
    inp,
    d: inp.data,
    a: inp.accent,
    fam,
    famBody: SANS,
    italic: false,
  };
  if (side === 'front') FRONT[inp.template](env);
  else drawBack(env);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** px на u для заданного dpi. */
export function pxPerUAt(dpi: number): number {
  return dpi / 25.4 / U_PER_MM;
}
