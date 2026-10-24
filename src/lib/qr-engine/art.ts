/**
 * Арт-режимы: код внутри фигуры (силуэт), фото-гравюра (дизеринг) и служебные зоны QR,
 * которые в этих режимах надо оставлять сплошными. Чистые функции — без canvas — покрыты
 * юнит-тестами (`art.test.ts`); растеризация масок — внизу файла.
 */
import type { QrSilhouette } from "./types";

// ── Служебные зоны QR ────────────────────────────────────────────────────────

/** Центры выравнивающих узоров (ISO/IEC 18004, приложение E). */
export function alignmentCenters(count: number): [number, number][] {
  const version = (count - 17) / 4;
  if (!Number.isInteger(version) || version < 2) return [];
  const posCount = Math.floor(version / 7) + 2;
  const step = count === 145 ? 26 : Math.ceil((count - 13) / (2 * posCount - 2)) * 2;
  const coords = [count - 7];
  for (let i = 1; i < posCount - 1; i++) coords[i] = coords[i - 1] - step;
  coords.push(6);
  coords.reverse();
  const last = coords.length - 1;
  const out: [number, number][] = [];
  for (let i = 0; i <= last; i++) {
    for (let j = 0; j <= last; j++) {
      // Три угла заняты поисковыми узорами.
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      out.push([coords[i], coords[j]]);
    }
  }
  return out;
}

/** Поисковый узор вместе с белой полосой-разделителем (8×8 в трёх углах). */
export function isInFinderZone(row: number, col: number, count: number): boolean {
  return (row < 8 && col < 8) || (row < 8 && col >= count - 8) || (row >= count - 8 && col < 8);
}

/**
 * Карта служебных модулей: 1 — синхрополосы и выравнивающие узоры (рисуются целиком,
 * иначе камера теряет сетку), 2 — поисковые узоры с разделителем (их рисует отдельная функция).
 */
export function functionModuleMap(count: number): Uint8Array {
  const map = new Uint8Array(count * count);
  for (let i = 0; i < count; i++) {
    map[6 * count + i] = 1;
    map[i * count + 6] = 1;
  }
  for (const [cr, cc] of alignmentCenters(count)) {
    for (let r = cr - 2; r <= cr + 2; r++) for (let c = cc - 2; c <= cc + 2; c++) map[r * count + c] = 1;
  }
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) if (isInFinderZone(r, c, count)) map[r * count + c] = 2;
  }
  return map;
}

// ── Фото-гравюра ─────────────────────────────────────────────────────────────

/** Субпикселей на модуль и размер центрального квадрата, который несёт значение модуля. */
export const HALFTONE_RES = 7;
const HALFTONE_CORE = 3;

/** Растягивает яркость на весь диапазон (2–98 перцентили): тусклые фото иначе уходят в серую кашу. */
export function autoLevels(lum: Float32Array): void {
  const hist = new Uint32Array(256);
  for (let i = 0; i < lum.length; i++) hist[Math.max(0, Math.min(255, Math.round(lum[i])))]++;
  const pick = (q: number) => {
    let acc = 0;
    const target = lum.length * q;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= target) return v;
    }
    return 255;
  };
  const lo = pick(0.02);
  const hi = pick(0.98);
  if (hi - lo < 16) return;
  const k = 255 / (hi - lo);
  for (let i = 0; i < lum.length; i++) lum[i] = Math.max(0, Math.min(255, (lum[i] - lo) * k));
}

/**
 * Высветляет гравюру: тёмные фото иначе заливают код сплошной чернотой, и светлые модули
 * тонут. Тени поднимаются до ~25 % серого, средние тона — гаммой.
 */
export function brightenForHalftone(lum: Float32Array): void {
  for (let i = 0; i < lum.length; i++) lum[i] = 64 + 191 * Math.pow(lum[i] / 255, 0.75);
}

/**
 * Какие субпиксели обязаны совпасть с модулем: 1 — тёмный, 2 — светлый, 0 — свободны для фото.
 * Поле вокруг кода свободно, кроме светлого кольца в один модуль вплотную к коду.
 */
export function halftoneForcedMap(modules: ArrayLike<number | boolean>, count: number, margin: number): Uint8Array {
  const R = HALFTONE_RES;
  const side = (count + margin * 2) * R;
  const forced = new Uint8Array(side * side);
  const fn = functionModuleMap(count);
  const core0 = Math.floor((R - HALFTONE_CORE) / 2);
  // Светлое кольцо в модуль вокруг кода: тёмный дизеринг вплотную к поисковым узорам
  // ломает их пропорции 1:1:3:1:1, и камера не находит код.
  if (margin > 0) {
    const ring0 = (margin - 1) * R;
    const ring1 = (margin + count + 1) * R;
    for (let y = ring0; y < ring1; y++) {
      for (let x = ring0; x < ring1; x++) {
        const inCode = y >= margin * R && y < (margin + count) * R && x >= margin * R && x < (margin + count) * R;
        if (!inCode) forced[y * side + x] = 2;
      }
    }
  }
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      const kind = fn[r * count + c];
      const dark = !!modules[r * count + c];
      // Поисковые узоры рисуются поверх своей формой — под ними чисто.
      const value = kind === 2 ? 2 : dark ? 1 : 2;
      const full = kind !== 0;
      const y0 = (r + margin) * R;
      const x0 = (c + margin) * R;
      for (let sy = 0; sy < R; sy++) {
        for (let sx = 0; sx < R; sx++) {
          const core = sy >= core0 && sy < core0 + HALFTONE_CORE && sx >= core0 && sx < core0 + HALFTONE_CORE;
          if (full || core) forced[(y0 + sy) * side + x0 + sx] = value;
        }
      }
    }
  }
  return forced;
}

/**
 * Сдвигает яркость пикселей внутри модуля к его значению: светлые модули светлеют, тёмные темнеют.
 * Картинка остаётся, а средний тон каждого модуля — тот, что ждёт камера (иначе серый дизеринг
 * вокруг центров размывает код при печати и съёмке).
 */
export function biasTowardModules(
  lum: Float32Array,
  modules: ArrayLike<number | boolean>,
  count: number,
  margin: number,
  amount: number,
): void {
  const R = HALFTONE_RES;
  const side = (count + margin * 2) * R;
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      const delta = modules[r * count + c] ? -amount : amount;
      const y0 = (r + margin) * R;
      const x0 = (c + margin) * R;
      for (let sy = 0; sy < R; sy++) {
        const row = (y0 + sy) * side + x0;
        for (let sx = 0; sx < R; sx++) lum[row + sx] = Math.max(0, Math.min(255, lum[row + sx] + delta));
      }
    }
  }
}

/** Флойд — Стейнберг змейкой. */
export function ditherHalftone(lum: Float32Array, w: number, h: number, forced: Uint8Array): Uint8Array {
  const buf = Float32Array.from(lum);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const ltr = y % 2 === 0;
    for (let i = 0; i < w; i++) {
      const x = ltr ? i : w - 1 - i;
      const idx = y * w + x;
      const v = buf[idx];
      const f = forced[idx];
      const dark = f === 1 ? true : f === 2 ? false : v < 128;
      out[idx] = dark ? 1 : 0;
      // Принудительные пиксели ошибку не раздают: под большими служебными зонами
      // она копилась бы в сплошные пятна. Остальную ошибку ограничиваем по той же причине.
      if (f) continue;
      const err = Math.max(-96, Math.min(96, v - (dark ? 0 : 255)));
      const dir = ltr ? 1 : -1;
      const nx = x + dir;
      const px = x - dir;
      if (nx >= 0 && nx < w) buf[idx + dir] += (err * 7) / 16;
      if (y + 1 < h) {
        if (px >= 0 && px < w) buf[idx + w - dir] += (err * 3) / 16;
        buf[idx + w] += (err * 5) / 16;
        if (nx >= 0 && nx < w) buf[idx + w + dir] += err / 16;
      }
    }
  }
  return out;
}

// ── Силуэты ──────────────────────────────────────────────────────────────────

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Правильный многоугольник или звезда: `points` вершин, внутренний радиус `inner` (1 — многоугольник). */
function starPath(points: number, outer: number, inner: number, rotation = -Math.PI / 2): string {
  const parts: string[] = [];
  const n = inner < 1 ? points * 2 : points;
  for (let i = 0; i < n; i++) {
    const r = inner < 1 && i % 2 ? outer * inner : outer;
    const a = rotation + (i * Math.PI * 2) / n;
    parts.push(`${i ? "L" : "M"}${r1(50 + r * Math.cos(a))} ${r1(50 + r * Math.sin(a))}`);
  }
  return parts.join("") + "Z";
}

/** Шестерёнка: зубья-трапеции по окружности. */
function gearPath(teeth: number): string {
  const parts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  const pt = (r: number, a: number) => `${r1(50 + r * Math.cos(a))} ${r1(50 + r * Math.sin(a))}`;
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    parts.push(`${i ? "L" : "M"}${pt(36, a - step * 0.3)}`);
    parts.push(`L${pt(49, a - step * 0.2)}L${pt(49, a + step * 0.2)}L${pt(36, a + step * 0.3)}`);
  }
  return parts.join("") + "Z";
}

/** Пути в квадрате 100×100. Новые фигуры — только в конец: `id` хранятся в шаблонах. */
export const QR_SILHOUETTES: { id: Exclude<QrSilhouette, "none" | "custom">; label: string; path: string }[] = [
  { id: "heart", label: "Сердце", path: "M50 94C20 74 2 56 2 33C2 15 15 4 29 4C39 4 46 9 50 17C54 9 61 4 71 4C85 4 98 15 98 33C98 56 80 74 50 94Z" },
  {
    id: "tooth",
    label: "Зуб",
    path: "M24 4C10 4 3 15 3 30C3 44 9 53 13 63C17 76 17 95 28 97C39 99 40 72 50 71C60 72 61 99 72 97C83 95 83 76 87 63C91 53 97 44 97 30C97 15 90 4 76 4C64 4 59 10 50 10C41 10 36 4 24 4Z",
  },
  {
    id: "cat",
    label: "Кот",
    path: "M8 4L32 27C38 25 44 24 50 24C56 24 62 25 68 27L92 4L94 50C97 57 98 63 98 69C98 88 77 98 50 98C23 98 2 88 2 69C2 63 3 57 6 50Z",
  },
  { id: "cloud", label: "Облако", path: "M25 84C11 84 1 73 1 60C1 47 10 38 22 37C24 22 36 11 51 11C65 11 76 21 79 34C91 35 99 45 99 58C99 72 89 84 75 84Z" },
  { id: "bubble", label: "Чат", path: "M14 4H86C93 4 98 9 98 16V70C98 77 93 82 86 82H42L18 98L23 82H14C7 82 2 77 2 70V16C2 9 7 4 14 4Z" },
  { id: "shield", label: "Щит", path: "M50 2L95 15V45C95 72 75 88 50 98C25 88 5 72 5 45V15Z" },
  { id: "drop", label: "Капля", path: "M50 1C50 1 87 41 87 63C87 84 70 99 50 99C30 99 13 84 13 63C13 41 50 1 50 1Z" },
  { id: "house", label: "Дом", path: "M50 3L99 45H87V97H13V45H1Z" },
  {
    id: "cup",
    label: "Чашка",
    path: "M4 16H76V56C76 79 60 94 40 94C20 94 4 79 4 56ZM76 26H84C93 26 99 33 99 42C99 53 92 60 83 60H75V50H83C87 50 89 47 89 42C89 38 87 36 83 36H76Z",
  },
  { id: "circle", label: "Круг", path: "M50 1A49 49 0 1 1 49.99 1Z" },
  { id: "gear", label: "Шестерня", path: gearPath(8) },
  { id: "pin", label: "Метка", path: "M50 1C26 1 8 19 8 42C8 69 50 99 50 99C50 99 92 69 92 42C92 19 74 1 50 1Z" },
  { id: "cross", label: "Крест", path: "M25 2H75V25H98V75H75V98H25V75H2V25H25Z" },
  {
    id: "car",
    label: "Машина",
    // Кузов с арками и отдельные колёса — иначе силуэт читается как клякса.
    path: "M7 64C4 64 2 61 2 57V47C2 42 5 39 10 38L23 35L35 21C38 18 42 16 47 16H65C70 16 74 18 77 22L88 35C94 36 98 40 98 46V57C98 61 96 64 93 64H86A14 14 0 0 0 58 64H42A14 14 0 0 0 14 64ZM18 66a10 10 0 1 0 20 0a10 10 0 1 0 -20 0ZM62 66a10 10 0 1 0 20 0a10 10 0 1 0 -20 0Z",
  },
  {
    id: "bag",
    label: "Пакет",
    path: "M12 30H88L94 97H6ZM31 30V24C31 12 39 4 50 4C61 4 69 12 69 24V30H61V24C61 17 57 12 50 12C43 12 39 17 39 24V30Z",
  },
  { id: "shirt", label: "Футболка", path: "M34 4C38 10 44 13 50 13C56 13 62 10 66 4L98 21L87 42L77 37V97H23V37L13 42L2 21Z" },
  {
    id: "paw",
    label: "Лапа",
    path: "M50 44C69 44 86 61 86 78C86 92 74 99 63 97C57 96 54 93 50 93C46 93 43 96 37 97C26 99 14 92 14 78C14 61 31 44 50 44ZM2 38a10 13 -20 1 0 20 0a10 13 -20 1 0 -20 0ZM24 16a10 13 -8 1 0 20 0a10 13 -8 1 0 -20 0ZM56 16a10 13 8 1 0 20 0a10 13 8 1 0 -20 0ZM78 38a10 13 20 1 0 20 0a10 13 20 1 0 -20 0Z",
  },
  { id: "star", label: "Звезда", path: starPath(5, 50, 0.58) },
  { id: "hexagon", label: "Соты", path: starPath(6, 50, 1, 0) },
  { id: "crown", label: "Корона", path: "M3 26L28 50L50 10L72 50L97 26L88 92H12Z" },
];

export interface QrMask {
  w: number;
  h: number;
  /** 1 — внутри фигуры. */
  data: Uint8Array;
}

/** Самый большой квадрат внутри маски; из почти равных берём ближайший к центру масс. */
export function maxInscribedSquare(mask: QrMask): { x: number; y: number; size: number } | null {
  const { w, h, data } = mask;
  const dp = new Uint16Array(w * h);
  let max = 0;
  let sumX = 0;
  let sumY = 0;
  let area = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!data[i]) continue;
      sumX += x;
      sumY += y;
      area++;
      dp[i] = x === 0 || y === 0 ? 1 : Math.min(dp[i - 1], dp[i - w], dp[i - w - 1]) + 1;
      if (dp[i] > max) max = dp[i];
    }
  }
  if (!max) return null;
  const cx = sumX / area;
  const cy = sumY / area;
  const size = Math.max(1, Math.floor(max * 0.97));
  let best: { x: number; y: number; size: number } | null = null;
  let bestDist = Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (dp[y * w + x] < size) continue;
      const sx = x - size + 1;
      const sy = y - size + 1;
      const dist = (sx + size / 2 - cx) ** 2 + (sy + size / 2 - cy) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = { x: sx, y: sy, size };
      }
    }
  }
  return best;
}

export interface SilhouetteFit {
  cols: number;
  rows: number;
  /** Левый верхний угол кода (вместе с полем) в клетках сетки. */
  qrCol: number;
  qrRow: number;
  /** 1 — центр клетки внутри фигуры. */
  inside: Uint8Array;
}

/** Раскладывает фигуру на сетку модулей так, чтобы код с полем (`qrCells`) встал во вписанный квадрат. */
export function fitSilhouette(mask: QrMask, qrCells: number, fitPct: number): SilhouetteFit | null {
  const sq = maxInscribedSquare(mask);
  if (!sq || sq.size < 8) return null;
  const qrPx = sq.size * (Math.max(50, Math.min(100, fitPct)) / 100);
  const cellPx = qrPx / qrCells;
  const cols = Math.ceil(mask.w / cellPx) + 2;
  const rows = Math.ceil(mask.h / cellPx) + 2;
  const ox = (cols * cellPx - mask.w) / 2;
  const oy = (rows * cellPx - mask.h) / 2;
  const qrCol = Math.round((sq.x + (sq.size - qrPx) / 2 + ox) / cellPx);
  const qrRow = Math.round((sq.y + (sq.size - qrPx) / 2 + oy) / cellPx);
  const inside = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const py = Math.floor((r + 0.5) * cellPx - oy);
    if (py < 0 || py >= mask.h) continue;
    for (let c = 0; c < cols; c++) {
      const px = Math.floor((c + 0.5) * cellPx - ox);
      if (px >= 0 && px < mask.w && mask.data[py * mask.w + px]) inside[r * cols + c] = 1;
    }
  }
  return { cols, rows, qrCol, qrRow, inside };
}

/** Детерминированный «шум» для узора: один и тот же код всегда выглядит одинаково. */
export function cellNoise(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ── Растеризация масок (браузер) ─────────────────────────────────────────────

const MASK_SIZE = 240;

function cropMask(w: number, h: number, data: Uint8Array): QrMask | null {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!data[y * w + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const out = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) out.set(data.subarray((y + y0) * w + x0, (y + y0) * w + x0 + cw), y * cw);
  return { w: cw, h: ch, data: out };
}

const maskCache = new Map<string, QrMask | null>();
const imageMaskCache = new WeakMap<object, QrMask | null>();

/**
 * Маска фигуры. Своя картинка: если в ней есть прозрачность — берём непрозрачное,
 * иначе всё, что заметно отличается от цвета углов (фона).
 */
export function silhouetteMask(id: QrSilhouette | undefined, custom?: CanvasImageSource | null): QrMask | null {
  if (!id || id === "none" || typeof document === "undefined") return null;
  if (id === "custom") {
    if (!custom) return null;
    if (imageMaskCache.has(custom as object)) return imageMaskCache.get(custom as object) ?? null;
    const mask = rasterizeImageMask(custom);
    imageMaskCache.set(custom as object, mask);
    return mask;
  }
  if (maskCache.has(id)) return maskCache.get(id) ?? null;
  const preset = QR_SILHOUETTES.find((s) => s.id === id);
  let mask: QrMask | null = null;
  const c = document.createElement("canvas");
  c.width = MASK_SIZE;
  c.height = MASK_SIZE;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (preset && ctx && typeof Path2D !== "undefined") {
    ctx.scale(MASK_SIZE / 100, MASK_SIZE / 100);
    ctx.fill(new Path2D(preset.path));
    const px = ctx.getImageData(0, 0, MASK_SIZE, MASK_SIZE).data;
    const data = new Uint8Array(MASK_SIZE * MASK_SIZE);
    for (let i = 0; i < data.length; i++) data[i] = px[i * 4 + 3] > 127 ? 1 : 0;
    mask = cropMask(MASK_SIZE, MASK_SIZE, data);
  }
  maskCache.set(id, mask);
  return mask;
}

function rasterizeImageMask(img: CanvasImageSource): QrMask | null {
  const el = img as HTMLImageElement;
  const iw = el.naturalWidth || (img as HTMLCanvasElement).width || 1;
  const ih = el.naturalHeight || (img as HTMLCanvasElement).height || 1;
  const k = MASK_SIZE / Math.max(iw, ih);
  const w = Math.max(1, Math.round(iw * k));
  const h = Math.max(1, Math.round(ih * k));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  let transparent = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 128) transparent++;
  const data = new Uint8Array(w * h);
  if (transparent > w * h * 0.02) {
    for (let i = 0; i < data.length; i++) data[i] = px[i * 4 + 3] >= 128 ? 1 : 0;
  } else {
    const corners = [0, w - 1, (h - 1) * w, h * w - 1];
    const bg = [0, 1, 2].map((ch) => corners.reduce((s, i) => s + px[i * 4 + ch], 0) / 4);
    for (let i = 0; i < data.length; i++) {
      const d = Math.abs(px[i * 4] - bg[0]) + Math.abs(px[i * 4 + 1] - bg[1]) + Math.abs(px[i * 4 + 2] - bg[2]);
      data[i] = d > 90 ? 1 : 0;
    }
  }
  return cropMask(w, h, data);
}

/** Иконка фигуры для выбора: залитый силуэт по центру квадратного canvas. */
export function renderSilhouettePreview(canvas: HTMLCanvasElement, id: Exclude<QrSilhouette, "none" | "custom">, color = "#334155") {
  const preset = QR_SILHOUETTES.find((s) => s.id === id);
  const ctx = canvas.getContext("2d");
  if (!preset || !ctx || typeof Path2D === "undefined") return;
  const size = canvas.width;
  const pad = size * 0.08;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(pad, pad);
  ctx.scale((size - pad * 2) / 100, (size - pad * 2) / 100);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(preset.path));
  ctx.restore();
}
