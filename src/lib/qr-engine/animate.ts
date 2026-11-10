/**
 * Анимированные QR (GIF в кабинете для PRO, живое превью на лендинге).
 *
 * Анимация накладывается поверх уже отрисованного кода: из готовой картинки строится
 * маска «краски» (модули, глазки, логотип), эффекты рисуются через неё. Поэтому она
 * работает с любым стилем и не трогает статическую отрисовку. Поисковые узоры и сетка
 * не двигаются — меняются только цвет и свет, и каждый кадр остаётся читаемым.
 * Резкого мигания нет: все эффекты плавные (фоточувствительность).
 */
import type { QrDesign } from "./types";
import type { QrLayout } from "./render";
import { contrastRatio, hexToRgb, hslToHex, MIN_QR_CONTRAST } from "./palette";

/** id хранятся в ссылках и метриках — не переименовывать, новые — в конец. */
export type QrAnimationId = "shine" | "flow" | "scan" | "pulse" | "swing" | "float" | "youtube" | "telegram";

export const QR_ANIMATIONS: { id: QrAnimationId; label: string; hint: string }[] = [
  { id: "shine", label: "Блик", hint: "По коду пробегает световой блик" },
  { id: "flow", label: "Перелив", hint: "Цвета плавно перетекают по модулям" },
  { id: "scan", label: "Сканер", hint: "Светящаяся линия ходит вверх-вниз" },
  { id: "pulse", label: "Пульс", hint: "Бьётся, как сердце: «тук-тук» и пауза" },
  { id: "swing", label: "3D-поворот", hint: "Код качается в пространстве, как карточка" },
  { id: "float", label: "3D-парение", hint: "Код плавно парит и наклоняется" },
  { id: "youtube", label: "YouTube", hint: "Кнопка ▶ в центре, ник канала и «Подписаться»" },
  { id: "telegram", label: "Telegram", hint: "Самолётик в центре, ник канала и «Подписаться»" },
];

/** Карточки соцсетей: свой значок в центре кода и подпись с ником под кодом. */
export const QR_SOCIAL_ANIMATIONS: QrAnimationId[] = ["youtube", "telegram"];
export const isSocialAnimation = (id: QrAnimationId) => QR_SOCIAL_ANIMATIONS.includes(id);
/** Размер плашки значка (как `logoSize`): код под ней держится только с коррекцией H. */
export const SOCIAL_LOGO_SIZE = 22;
export const SOCIAL_HANDLE_MAX = 32;

/** Ник для подписи: одно слово без «@» получает «@», название с пробелами — как есть. */
export function formatSocialHandle(raw: string | undefined): string {
  const v = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, SOCIAL_HANDLE_MAX);
  if (!v) return "";
  return /^[\p{L}\d_.-]+$/u.test(v) ? `@${v}` : v;
}

export function isQrAnimationId(v: unknown): v is QrAnimationId {
  return typeof v === "string" && QR_ANIMATIONS.some((a) => a.id === v);
}

export const QR_ANIMATION_FRAMES = 40;
export const QR_ANIMATION_DELAY_MS = 50;

export type QrAnimationDesign = Pick<QrDesign, "fg" | "bg" | "bgTransparent" | "gradient" | "grad1" | "grad2">;

export interface QrAnimationOptions {
  id: QrAnimationId;
  design: QrAnimationDesign;
  layout: QrLayout;
  /** 0..1 — сила эффекта. Если кадр не читается, вызывающий пробует слабее. */
  intensity?: number;
  /** Квадрат логотипа/надписи в базовых координатах: «Перелив» его не перекрашивает. */
  centerBox?: { x: number; y: number; w: number; h: number } | null;
  /** Ник или название канала для YouTube / Telegram. */
  handle?: string;
}

export interface QrAnimation {
  frames: number;
  delayMs: number;
  width: number;
  height: number;
  /** Рисует кадр `index` (0..frames-1) в ctx размера width × height. */
  draw(ctx: CanvasRenderingContext2D, index: number): void;
}

// ── Цвета ────────────────────────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}

function normHex(c: string | undefined, fallback: string): string {
  return c && /^#[0-9a-f]{6}$/i.test(c) ? c : fallback;
}

/** Двигает светлоту, пока цвет не станет контрастным к фону (тёмнее на светлом фоне, светлее на тёмном). */
export function ensureContrast(color: string, bg: string, min = MIN_QR_CONTRAST): string {
  if (contrastRatio(color, bg) >= min) return color;
  const [h, s, l0] = hexToHsl(color);
  const darker = contrastRatio("#000000", bg) >= contrastRatio("#ffffff", bg);
  let l = l0;
  for (let i = 0; i < 100; i++) {
    l = darker ? l - 1 : l + 1;
    if (l <= 0 || l >= 100) break;
    const c = hslToHex(h, s, l);
    if (contrastRatio(c, bg) >= min) return c;
  }
  return darker ? "#000000" : "#ffffff";
}

const DEFAULT_FLOW = ["#2563eb", "#9333ea", "#e11d48", "#0891b2"];

/**
 * Четыре цвета «Перелива» из оформления: свой цвет кода и насыщенные соседние тона (±80°),
 * все контрастны к фону. Через противоположный тон не идём — получаются «болотные» цвета.
 */
export function flowPalette(d: QrAnimationDesign): string[] {
  const bg = d.bgTransparent ? "#ffffff" : normHex(d.bg, "#ffffff");
  const base = normHex(d.gradient ? d.grad1 : d.fg, "#000000");
  const [h, s0, l0] = hexToHsl(base);
  let colors: string[];
  // Серый или почти чёрный код: сдвиг тона на такой светлоте не виден — берём яркую палитру.
  if (s0 < 15 || (l0 < 22 && !d.gradient)) colors = DEFAULT_FLOW;
  else {
    const s = Math.max(s0, 85);
    const l = Math.min(Math.max(l0, 38), 62);
    const second = d.gradient ? normHex(d.grad2, base) : hslToHex((h + 80) % 360, s, l);
    colors = [hslToHex(h, s, l), second, hslToHex((h + 280) % 360, s, l), hslToHex((h + 40) % 360, s, l)];
  }
  return colors.map((c) => ensureContrast(c, bg));
}

/** Яркий цвет «лазера» сканера в тоне кода. */
function accentColor(d: QrAnimationDesign): string {
  const [h, s] = hexToHsl(normHex(d.gradient ? d.grad1 : d.fg, "#000000"));
  return s < 15 ? "#06b6d4" : hslToHex(h, 90, 55);
}

// ── Маска «краски» ───────────────────────────────────────────────────────────

const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * Альфа маски — насколько пиксель отличается от фона: модули, глазки и логотип — 1, фон — 0.
 * Работает и для светлого кода на тёмном фоне.
 */
function buildInkMask(base: HTMLCanvasElement, d: QrAnimationDesign): HTMLCanvasElement {
  const { width: w, height: h } = base;
  const src = base.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, w, h);
  const [br, bgG, bb] = hexToRgb(d.bgTransparent ? "#ffffff" : normHex(d.bg, "#ffffff"));
  const bgL = lum(br, bgG, bb);
  const [fr, fg, fb] = hexToRgb(normHex(d.gradient ? d.grad1 : d.fg, "#000000"));
  const span = Math.max(40, Math.abs(lum(fr, fg, fb) - bgL));
  const out = new ImageData(w, h);
  const s = src.data;
  const o = out.data;
  for (let i = 0; i < s.length; i += 4) {
    const a = s[i + 3] / 255;
    // Прозрачное — это фон (белый лист).
    const L = lum(s[i], s[i + 1], s[i + 2]) * a + 255 * (1 - a);
    const ink = Math.min(1, Math.max(0, (Math.abs(L - bgL) - span * 0.15) / (span * 0.6)));
    o[i + 3] = Math.round(ink * 255);
  }
  const mask = document.createElement("canvas");
  mask.width = w;
  mask.height = h;
  mask.getContext("2d")!.putImageData(out, 0, 0);
  return mask;
}

// ── Эффекты ──────────────────────────────────────────────────────────────────

const smooth = (t: number) => 0.5 - 0.5 * Math.cos(2 * Math.PI * t);

/** Сердцебиение: сильный удар, слабый следом, пауза. 0..1. */
function heartbeat(t: number): number {
  const bump = (c: number, w: number) => Math.exp(-(((t - c) / w) ** 2));
  return Math.min(1, bump(0.12, 0.055) + 0.65 * bump(0.32, 0.06));
}

// ── 3D: код как карточка в пространстве ──────────────────────────────────────

type Pt = [number, number];

/** Обратная матрица 3×3 (строки). */
function invert3(m: number[][]): number[][] | null {
  const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-9) return null;
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ];
}

/** Рисует треугольник картинки src → dst аффинным преобразованием с клипом (сетка даёт перспективу). */
function drawTriangle(ctx: CanvasRenderingContext2D, img: CanvasImageSource, s: Pt[], d: Pt[]) {
  const inv = invert3([
    [s[0][0], s[1][0], s[2][0]],
    [s[0][1], s[1][1], s[2][1]],
    [1, 1, 1],
  ]);
  if (!inv) return;
  const row = (k: 0 | 1) => [0, 1, 2].map((j) => d[0][k] * inv[0][j] + d[1][k] * inv[1][j] + d[2][k] * inv[2][j]);
  const [m00, m01, m02] = row(0);
  const [m10, m11, m12] = row(1);
  // Клип чуть шире треугольника — иначе между соседними видны светлые швы.
  const cx = (d[0][0] + d[1][0] + d[2][0]) / 3;
  const cy = (d[0][1] + d[1][1] + d[2][1]) / 3;
  ctx.save();
  ctx.beginPath();
  d.forEach(([x, y], i) => {
    const len = Math.hypot(x - cx, y - cy) || 1;
    const px = x + ((x - cx) / len) * 0.8;
    const py = y + ((y - cy) / len) * 0.8;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(m00, m10, m01, m11, m02, m12);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

const GRID = 10;
/** Карточка занимает эту долю кадра: при повороте углы не вылезают за край. */
const CARD_SCALE = 0.8;

function drawCard3d(
  ctx: CanvasRenderingContext2D,
  base: HTMLCanvasElement,
  d: QrAnimationDesign,
  id: "swing" | "float",
  t: number,
  I: number,
) {
  const W = base.width;
  const H = base.height;
  const a = 2 * Math.PI * t;
  // Углы поворота: «поворот» — вокруг вертикальной оси, «парение» — наклон по кругу.
  const ry = id === "swing" ? Math.sin(a) * 0.62 * I : Math.cos(a) * 0.3 * I;
  const rx = id === "swing" ? 0.08 * I * Math.sin(2 * a) : Math.sin(a) * 0.3 * I;
  const lift = id === "float" ? Math.sin(2 * a) * H * 0.015 * I : 0;
  const focal = Math.max(W, H) * 2.2;
  const scale = CARD_SCALE;
  const cosY = Math.cos(ry), sinY = Math.sin(ry), cosX = Math.cos(rx), sinX = Math.sin(rx);
  const project = (u: number, v: number): Pt => {
    // Точка карточки относительно центра → поворот (Y, затем X) → перспектива.
    const x0 = (u - W / 2) * scale;
    const y0 = (v - H / 2) * scale;
    const x1 = x0 * cosY;
    const z1 = -x0 * sinY;
    const y2 = y0 * cosX - z1 * sinX;
    const z2 = y0 * sinX + z1 * cosX;
    const p = focal / (focal - z2);
    return [W / 2 + x1 * p, H / 2 + y2 * p - lift];
  };

  // Фон кадра: светлая «сцена» за карточкой (на тёмном коде — тёмная).
  const bg = d.bgTransparent ? "#ffffff" : normHex(d.bg, "#ffffff");
  const [br, bgG, bb] = hexToRgb(bg);
  const darkCard = lum(br, bgG, bb) < 128;
  const stage = ctx.createLinearGradient(0, 0, 0, H);
  stage.addColorStop(0, darkCard ? "#475569" : "#f1f5f9");
  stage.addColorStop(1, darkCard ? "#1e293b" : "#dbe3ee");
  ctx.fillStyle = stage;
  ctx.fillRect(0, 0, W, H);

  const corners = [project(0, 0), project(W, 0), project(W, H), project(0, H)];
  const quad = (c: CanvasRenderingContext2D) => {
    c.beginPath();
    corners.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
  };

  // Тень под карточкой: при «парении» она отстаёт от подъёма.
  ctx.save();
  ctx.shadowColor = "rgba(15,23,42,0.35)";
  ctx.shadowBlur = H * 0.06;
  ctx.shadowOffsetY = H * 0.03 + lift * 1.5;
  ctx.fillStyle = bg;
  quad(ctx);
  ctx.fill();
  ctx.restore();

  // Сама карточка: сетка треугольников с перспективой.
  const step = (n: number, total: number) => (n / GRID) * total;
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const u0 = step(c, W), u1 = step(c + 1, W), v0 = step(r, H), v1 = step(r + 1, H);
      const p00 = project(u0, v0), p10 = project(u1, v0), p11 = project(u1, v1), p01 = project(u0, v1);
      drawTriangle(ctx, base, [[u0, v0], [u1, v0], [u1, v1]], [p00, p10, p11]);
      drawTriangle(ctx, base, [[u0, v0], [u1, v1], [u0, v1]], [p00, p11, p01]);
    }
  }

  // Свет: отвернувшаяся сторона темнее, на повернутой к свету — мягкий блик.
  ctx.save();
  quad(ctx);
  ctx.clip();
  const [lx0, ly0] = corners[0];
  const [lx1, ly1] = corners[2];
  const g = ctx.createLinearGradient(lx0, ly0, lx1, ly1);
  const turn = Math.max(-1, Math.min(1, (ry + rx * 0.5) / 0.6));
  const shade = `rgba(15,23,42,${(0.16 * Math.abs(turn)).toFixed(3)})`;
  const gloss = `rgba(255,255,255,${(0.22 * Math.abs(turn)).toFixed(3)})`;
  if (turn >= 0) {
    g.addColorStop(0, gloss);
    g.addColorStop(0.5, "rgba(255,255,255,0)");
    g.addColorStop(1, shade);
  } else {
    g.addColorStop(0, shade);
    g.addColorStop(0.5, "rgba(255,255,255,0)");
    g.addColorStop(1, gloss);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function createQrAnimation(base: HTMLCanvasElement, opts: QrAnimationOptions): QrAnimation {
  const { id, design: d, layout: L } = opts;
  const I = Math.min(1, Math.max(0, opts.intensity ?? 1));
  const W = base.width;
  const H = base.height;
  const k = W / L.canvasW;
  const frames = QR_ANIMATION_FRAMES;
  if (id === "youtube" || id === "telegram") {
    const capH = Math.round(W * 0.3);
    return {
      frames,
      delayMs: QR_ANIMATION_DELAY_MS,
      width: W,
      height: H + capH,
      draw: (ctx, index) => drawSocialCard(ctx, base, L, d, id, (index % frames) / frames, capH, formatSocialHandle(opts.handle)),
    };
  }
  const transform = id === "pulse" || id === "swing" || id === "float";
  const mask = transform ? null : buildInkMask(base, d);
  const fx = document.createElement("canvas");
  fx.width = W;
  fx.height = H;
  const fctx = fx.getContext("2d")!;
  const palette = id === "flow" ? flowPalette(d) : [];
  const accent = accentColor(d);
  const center = opts.centerBox
    ? { x: opts.centerBox.x * k, y: opts.centerBox.y * k, w: opts.centerBox.w * k, h: opts.centerBox.h * k }
    : null;

  /** Рисует эффект только по «краске» кода. */
  const masked = (ctx: CanvasRenderingContext2D, paint: (c: CanvasRenderingContext2D) => void, keepCenter = false) => {
    fctx.globalCompositeOperation = "source-over";
    fctx.clearRect(0, 0, W, H);
    paint(fctx);
    fctx.globalCompositeOperation = "destination-in";
    fctx.drawImage(mask!, 0, 0);
    if (keepCenter && center) {
      fctx.globalCompositeOperation = "destination-out";
      fctx.fillRect(center.x, center.y, center.w, center.h);
    }
    fctx.globalCompositeOperation = "source-over";
    ctx.drawImage(fx, 0, 0);
  };

  const light = (a: number) => `rgba(255,255,255,${(a * I).toFixed(3)})`;

  const draw = (ctx: CanvasRenderingContext2D, index: number) => {
    const t = (index % frames) / frames;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    if (id === "swing" || id === "float") {
      drawCard3d(ctx, base, d, id, t, I);
      ctx.restore();
      return;
    }

    if (id === "pulse") {
      // В покое код чуть меньше кадра, на ударе — ровно в кадр: края (сердце, рамка) не обрезаются.
      const amp = 0.07 * I;
      const s = (1 + amp * heartbeat(t)) / (1 + amp);
      if (d.bgTransparent) ctx.clearRect(0, 0, W, H);
      else {
        ctx.fillStyle = normHex(d.bg, "#ffffff");
        ctx.fillRect(0, 0, W, H);
      }
      ctx.imageSmoothingQuality = "high";
      ctx.translate(W / 2, H / 2);
      ctx.scale(s, s);
      ctx.translate(-W / 2, -H / 2);
      ctx.drawImage(base, 0, 0);
      ctx.restore();
      return;
    }

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0);

    switch (id) {
      case "shine": {
        // Блик пробегает за 65% цикла, потом пауза — так выглядит дороже, чем бесконечная лента.
        const run = t / 0.65;
        if (run <= 1) {
          const pos = -0.25 + run * 1.5;
          const w = 0.09;
          masked(ctx, (c) => {
            const g = c.createLinearGradient(W * (pos - w), H * (pos - w), W * (pos + w), H * (pos + w));
            g.addColorStop(0, light(0));
            g.addColorStop(0.5, light(0.55));
            g.addColorStop(1, light(0));
            c.fillStyle = g;
            c.fillRect(0, 0, W, H);
          });
        }
        break;
      }
      case "flow": {
        // Период узора — 0.6 диагонали: на коде видно сразу несколько цветов.
        // Узор сдвигается ровно на период за цикл — петля без шва.
        const len = Math.hypot(W, H);
        const period = len * 0.6;
        const reps = Math.ceil(len / period) + 1;
        const ux = W / len;
        const uy = H / len;
        const s0 = -t * period;
        const s1 = s0 + reps * period;
        const n = palette.length * reps;
        masked(
          ctx,
          (c) => {
            const g = c.createLinearGradient(ux * s0, uy * s0, ux * s1, uy * s1);
            for (let i = 0; i <= n; i++) g.addColorStop(i / n, palette[i % palette.length]);
            c.globalAlpha = 0.4 + 0.6 * I;
            c.fillStyle = g;
            c.fillRect(0, 0, W, H);
            c.globalAlpha = 1;
          },
          true,
        );
        break;
      }
      case "scan": {
        const top = L.qrTop * k;
        const bottom = (L.qrTop + L.qrSize) * k;
        const y = L.rotated ? H * smooth(t) : top + (bottom - top) * smooth(t);
        const glowH = (bottom - top) * 0.1;
        masked(ctx, (c) => {
          const g = c.createLinearGradient(0, y - glowH, 0, y + glowH);
          g.addColorStop(0, light(0));
          g.addColorStop(0.5, light(0.5));
          g.addColorStop(1, light(0));
          c.fillStyle = g;
          c.fillRect(0, y - glowH, W, glowH * 2);
        });
        // Тонкая полупрозрачная линия: толстая закрывает целый ряд светлых модулей.
        const lineH = Math.max(1, H * 0.003);
        const x0 = L.rotated ? 0 : L.qrLeft * k;
        const x1 = L.rotated ? W : (L.qrLeft + L.qrSize) * k;
        ctx.globalAlpha = 0.35 + 0.35 * I;
        ctx.shadowColor = accent;
        ctx.shadowBlur = H * 0.012;
        ctx.fillStyle = accent;
        ctx.fillRect(x0, y - lineH / 2, x1 - x0, lineH);
        break;
      }
    }
    ctx.restore();
  };

  return { frames, delayMs: QR_ANIMATION_DELAY_MS, width: W, height: H, draw };
}


// ── Карточки YouTube / Telegram ──────────────────────────────────────────────

const SOCIAL_FONT = "Inter, 'Segoe UI', Roboto, system-ui, sans-serif";
const YT_RED = "#ff0033";
const TG_BLUE = "#229ed9";

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

const bumpAt = (t: number, c: number, w: number) => Math.exp(-(((t - c) / w) ** 2));

function fitText(c: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (c.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && c.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

/** Кнопка ▶: «нажимается» вместе с «Подписаться», потом по ней проходит блик. */
function drawYoutubeIcon(c: CanvasRenderingContext2D, cx: number, cy: number, size: number, t: number) {
  const press = 1 - 0.14 * bumpAt(t, 0.36, 0.035);
  const w = size * press;
  const h = w * 0.7;
  c.save();
  c.translate(cx, cy);
  roundRect(c, -w / 2, -h / 2, w, h, h * 0.3);
  c.fillStyle = YT_RED;
  c.fill();
  // Блик по кнопке.
  const run = (t - 0.5) / 0.3;
  if (run > 0 && run < 1) {
    c.save();
    c.clip();
    const x = -w + run * w * 2;
    const g = c.createLinearGradient(x - w * 0.25, 0, x + w * 0.25, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(-w, -h, w * 2, h * 2);
    c.restore();
  }
  c.beginPath();
  c.moveTo(-h * 0.2, -h * 0.27);
  c.lineTo(h * 0.32, 0);
  c.lineTo(-h * 0.2, h * 0.27);
  c.closePath();
  c.fillStyle = "#ffffff";
  c.fill();
  c.restore();
}

/** Бумажный самолётик: держится, улетает вправо-вверх и прилетает слева-снизу. */
function drawTelegramIcon(c: CanvasRenderingContext2D, cx: number, cy: number, size: number, t: number) {
  const r = size / 2;
  c.save();
  c.translate(cx, cy);
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  const g = c.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, "#2aabee");
  g.addColorStop(1, TG_BLUE);
  c.fillStyle = g;
  c.fill();
  c.clip();
  let dx = 0;
  let dy = Math.sin(t * Math.PI * 4) * r * 0.04;
  if (t >= 0.5 && t < 0.72) {
    const p = (t - 0.5) / 0.22;
    dx = p * p * r * 1.9;
    dy = -p * p * r * 1.3;
  } else if (t >= 0.72) {
    const p = 1 - (t - 0.72) / 0.28;
    const e = p * p;
    dx = -e * r * 1.9;
    dy = e * r * 1.3;
  }
  c.translate(dx, dy);
  const s = r * 0.95;
  c.beginPath();
  c.moveTo(-0.52 * s, -0.02 * s);
  c.lineTo(0.46 * s, -0.42 * s);
  c.lineTo(0.3 * s, 0.42 * s);
  c.lineTo(0.02 * s, 0.2 * s);
  c.lineTo(-0.12 * s, 0.34 * s);
  c.lineTo(-0.12 * s, 0.12 * s);
  c.closePath();
  c.fillStyle = "#ffffff";
  c.fill();
  c.beginPath();
  c.moveTo(-0.12 * s, 0.12 * s);
  c.lineTo(0.3 * s, -0.24 * s);
  c.lineTo(0.02 * s, 0.2 * s);
  c.closePath();
  c.fillStyle = "#c8e6f7";
  c.fill();
  c.restore();
}

function drawBell(c: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, color: string) {
  c.save();
  c.translate(x, y - size * 0.45);
  c.rotate(angle);
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(-size * 0.42, size * 0.62);
  c.quadraticCurveTo(-size * 0.36, size * 0.5, -size * 0.34, size * 0.2);
  c.quadraticCurveTo(-size * 0.3, -size * 0.06, 0, -size * 0.1);
  c.quadraticCurveTo(size * 0.3, -size * 0.06, size * 0.34, size * 0.2);
  c.quadraticCurveTo(size * 0.36, size * 0.5, size * 0.42, size * 0.62);
  c.closePath();
  c.fill();
  c.beginPath();
  c.arc(0, size * 0.74, size * 0.11, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function drawSocialCard(
  ctx: CanvasRenderingContext2D,
  base: HTMLCanvasElement,
  L: QrLayout,
  d: QrAnimationDesign,
  id: "youtube" | "telegram",
  t: number,
  capH: number,
  handle: string,
) {
  const W = base.width;
  const H = base.height;
  const k = W / L.canvasW;
  const bg = d.bgTransparent ? "#ffffff" : normHex(d.bg, "#ffffff");
  const [br, bgG, bb] = hexToRgb(bg);
  const darkBg = lum(br, bgG, bb) < 128;
  const text = darkBg ? "#f8fafc" : "#0f172a";
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H + capH);
  ctx.drawImage(base, 0, 0);

  // Плашка под значок поверх центра кода.
  const box = qrCenterBox(L, SOCIAL_LOGO_SIZE);
  const bx = box.x * k, by = box.y * k, bw = box.w * k;
  ctx.fillStyle = bg;
  roundRect(ctx, bx, by, bw, bw, bw * 0.22);
  ctx.fill();
  const icon = bw * 0.82;
  if (id === "youtube") drawYoutubeIcon(ctx, bx + bw / 2, by + bw / 2, icon, t);
  else drawTelegramIcon(ctx, bx + bw / 2, by + bw / 2, icon, t);

  // Подпись: ник и кнопка.
  const top = H - capH * 0.08;
  const label = handle || (id === "youtube" ? "Мой канал" : "Мой канал в Telegram");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Длинное название: сначала уменьшаем шрифт до 70%, потом уже многоточие.
  let fontPx = Math.round(W * 0.058);
  const minPx = Math.round(fontPx * 0.7);
  ctx.font = `800 ${fontPx}px ${SOCIAL_FONT}`;
  while (fontPx > minPx && ctx.measureText(label).width > W * 0.86) {
    fontPx -= 1;
    ctx.font = `800 ${fontPx}px ${SOCIAL_FONT}`;
  }
  ctx.fillStyle = text;
  ctx.fillText(fitText(ctx, label, W * 0.86), W / 2, top + capH * 0.22);

  const pillH = capH * 0.36;
  const pillY = top + capH * 0.46;
  ctx.font = `700 ${Math.round(pillH * 0.42)}px ${SOCIAL_FONT}`;
  if (id === "youtube") {
    // До 36% цикла — «Подписаться», нажатие, дальше «Вы подписаны» с колокольчиком.
    const subscribed = t >= 0.38;
    const press = 1 - 0.07 * bumpAt(t, 0.36, 0.03);
    const caption = subscribed ? "Вы подписаны" : "Подписаться";
    const pillW = Math.max(W * 0.46, ctx.measureText(caption).width + pillH * (subscribed ? 1.9 : 1.1)) * press;
    const ph = pillH * press;
    const px = (W - pillW) / 2;
    const py = pillY + (pillH - ph) / 2;
    roundRect(ctx, px, py, pillW, ph, ph / 2);
    ctx.fillStyle = subscribed ? (darkBg ? "#334155" : "#e5e7eb") : darkBg ? "#f8fafc" : "#0f0f0f";
    ctx.fill();
    ctx.fillStyle = subscribed ? text : darkBg ? "#0f0f0f" : "#ffffff";
    if (subscribed) {
      const wiggle = Math.sin((t - 0.38) * Math.PI * 14) * 0.45 * Math.exp(-(t - 0.38) * 6);
      const tw = ctx.measureText(caption).width;
      const bellX = W / 2 - tw / 2 - ph * 0.15;
      drawBell(ctx, bellX, py + ph / 2, ph * 0.42, wiggle, text);
      ctx.fillText(caption, W / 2 + ph * 0.3, py + ph / 2);
    } else {
      ctx.fillText(caption, W / 2, py + ph / 2);
    }
  } else {
    const caption = "Подписаться";
    const pillW = Math.max(W * 0.46, ctx.measureText(caption).width + pillH * 1.1);
    const px = (W - pillW) / 2;
    roundRect(ctx, px, pillY, pillW, pillH, pillH / 2);
    ctx.fillStyle = TG_BLUE;
    ctx.fill();
    // Блик по кнопке, пока самолётик в полёте.
    const run = (t - 0.45) / 0.35;
    if (run > 0 && run < 1) {
      ctx.save();
      ctx.clip();
      const x = px - pillW * 0.3 + run * pillW * 1.6;
      const g = ctx.createLinearGradient(x - pillH, 0, x + pillH, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,0.4)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(px, pillY, pillW, pillH);
      ctx.restore();
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillText(caption, W / 2, pillY + pillH / 2);
  }
  ctx.restore();
}

/** Квадрат логотипа/надписи в базовых координатах — та же формула, что в render.ts. */
export function qrCenterBox(L: QrLayout, logoSizePct: number) {
  const inner = L.qrSize * (logoSizePct / 100);
  const box = inner + L.qrSize * 0.04;
  return { x: L.centerX - box / 2, y: L.centerY - box / 2, w: box, h: box };
}

/** Живое превью в canvas: возвращает функцию остановки. */
export function playQrAnimation(canvas: HTMLCanvasElement, anim: QrAnimation): () => void {
  canvas.width = anim.width;
  canvas.height = anim.height;
  const ctx = canvas.getContext("2d")!;
  let raf = 0;
  const start = performance.now();
  const loop = (now: number) => {
    const idx = Math.floor((now - start) / anim.delayMs) % anim.frames;
    anim.draw(ctx, idx);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}
