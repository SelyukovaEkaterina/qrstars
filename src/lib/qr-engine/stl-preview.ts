/**
 * 3D-превью модели для 3D-печати на обычном canvas 2D (без WebGL и зависимостей).
 *
 * Ортографическая камера: поворот вокруг вертикали (`azimuth`) и наклон (`elevation`).
 * Порядок отрисовки: ушко → подложка → стенки рельефа (от дальних к ближним) → все верхушки
 * одним контуром. Верхушки лежат на одной высоте, а стенки ниже неё — стенка не может
 * закрыть верхушку, поэтому такой порядок даёт правильную картинку без z-буфера.
 */
import type { QrModules } from "./types";
import { clampStlOptions, keyringGeometry, qrStlReliefCells, type QrStlOptions } from "./stl";

export interface QrStlPreviewView {
  /** Поворот вокруг вертикали, радианы. 0 — смотрим спереди. */
  azimuth: number;
  /** Наклон камеры над столом, радианы (π/2 — строго сверху). */
  elevation: number;
  /** Светлый пластик: подложка у «Рельефа», крышка у «Гравировки». */
  lightColor: string;
  /** Тёмный пластик: модули у «Рельефа», подложка у «Гравировки». */
  darkColor: string;
  /** Фон кадра; `null` — прозрачный. */
  background?: string | null;
}

export const QR_STL_PREVIEW_DEFAULT_VIEW: QrStlPreviewView = {
  azimuth: -0.35,
  elevation: 0.95,
  lightColor: "#f8fafc",
  darkColor: "#111827",
  background: null,
};

/**
 * Пары пластиков «светлый + тёмный». Модули всегда тёмные, поле светлое — инвертированный
 * код (светлые модули на тёмном) читают не все камеры.
 */
export const QR_STL_COLOR_PAIRS = [
  { id: "white-black", label: "Белый и чёрный", light: "#f8fafc", dark: "#111827" },
  { id: "white-blue", label: "Белый и синий", light: "#f8fafc", dark: "#1d4ed8" },
  { id: "yellow-black", label: "Жёлтый и чёрный", light: "#facc15", dark: "#111827" },
  { id: "white-red", label: "Белый и красный", light: "#f8fafc", dark: "#b91c1c" },
  { id: "white-green", label: "Белый и зелёный", light: "#f8fafc", dark: "#15803d" },
  { id: "wood-black", label: "Дерево и чёрный", light: "#d6b68a", dark: "#292524" },
] as const;

function rgbOf(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? v.split("").map((ch) => ch + ch).join("") : v;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Цвет грани: `k` = 1 — верх, меньше — боковые грани. Светлые цвета затемняются,
 * тёмные — высветляются: иначе стенки чёрного рельефа сливаются с верхом.
 */
function shade(hex: string, k: number): string {
  const [r, g, b] = rgbOf(hex);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const t = 1 - k;
  const ch = (x: number) =>
    Math.max(0, Math.min(255, Math.round(lum < 0.3 ? x + (255 - x) * t * 1.1 : x * (1 - t * 1.15))));
  return `rgb(${ch(r)},${ch(g)},${ch(b)})`;
}

type P3 = [number, number, number];

/**
 * Рисует модель в canvas целиком (масштаб подбирается под кадр).
 * Возвращает false, если рисовать нечего.
 */
export function drawQrStlPreview(
  canvas: HTMLCanvasElement,
  modules: QrModules,
  options: Partial<QrStlOptions>,
  view: Partial<QrStlPreviewView> = {},
): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const v = { ...QR_STL_PREVIEW_DEFAULT_VIEW, ...view };
  const o = clampStlOptions(options);
  const { cells, raised } = qrStlReliefCells(modules, o);
  const W = canvas.width;
  const H = canvas.height;
  const S = o.sizeMm;
  const cell = S / cells;
  const zBase = o.baseMm;
  const zTop = o.baseMm + o.reliefMm;
  const ring = o.keyring ? keyringGeometry(S, S) : null;
  // «Рельеф»: подложка светлая, модули тёмные. «Гравировка»: наоборот — тёмное дно, светлая крышка.
  const baseColor = o.style === "raised" ? v.lightColor : v.darkColor;
  const reliefColor = o.style === "raised" ? v.darkColor : v.lightColor;
  const depth = ring ? ring.cy + ring.rOut : S;

  const ca = Math.cos(v.azimuth), sa = Math.sin(v.azimuth);
  const ce = Math.cos(v.elevation), se = Math.sin(v.elevation);
  // Центр модели — в начале координат.
  const mx = S / 2, my = depth / 2;
  const rot = (x: number, y: number) => {
    const dx = x - mx, dy = y - my;
    return [dx * ca - dy * sa, dx * sa + dy * ca] as const;
  };
  const projRaw = (x: number, y: number, z: number) => {
    const [rx, ry] = rot(x, y);
    return [rx, -(z * ce + ry * se)] as const;
  };
  // Масштаб: вписываем углы габаритов.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const x of [0, S]) for (const y of [0, depth]) for (const z of [0, zTop]) {
    const [px, py] = projRaw(x, y, z);
    minX = Math.min(minX, px); maxX = Math.max(maxX, px);
    minY = Math.min(minY, py); maxY = Math.max(maxY, py);
  }
  const pad = Math.min(W, H) * 0.06;
  const k = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxY - minY));
  const ox = W / 2 - ((minX + maxX) / 2) * k;
  const oy = H / 2 - ((minY + maxY) / 2) * k;
  const P = (p: P3) => {
    const [px, py] = projRaw(p[0], p[1], p[2]);
    return [ox + px * k, oy + py * k] as const;
  };
  // Вектор «к камере» (0, −cos e, sin e) в мировых осях — для отсечения задних граней и порядка стенок.
  const viewX = sa * -ce;
  const viewY = ca * -ce;
  const faces = (nx: number, ny: number) => nx * viewX + ny * viewY > 1e-6;
  // Свет сверху-слева-спереди.
  const light = (nx: number, ny: number) => 0.72 + 0.18 * (-nx * 0.6 + -ny * 0.8);

  ctx.clearRect(0, 0, W, H);
  if (v.background) {
    ctx.fillStyle = v.background;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.lineJoin = "round";

  const poly = (pts: P3[], fill: string) => {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [x, y] = P(p);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    // Тонкая обводка тем же цветом закрывает щели сглаживания между гранями.
    ctx.strokeStyle = fill;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  };

  // Тень на столе.
  {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.filter = `blur(${Math.max(2, k * 1.5)}px)`;
    poly([[0, 0, 0], [S, 0, 0], [S, depth, 0], [0, depth, 0]].map((p) => [p[0] + 1.5, p[1] - 1.5, 0]) as P3[], "#0f172a");
    ctx.restore();
  }

  // Ушко: кольцо высотой с подложку.
  const drawRing = () => {
    if (!ring) return;
    const N = 48;
    const pt = (r: number, i: number, z: number): P3 => {
      const a = (i / N) * Math.PI * 2;
      return [ring.cx + Math.cos(a) * r, ring.cy + Math.sin(a) * r, z];
    };
    for (let i = 0; i < N; i++) {
      const a = ((i + 0.5) / N) * Math.PI * 2;
      const nx = Math.cos(a), ny = Math.sin(a);
      if (faces(nx, ny)) poly([pt(ring.rOut, i, 0), pt(ring.rOut, i + 1, 0), pt(ring.rOut, i + 1, zBase), pt(ring.rOut, i, zBase)], shade(baseColor, light(nx, ny) * 0.92));
      if (faces(-nx, -ny)) poly([pt(ring.rIn, i, 0), pt(ring.rIn, i + 1, 0), pt(ring.rIn, i + 1, zBase), pt(ring.rIn, i, zBase)], shade(baseColor, light(-nx, -ny) * 0.8));
    }
    ctx.beginPath();
    for (const [r, dir] of [[ring.rOut, 1], [ring.rIn, -1]] as const) {
      for (let j = 0; j <= N; j++) {
        const i = dir > 0 ? j : N - j;
        const [x, y] = P(pt(r, i, zBase));
        if (j) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.closePath();
    }
    ctx.fillStyle = shade(baseColor, 1);
    ctx.fill("evenodd");
  };

  // Подложка: видимые боковые грани + верх.
  const box = (x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, color: string, top = true) => {
    const sides: { n: [number, number]; pts: P3[] }[] = [
      { n: [1, 0], pts: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]] },
      { n: [-1, 0], pts: [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]] },
      { n: [0, 1], pts: [[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]] },
      { n: [0, -1], pts: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] },
    ];
    for (const s of sides) if (faces(s.n[0], s.n[1])) poly(s.pts, shade(color, light(s.n[0], s.n[1])));
    if (top) poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], shade(color, 1));
  };
  // Ушко той же высоты, что подложка: дальнее рисуем до неё, ближнее к камере — после.
  // Рельеф выше подложки, поэтому ушко его не закрывает ни в каком положении.
  const ringNear = !!ring && (ring.cx - mx) * viewX + (ring.cy - my) * viewY > 0;
  if (!ringNear) drawRing();
  box(0, 0, S, S, 0, zBase, baseColor);
  if (ringNear) drawRing();

  // Стенки рельефа: только наружные (сосед не поднят) и смотрящие на камеру.
  const X = (c: number) => c * cell;
  const Y = (r: number) => (cells - r) * cell;
  const isUp = (r: number, c: number) => r >= 0 && c >= 0 && r < cells && c < cells && raised[r * cells + c] === 1;
  const walls: { d: number; pts: P3[]; color: string }[] = [];
  const dirs: { dr: number; dc: number; n: [number, number] }[] = [
    { dr: 0, dc: 1, n: [1, 0] },
    { dr: -1, dc: 0, n: [0, 1] },
    { dr: 0, dc: -1, n: [-1, 0] },
    { dr: 1, dc: 0, n: [0, -1] },
  ];
  const visibleDirs = dirs.filter((d) => faces(d.n[0], d.n[1]));
  const wallColors = new Map(visibleDirs.map((d) => [d, shade(reliefColor, light(d.n[0], d.n[1]))]));
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      if (!raised[r * cells + c]) continue;
      const x0 = X(c), x1 = X(c + 1), y1 = Y(r), y0 = Y(r + 1);
      for (const d of visibleDirs) {
        if (isUp(r + d.dr, c + d.dc)) continue;
        let pts: P3[];
        if (d.dc === 1) pts = [[x1, y0, zBase], [x1, y1, zBase], [x1, y1, zTop], [x1, y0, zTop]];
        else if (d.dc === -1) pts = [[x0, y1, zBase], [x0, y0, zBase], [x0, y0, zTop], [x0, y1, zTop]];
        else if (d.dr === -1) pts = [[x1, y1, zBase], [x0, y1, zBase], [x0, y1, zTop], [x1, y1, zTop]];
        else pts = [[x0, y0, zBase], [x1, y0, zBase], [x1, y0, zTop], [x0, y0, zTop]];
        const cx = (pts[0][0] + pts[1][0]) / 2, cy = (pts[0][1] + pts[1][1]) / 2;
        // Дальность от камеры: чем больше, тем раньше рисуем.
        walls.push({ d: cx * viewX + cy * viewY, pts, color: wallColors.get(d)! });
      }
    }
  }
  walls.sort((a, b) => a.d - b.d);
  for (const w of walls) poly(w.pts, w.color);

  // Все верхушки рельефа — одним контуром (без щелей между соседними модулями).
  ctx.beginPath();
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      if (!raised[r * cells + c]) continue;
      const x0 = X(c), x1 = X(c + 1), y1 = Y(r), y0 = Y(r + 1);
      const pts: P3[] = [[x0, y0, zTop], [x1, y0, zTop], [x1, y1, zTop], [x0, y1, zTop]];
      pts.forEach((p, i) => {
        const [x, y] = P(p);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.closePath();
    }
  }
  ctx.fillStyle = shade(reliefColor, 1);
  ctx.fill("nonzero");
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = 0.5;
  ctx.stroke();
  return true;
}

/**
 * Вращение превью мышью и пальцем: по горизонтали — поворот, по вертикали (мышью) — наклон.
 * На тач-экранах вертикальный свайп остаётся прокруткой страницы (`touch-action: pan-y`).
 */
export function bindQrStlOrbit(
  canvas: HTMLCanvasElement,
  get: () => Pick<QrStlPreviewView, "azimuth" | "elevation">,
  set: (v: Pick<QrStlPreviewView, "azimuth" | "elevation">) => void,
  onStart?: () => void,
): () => void {
  let drag: { x: number; y: number; a: number; e: number; touch: boolean } | null = null;
  canvas.style.touchAction = "pan-y";
  canvas.style.cursor = "grab";
  const down = (ev: PointerEvent) => {
    const v = get();
    drag = { x: ev.clientX, y: ev.clientY, a: v.azimuth, e: v.elevation, touch: ev.pointerType === "touch" };
    canvas.setPointerCapture(ev.pointerId);
    canvas.style.cursor = "grabbing";
    onStart?.();
  };
  const move = (ev: PointerEvent) => {
    if (!drag) return;
    const w = canvas.clientWidth || 300;
    const azimuth = drag.a + ((ev.clientX - drag.x) / w) * Math.PI;
    const elevation = drag.touch
      ? drag.e
      : Math.min(Math.PI / 2, Math.max(0.35, drag.e + ((ev.clientY - drag.y) / w) * Math.PI * 0.6));
    set({ azimuth, elevation });
  };
  const up = (ev: PointerEvent) => {
    if (!drag) return;
    drag = null;
    canvas.style.cursor = "grab";
    if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
  };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  return () => {
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerup", up);
    canvas.removeEventListener("pointercancel", up);
  };
}
