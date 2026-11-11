/**
 * Отрисовка таблички / стикера / панели домика на canvas.
 *
 * Все размеры — в мм, перевод в пиксели через `k` (px на мм) в момент рисования:
 * шрифт задаётся сразу нужным размером в px, без ctx.scale — мелкий текст
 * в превью и крупный при 300 dpi рисуются одинаково ровно.
 *
 * Компоновка — стопка блоков. Если всё не влезает, необязательные блоки убираются
 * по приоритету, пока QR не станет достаточно крупным (так 5-сантиметровый стикер
 * сам превращается в «заголовок + QR»).
 */

import type { PrintDesignId, PrintScenario, PrintSettings, Rect, SheetLayout } from "./layout";

export interface SignContent {
  settings: PrintSettings;
  scenario: PrintScenario;
  /** Название проекта. */
  name: string;
  logo: CanvasImageSource | null;
  logoAspect: number;
  /** Готовый квадратный QR (со стилем). */
  qr: CanvasImageSource;
  /** Сторона картинки QR в px — чтобы при уменьшении сглаживать, а при увеличении нет. */
  qrPx: number;
  /** Короткая ссылка под кодом (без https://). */
  link: string;
  wifi: { ssid: string; password: string | null } | null;
  /** Подпись «Сделано в QrStars». */
  branding: boolean;
  fontFamily: string;
}

// ───────────────────────── цвета ─────────────────────────

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (Number.isNaN(n)) return [79, 70, 229];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: Rgb): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** t — доля второго цвета. */
export function mixColor(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Затемняет цвет, пока контраст с фоном не станет ≥ min. */
function readableOn(color: string, bg: string, min = 4.5): string {
  let c = color;
  for (let i = 0; i < 12 && contrastRatio(c, bg) < min; i++) c = mixColor(c, "#000000", 0.15);
  return c;
}

/** Заголовок цвета акцента; светлый акцент (жёлтый, мятный) не затемняем в «грязь» — берём почти чёрный. */
function titleOnLight(accent: string, bg: string): string {
  return contrastRatio(accent, bg) >= 3 ? readableOn(accent, bg) : "#111827";
}

interface Palette {
  bg: string;
  bg2: string | null;
  title: string;
  text: string;
  muted: string;
  star: string;
  cardBorder: string | null;
  cardShadow: boolean;
  /** Плашка под логотипом (на тёмном/цветном фоне). */
  logoTile: boolean;
  frame: string | null;
  frameText: string;
  infoBg: string;
}

function palette(design: PrintDesignId, accent: string): Palette {
  const dark = "#0F172A";
  switch (design) {
    case "bold": {
      const onAccentLight = contrastRatio("#FFFFFF", accent) >= 3;
      const fg = onAccentLight ? "#FFFFFF" : "#111827";
      return {
        bg: accent,
        bg2: mixColor(accent, "#000000", 0.28),
        title: fg,
        text: onAccentLight ? mixColor(fg, accent, 0.08) : "#1F2937",
        muted: onAccentLight ? mixColor("#FFFFFF", accent, 0.35) : "#374151",
        // На жёлтом/светлом фоне жёлтые звёзды не видно.
        star: contrastRatio("#FCD34D", accent) >= 1.8 ? "#FCD34D" : fg,
        cardBorder: null,
        cardShadow: true,
        logoTile: true,
        frame: null,
        frameText: fg,
        infoBg: onAccentLight ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.45)",
      };
    }
    case "soft": {
      const bg = mixColor(accent, "#FFFFFF", 0.9);
      return {
        bg,
        bg2: mixColor(accent, "#FFFFFF", 0.78),
        title: titleOnLight(accent, bg),
        text: "#1F2937",
        muted: "#6B7280",
        star: "#F59E0B",
        cardBorder: null,
        cardShadow: true,
        logoTile: false,
        frame: null,
        frameText: "#FFFFFF",
        infoBg: "rgba(255,255,255,0.75)",
      };
    }
    case "dark":
      return {
        bg: "#0B1020",
        bg2: mixColor("#0B1020", accent, 0.35),
        title: "#FFFFFF",
        text: "#E2E8F0",
        muted: "#94A3B8",
        star: "#FBBF24",
        cardBorder: null,
        cardShadow: false,
        logoTile: true,
        frame: null,
        frameText: "#FFFFFF",
        infoBg: "rgba(255,255,255,0.08)",
      };
    case "frame": {
      const frame = accent;
      return {
        bg: "#FFFFFF",
        bg2: null,
        title: contrastRatio("#FFFFFF", frame) >= 3 ? "#FFFFFF" : "#111827",
        text: dark,
        muted: "#64748B",
        star: "#F59E0B",
        cardBorder: null,
        cardShadow: false,
        logoTile: false,
        frame,
        frameText: contrastRatio("#FFFFFF", frame) >= 3 ? "#FFFFFF" : "#111827",
        infoBg: mixColor(accent, "#FFFFFF", 0.9),
      };
    }
    case "classic":
    default:
      return {
        bg: "#FFFFFF",
        bg2: null,
        title: titleOnLight(accent, "#FFFFFF"),
        text: dark,
        muted: "#64748B",
        star: "#F59E0B",
        cardBorder: mixColor(accent, "#FFFFFF", 0.55),
        cardShadow: false,
        logoTile: false,
        frame: null,
        frameText: "#FFFFFF",
        infoBg: mixColor(accent, "#FFFFFF", 0.92),
      };
  }
}

// ───────────────────────── текст ─────────────────────────

interface FittedText {
  lines: string[];
  size: number;
  weight: number;
  lineH: number;
}

const MEASURE_SCALE = 20;

function setFont(ctx: CanvasRenderingContext2D, weight: number, sizePx: number, family: string) {
  ctx.font = `${weight} ${sizePx}px ${family}`;
}

/** Ширина строки в мм (меряем крупным шрифтом — точнее, чем 2-пиксельным в превью). */
function measureMm(ctx: CanvasRenderingContext2D, text: string, sizeMm: number, weight: number, family: string) {
  setFont(ctx, weight, sizeMm * MEASURE_SCALE, family);
  return ctx.measureText(text).width / MEASURE_SCALE;
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  sizeMm: number,
  weight: number,
  family: string,
  maxW: number,
): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    // Тире не начинает строку: приклеиваем его к предыдущему слову.
    const words: string[] = [];
    for (const w of para.split(/\s+/).filter(Boolean)) {
      if (/^[—–-]$/.test(w) && words.length) words[words.length - 1] += ` ${w}`;
      else words.push(w);
    }
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (line && measureMm(ctx, test, sizeMm, weight, family) > maxW) {
        out.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: {
    size: number;
    min: number;
    weight: number;
    maxLines: number;
    maxW: number;
    family: string;
    lineH?: number;
    /** До какой доли кегля ужимать, прежде чем переносить на следующую строку (заголовок — 0.8). */
    shrinkBeforeWrap?: number;
  },
): FittedText | null {
  const clean = text.trim();
  if (!clean) return null;
  const lineH = opts.lineH ?? 1.18;
  const { weight, family, maxW, maxLines } = opts;
  const widest = (lines: string[], size: number) =>
    Math.max(0, ...lines.map((l) => measureMm(ctx, l, size, weight, family)));
  const floorBeforeWrap = Math.max(opts.min, opts.size * (opts.shrinkBeforeWrap ?? 1));

  for (let lineCount = 1; lineCount <= maxLines; lineCount++) {
    const floor = lineCount < maxLines ? floorBeforeWrap : opts.min;
    for (let size = opts.size; size >= floor - 1e-9; size *= 0.95) {
      const lines = wrap(ctx, clean, size, weight, family, maxW);
      if (lines.length <= lineCount && widest(lines, size) <= maxW) {
        return { lines: balance(ctx, clean, size, weight, family, maxW, lines), size, weight, lineH };
      }
    }
  }
  // Не влезло и на минимальном кегле: обрезаем лишние строки и длинные слова.
  const size = opts.min;
  const lines = wrap(ctx, clean, size, weight, family, maxW);
  const cut = lines.slice(0, maxLines).map((l) => ellipsize(ctx, l, size, weight, family, maxW));
  if (lines.length > maxLines) cut[cut.length - 1] = ellipsize(ctx, cut[cut.length - 1] + "…", size, weight, family, maxW);
  return { lines: cut, size, weight, lineH };
}

/** Выравнивает длину строк: без одинокого слова на последней строке. */
function balance(
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  weight: number,
  family: string,
  maxW: number,
  lines: string[],
): string[] {
  if (lines.length < 2) return lines;
  let lo = maxW * 0.4;
  let hi = maxW;
  let best = lines;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const attempt = wrap(ctx, text, size, weight, family, mid);
    if (attempt.length <= lines.length) {
      best = attempt;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return best;
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, size: number, weight: number, family: string, maxW: number) {
  if (measureMm(ctx, text, size, weight, family) <= maxW) return text;
  let t = text.replace(/…$/, "");
  while (t.length > 1 && measureMm(ctx, t + "…", size, weight, family) > maxW) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}

function textHeight(t: FittedText): number {
  return t.lines.length * t.size * t.lineH;
}

// ───────────────────────── примитивы ─────────────────────────

interface Pen {
  ctx: CanvasRenderingContext2D;
  /** px на мм */
  k: number;
  family: string;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawText(
  pen: Pen,
  t: FittedText,
  x: number,
  y: number,
  w: number,
  align: "center" | "left",
  color: string,
) {
  const { ctx, k } = pen;
  setFont(ctx, t.weight, t.size * k, pen.family);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  const lh = t.size * t.lineH;
  t.lines.forEach((line, i) => {
    const bx = align === "center" ? x + w / 2 : x;
    // Базовая линия ≈ 0.8 кегля от верха строки + половина интерлиньяжа.
    const by = y + i * lh + (lh - t.size) / 2 + t.size * 0.8;
    ctx.fillText(line, bx * k, by * k);
  });
}

function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawStars(pen: Pen, x: number, y: number, w: number, h: number, align: "center" | "left", color: string) {
  const { ctx, k } = pen;
  const gap = h * 0.22;
  const total = h * 5 + gap * 4;
  let sx = align === "center" ? x + (w - total) / 2 : x;
  ctx.fillStyle = color;
  ctx.lineJoin = "round";
  for (let i = 0; i < 5; i++) {
    starPath(ctx, (sx + h / 2) * k, (y + h * 0.53) * k, (h / 2) * k * 1.04);
    ctx.fill();
    sx += h + gap;
  }
}

function drawPhoneIcon(pen: Pen, x: number, y: number, h: number, color: string) {
  const { ctx, k } = pen;
  const w = h * 0.6;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, h * 0.11 * k);
  roundRectPath(ctx, x * k, y * k, w * k, h * k, h * 0.14 * k);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo((x + w * 0.35) * k, (y + h * 0.84) * k);
  ctx.lineTo((x + w * 0.65) * k, (y + h * 0.84) * k);
  ctx.stroke();
}

// ───────────────────────── блоки ─────────────────────────

interface Block {
  key: string;
  h: number;
  /** Отступ перед блоком (если сверху что-то есть). */
  gap: number;
  /** Чем меньше, тем раньше выкидываем при нехватке места; Infinity — обязателен. */
  priority: number;
  draw: (x: number, y: number, w: number) => void;
}

function stackHeight(blocks: Block[]): number {
  return blocks.reduce((sum, b, i) => sum + b.h + (i > 0 ? b.gap : 0), 0);
}

// ───────────────────────── главная функция ─────────────────────────

/**
 * Рисует одну табличку в прямоугольнике `rect` (мм).
 * `bleed` — на сколько мм фон выходит за обрез (для типографии).
 */
export function renderSign(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  k: number,
  content: SignContent,
  opts: { bleed?: number; rotate180?: boolean; rounded?: boolean } = {},
): { qrMm: number } {
  const { settings: s } = content;
  const pen: Pen = { ctx, k, family: content.fontFamily };
  const pal = palette(s.design, s.accent);
  const bleed = opts.bleed ?? 0;

  ctx.save();
  if (opts.rotate180) {
    ctx.translate((rect.x + rect.w / 2) * k, (rect.y + rect.h / 2) * k);
    ctx.rotate(Math.PI);
    ctx.translate(-(rect.x + rect.w / 2) * k, -(rect.y + rect.h / 2) * k);
  }

  // Фон + клип по вылетам.
  const bx = rect.x - bleed;
  const by = rect.y - bleed;
  const bw = rect.w + 2 * bleed;
  const bh = rect.h + 2 * bleed;
  const S = Math.min(rect.w, rect.h);
  const u = S / 105; // 1 единица = 1 мм на A6
  const corner = opts.rounded ? Math.min(4, S * 0.06) : 0;
  if (corner) roundRectPath(ctx, bx * k, by * k, bw * k, bh * k, corner * k);
  else {
    ctx.beginPath();
    ctx.rect(bx * k, by * k, bw * k, bh * k);
  }
  ctx.clip();
  if (pal.bg2) {
    const g = ctx.createLinearGradient(bx * k, by * k, (bx + bw) * k, (by + bh) * k);
    g.addColorStop(0, pal.bg);
    g.addColorStop(1, pal.bg2);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = pal.bg;
  }
  ctx.fillRect(bx * k, by * k, bw * k, bh * k);

  // Декор: мягкие круги на «Нежном» и «Тёмном».
  if (s.design === "soft" || s.design === "dark") {
    ctx.fillStyle = s.design === "soft" ? "rgba(255,255,255,0.55)" : mixColor(s.accent, "#0B1020", 0.55);
    ctx.globalAlpha = s.design === "soft" ? 1 : 0.55;
    ctx.beginPath();
    ctx.arc((rect.x + rect.w * 0.92) * k, (rect.y + rect.h * 0.06) * k, S * 0.38 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc((rect.x + rect.w * 0.04) * k, (rect.y + rect.h * 0.97) * k, S * 0.26 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Рамка: толстая цветная обводка + плашка с заголовком сверху.
  let inner: Rect = { ...rect };
  let titleInFrame = false;
  let frameOuter: Rect | null = null;
  let frameRadius = 0;
  if (pal.frame) {
    const fw = Math.max(2.2, 4.5 * u);
    const inset = Math.max(1.5, 4 * u);
    const fr = { x: rect.x + inset, y: rect.y + inset, w: rect.w - 2 * inset, h: rect.h - 2 * inset };
    ctx.strokeStyle = pal.frame;
    ctx.lineWidth = fw * k;
    roundRectPath(ctx, (fr.x + fw / 2) * k, (fr.y + fw / 2) * k, (fr.w - fw) * k, (fr.h - fw) * k, 5 * u * k);
    ctx.stroke();
    inner = { x: fr.x + fw, y: fr.y + fw, w: fr.w - 2 * fw, h: fr.h - 2 * fw };
    titleInFrame = true;
    frameOuter = fr;
    frameRadius = 5 * u;
  }

  const landscape = rect.w / rect.h > 1.2;
  const pad = (pal.frame ? 4 : 7.5) * u;
  const brandH = content.branding ? Math.max(1.6, 2.4 * u) : 0;
  const area: Rect = {
    x: inner.x + pad,
    y: inner.y + pad * (titleInFrame ? 0 : 1),
    w: inner.w - 2 * pad,
    h: inner.h - pad * (titleInFrame ? 1 : 2) - (brandH ? brandH * 1.6 : 0),
  };

  const cardPad = Math.max(1.2, 2.8 * u);
  const minQr = Math.min(20, S * 0.45);

  // ── Плашка заголовка в «Рамке»: занимает верх внутренней области.
  let frameTitle: FittedText | null = null;
  if (titleInFrame) {
    frameTitle = fitText(ctx, s.title, {
      size: 10 * u,
      min: 3 * u,
      weight: 800,
      shrinkBeforeWrap: 0.78,
      maxLines: 2,
      maxW: inner.w - 2 * pad,
      family: content.fontFamily,
    });
    const bandH = frameTitle ? textHeight(frameTitle) + 7 * u : 6 * u;
    if (frameTitle && frameOuter) {
      // Плашка сливается с рамкой: заливаем от внешнего края, обрезая по скруглению рамки.
      ctx.save();
      roundRectPath(ctx, frameOuter.x * k, frameOuter.y * k, frameOuter.w * k, frameOuter.h * k, frameRadius * k);
      ctx.clip();
      ctx.fillStyle = pal.frame!;
      ctx.fillRect(frameOuter.x * k, frameOuter.y * k, frameOuter.w * k, (inner.y - frameOuter.y + bandH) * k);
      ctx.restore();
      drawText(pen, frameTitle, inner.x + pad, inner.y + 3.5 * u, inner.w - 2 * pad, "center", pal.frameText);
    }
    area.y = inner.y + bandH + pad * 0.7;
    area.h = inner.y + inner.h - pad - (brandH ? brandH * 1.6 : 0) - area.y;
  }

  // ── Колонка текста и место под QR.
  const textW = landscape ? area.w * 0.52 : area.w;
  const align: "center" | "left" = landscape ? "left" : "center";
  const blocks: Block[] = [];
  const fam = content.fontFamily;

  // Шапка: логотип + название.
  const hasLogo = s.showLogo && !!content.logo;
  const nameText = s.showName ? content.name.trim() : "";
  if (hasLogo || nameText) {
    const logoH = (nameText ? 10 : 14) * u;
    const logoW = hasLogo ? Math.min(logoH * Math.max(0.5, Math.min(3, content.logoAspect)), textW * 0.6) : 0;
    const nameMaxW = textW - (hasLogo ? logoW + 3 * u : 0);
    const name = nameText
      ? fitText(ctx, nameText, { size: 4.6 * u, min: 2.6 * u, weight: 700, maxLines: 1, maxW: nameMaxW, family: fam })
      : null;
    const h = hasLogo ? logoH : name ? textHeight(name) : 0;
    blocks.push({
      key: "header",
      h,
      gap: 0,
      priority: 3,
      draw: (x, y, w) => {
        const nameW = name ? Math.max(...name.lines.map((l) => measureMm(ctx, l, name.size, name.weight, fam))) : 0;
        const total = (hasLogo ? logoW : 0) + (hasLogo && name ? 3 * u : 0) + nameW;
        let cx = align === "center" ? x + (w - total) / 2 : x;
        if (hasLogo && content.logo) {
          const lw = logoW;
          const lh = logoH;
          if (pal.logoTile) {
            const p = lh * 0.12;
            ctx.fillStyle = "#FFFFFF";
            roundRectPath(ctx, (cx - p) * k, (y - p) * k, (lw + 2 * p) * k, (lh + 2 * p) * k, lh * 0.22 * k);
            ctx.fill();
          }
          // contain
          const a = content.logoAspect;
          let dw = lw;
          let dh = lw / a;
          if (dh > lh) {
            dh = lh;
            dw = lh * a;
          }
          ctx.drawImage(content.logo, (cx + (lw - dw) / 2) * k, (y + (lh - dh) / 2) * k, dw * k, dh * k);
          cx += lw + 3 * u;
        }
        if (name) {
          drawText(pen, name, cx, y + (h - textHeight(name)) / 2, nameW, "left", pal.text);
        }
      },
    });
  }

  if (!titleInFrame) {
    const title = fitText(ctx, s.title, {
      size: (landscape ? 12 : 11.5) * u,
      min: 3.2 * u,
      weight: 800,
      maxLines: 2,
      maxW: textW,
      family: fam,
      lineH: 1.08,
      shrinkBeforeWrap: 0.78,
    });
    if (title) {
      blocks.push({
        key: "title",
        h: textHeight(title),
        gap: 4 * u,
        priority: Infinity,
        draw: (x, y, w) => drawText(pen, title, x, y, w, align, pal.title),
      });
    }
  }

  if (s.showStars) {
    const h = 6.5 * u;
    blocks.push({
      key: "stars",
      h,
      gap: 2.8 * u,
      priority: 4,
      draw: (x, y, w) => drawStars(pen, x, y, w, h, align, pal.star),
    });
  }

  const subtitle = fitText(ctx, s.subtitle, {
    size: 4.4 * u,
    min: 2.4,
    weight: 500,
    maxLines: 3,
    maxW: textW,
    family: fam,
    lineH: 1.25,
  });
  if (subtitle) {
    blocks.push({
      key: "subtitle",
      h: textHeight(subtitle),
      gap: 3 * u,
      priority: 2,
      draw: (x, y, w) => drawText(pen, subtitle, x, y, w, align, pal.text),
    });
  }

  if (s.showWifi && content.wifi?.ssid) {
    const lines = [`Сеть: ${content.wifi.ssid}`, content.wifi.password ? `Пароль: ${content.wifi.password}` : "Без пароля"];
    const fitted = lines.map((l) =>
      fitText(ctx, l, { size: 4.2 * u, min: 2.2, weight: 600, maxLines: 1, maxW: textW - 6 * u, family: fam }),
    );
    const innerH = fitted.reduce((sum, f) => sum + (f ? textHeight(f) : 0), 0);
    const h = innerH + 4 * u;
    blocks.push({
      key: "wifi",
      h,
      gap: 3.5 * u,
      priority: 5,
      draw: (x, y, w) => {
        const bw = Math.min(w, Math.max(...fitted.map((f) => (f ? Math.max(...f.lines.map((l) => measureMm(ctx, l, f.size, f.weight, fam))) : 0))) + 6 * u);
        const bx = align === "center" ? x + (w - bw) / 2 : x;
        ctx.fillStyle = pal.infoBg;
        roundRectPath(ctx, bx * k, y * k, bw * k, h * k, 2.5 * u * k);
        ctx.fill();
        let ty = y + 2 * u;
        for (const f of fitted) {
          if (!f) continue;
          drawText(pen, f, bx + 3 * u, ty, bw - 6 * u, align === "center" ? "center" : "left", pal.text);
          ty += textHeight(f);
        }
      },
    });
  }

  if (s.showHint) {
    const hint = fitText(ctx, "Наведите камеру телефона на код", {
      size: 3.5 * u,
      min: 2.2,
      weight: 500,
      maxLines: 1,
      maxW: textW - 5 * u,
      family: fam,
    });
    if (hint) {
      const h = textHeight(hint);
      blocks.push({
        key: "hint",
        h,
        gap: 3 * u,
        priority: 1,
        draw: (x, y, w) => {
          const tw = measureMm(ctx, hint.lines[0], hint.size, hint.weight, fam);
          const iconH = hint.size * 1.05;
          const total = iconH * 0.6 + hint.size * 0.6 + tw;
          const sx = align === "center" ? x + (w - total) / 2 : x;
          drawPhoneIcon(pen, sx, y + (h - iconH) / 2, iconH, pal.muted);
          drawText(pen, hint, sx + iconH * 0.6 + hint.size * 0.6, y, tw + 1, "left", pal.muted);
        },
      });
    }
  }

  const footer = fitText(ctx, s.footer, {
    size: 4.2 * u,
    min: 2.2,
    weight: 700,
    maxLines: 2,
    maxW: textW,
    family: fam,
  });
  if (footer) {
    blocks.push({
      key: "footer",
      h: textHeight(footer),
      gap: 3.5 * u,
      priority: 0,
      draw: (x, y, w) => drawText(pen, footer, x, y, w, align, pal.title),
    });
  }

  const linkText =
    s.showLink && content.link
      ? fitText(ctx, content.link, { size: 3 * u, min: 1.8, weight: 600, maxLines: 1, maxW: area.w, family: fam })
      : null;

  // ── Раскладка.
  const cardOf = (qr: number) => qr + 2 * cardPad;
  const linkH = linkText ? textHeight(linkText) + 1.5 * u : 0;
  let kept = [...blocks];

  const dropLowest = () => {
    const optional = kept.filter((b) => Number.isFinite(b.priority));
    if (!optional.length) return false;
    const victim = optional.reduce((a, b) => (b.priority < a.priority ? b : a));
    kept = kept.filter((b) => b !== victim);
    return true;
  };

  let qrSize: number;
  if (landscape) {
    const maxQr = Math.min(area.h - linkH, area.w * 0.44) - 2 * cardPad;
    qrSize = maxQr;
    while (stackHeight(kept) > area.h && dropLowest()) {
      /* ужимаем текст */
    }
  } else {
    const gapQr = 4 * u;
    const fitQr = () => area.h - stackHeight(kept) - (kept.length ? gapQr : 0) - linkH - 2 * cardPad;
    const wantQr = Math.min(area.w - 2 * cardPad, area.w * 0.78);
    const needQr = Math.max(minQr, Math.min(wantQr, area.w * 0.62));
    while (fitQr() < needQr && dropLowest()) {
      /* убираем необязательное, пока QR не станет достаточно крупным */
    }
    qrSize = Math.max(8, Math.min(wantQr, fitQr()));
  }

  const card = cardOf(qrSize);
  const drawQrCard = (x: number, y: number) => {
    if (pal.cardShadow) {
      ctx.save();
      ctx.shadowColor = "rgba(15,23,42,0.18)";
      ctx.shadowBlur = 3 * u * k;
      ctx.shadowOffsetY = 1 * u * k;
      ctx.fillStyle = "#FFFFFF";
      roundRectPath(ctx, x * k, y * k, card * k, card * k, 3.5 * u * k);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = "#FFFFFF";
    roundRectPath(ctx, x * k, y * k, card * k, card * k, 3.5 * u * k);
    ctx.fill();
    if (pal.cardBorder) {
      ctx.strokeStyle = pal.cardBorder;
      ctx.lineWidth = Math.max(0.3, 0.6 * u) * k;
      ctx.stroke();
    }
    // Увеличиваем — без сглаживания (чёткие модули), уменьшаем — со сглаживанием (без муара).
    ctx.imageSmoothingEnabled = qrSize * k < content.qrPx;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(content.qr, (x + cardPad) * k, (y + cardPad) * k, qrSize * k, qrSize * k);
    ctx.imageSmoothingEnabled = true;
  };
  const drawLink = (x: number, y: number, w: number) => {
    if (linkText) drawText(pen, linkText, x, y + 1.5 * u, w, "center", pal.muted);
  };

  if (landscape) {
    const qrX = area.x + area.w - card;
    const qrY = area.y + (area.h - card - linkH) / 2;
    drawQrCard(qrX, qrY);
    drawLink(qrX - 10 * u, qrY + card, card + 20 * u);
    const colW = qrX - area.x - 6 * u;
    const sh = stackHeight(kept);
    let y = area.y + Math.max(0, (area.h - sh) / 2);
    kept.forEach((b, i) => {
      if (i > 0) y += b.gap;
      b.draw(area.x, y, colW);
      y += b.h;
    });
  } else {
    // QR идёт после заголовка/звёзд/подзаголовка, остальное — под ним.
    const before = kept.filter((b) => ["header", "title", "stars", "subtitle"].includes(b.key));
    const after = kept.filter((b) => !before.includes(b));
    const gapQr = 4 * u;
    const total =
      stackHeight(before) + (before.length ? gapQr : 0) + card + linkH + (after.length ? stackHeight(after) + after[0].gap : 0);
    let y = area.y + Math.max(0, (area.h - total) / 2);
    before.forEach((b, i) => {
      if (i > 0) y += b.gap;
      b.draw(area.x, y, area.w);
      y += b.h;
    });
    if (before.length) y += gapQr;
    drawQrCard(area.x + (area.w - card) / 2, y);
    y += card;
    drawLink(area.x, y, area.w);
    y += linkH;
    after.forEach((b) => {
      y += b.gap;
      b.draw(area.x, y, area.w);
      y += b.h;
    });
  }

  if (content.branding) {
    const t = fitText(ctx, "Сделано в QrStars · qrstars.ru", {
      size: brandH,
      min: 1.4,
      weight: 500,
      maxLines: 1,
      maxW: inner.w - 2 * pad,
      family: fam,
    });
    if (t) {
      ctx.globalAlpha = 0.75;
      drawText(pen, t, inner.x, inner.y + inner.h - pad * 0.55 - textHeight(t), inner.w, "center", pal.muted);
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();
  return { qrMm: qrSize };
}

/** Рисует лист целиком: фон, таблички, линии реза и сгиба. */
export function renderSheet(
  canvas: HTMLCanvasElement,
  layout: SheetLayout,
  content: SignContent,
  k: number,
): { qrMm: number } {
  canvas.width = Math.round(layout.pageWMm * k);
  canvas.height = Math.round(layout.pageHMm * k);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const stickers = layout.cutOutlines.length > 0;
  let qrMm = 0;
  for (const item of layout.items) {
    qrMm = renderSign(ctx, item, k, content, {
      bleed: layout.bleedMm,
      rotate180: item.rotate180,
      rounded: stickers,
    }).qrMm;
  }

  ctx.save();
  ctx.lineWidth = Math.max(1, 0.25 * k);
  ctx.strokeStyle = "#9CA3AF";
  ctx.setLineDash([2 * k, 1.5 * k]);
  for (const [x1, y1, x2, y2] of layout.cutLines) {
    ctx.beginPath();
    ctx.moveTo(x1 * k, y1 * k);
    ctx.lineTo(x2 * k, y2 * k);
    ctx.stroke();
  }
  ctx.strokeStyle = "#D1D5DB";
  ctx.setLineDash([]);
  for (const r of layout.cutOutlines) {
    roundRectPath(ctx, r.x * k, r.y * k, r.w * k, r.h * k, Math.min(4, Math.min(r.w, r.h) * 0.06) * k);
    ctx.stroke();
  }
  ctx.strokeStyle = "#6B7280";
  ctx.setLineDash([0.6 * k, 1.2 * k]);
  for (const [x1, y1, x2, y2] of layout.foldLines) {
    ctx.beginPath();
    ctx.moveTo(x1 * k, y1 * k);
    ctx.lineTo(x2 * k, y2 * k);
    ctx.stroke();
  }
  ctx.restore();
  return { qrMm };
}
