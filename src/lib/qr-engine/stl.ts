/**
 * QR-код для 3D-печати: модель STL из матрицы QR (без зависимостей).
 *
 * Модель — «рельефная карта» на сетке модулей: подложка + выдавленные модули
 * («Рельеф») или светлая крышка с утопленными модулями («Гравировка»). Сетка общая
 * для всех граней, поэтому сетка замкнутая (каждое ребро — ровно у двух треугольников)
 * и без T-стыков: слайсеры принимают её без «починки». Ушко для брелока — отдельное
 * тело, заходит на подложку (слайсеры объединяют пересекающиеся тела).
 *
 * Координаты — миллиметры, X вправо, Y вверх, Z от стола. Строка 0 матрицы — верх модели,
 * так что код читается сверху, не зеркально.
 */
import type { QrModules } from "./types";

export type QrStlStyle = "raised" | "engraved";

export interface QrStlOptions {
  /** Сторона квадратной пластины, мм (без ушка). */
  sizeMm: number;
  /** Толщина подложки, мм. */
  baseMm: number;
  /** Высота рельефа (или глубина гравировки), мм. */
  reliefMm: number;
  /** Поле вокруг кода в модулях. */
  margin: number;
  /** `raised` — тёмные модули выпуклые; `engraved` — светлое поле выпуклое, модули утоплены. */
  style: QrStlStyle;
  /** Ушко с отверстием сверху — брелок, бирка. */
  keyring?: boolean;
}

export const QR_STL_DEFAULTS: QrStlOptions = {
  sizeMm: 50,
  baseMm: 2,
  reliefMm: 1,
  margin: 2,
  style: "raised",
  keyring: false,
};

export const QR_STL_LIMITS = {
  sizeMm: { min: 20, max: 200 },
  baseMm: { min: 0.8, max: 6 },
  reliefMm: { min: 0.4, max: 4 },
  margin: { min: 1, max: 4 },
} as const;

/** Модуль мельче — сопло 0,4 мм печатает его кашей, камера не прочитает. */
export const QR_STL_MIN_MODULE_MM = 1.2;

/**
 * Сетка высот: `top[r * cols + c]` — верх ячейки, `NaN` — ячейки нет.
 * `xs` — границы столбцов слева направо (cols + 1), `ys` — границы строк сверху вниз (rows + 1).
 */
export interface QrHeightGrid {
  cols: number;
  rows: number;
  xs: ArrayLike<number>;
  ys: ArrayLike<number>;
  z0: number;
  top: Float64Array;
}

/**
 * Шов между модулями, мм. Модули, которые касаются только углом, дали бы ребро у четырёх
 * граней — такую сетку слайсеры считают битой. Поэтому между модулями идут швы шириной
 * 2·SEAM: шов поднят, если поднят хоть один сосед, — диагональные модули склеиваются
 * столбиком 0,02 мм, и сетка остаётся строго замкнутой. На печать это не влияет.
 */
const SEAM_MM = 0.01;

function uniformGrid(cells: number, cell: number, z0: number, top: Float64Array): QrHeightGrid {
  const xs = Array.from({ length: cells + 1 }, (_, i) => i * cell);
  const ys = Array.from({ length: cells + 1 }, (_, i) => (cells - i) * cell);
  return { cols: cells, rows: cells, xs, ys, z0, top };
}

/** Сетка со швами: чётные индексы — модули, нечётные — швы между ними. */
function seamGrid(cells: number, cell: number, z0: number, raised: Uint8Array, high: number, low: number): QrHeightGrid {
  const F = cells * 2 - 1;
  const xs: number[] = [0];
  for (let c = 0; c < cells - 1; c++) xs.push((c + 1) * cell - SEAM_MM, (c + 1) * cell + SEAM_MM);
  xs.push(cells * cell);
  const ys = xs.map((x) => cells * cell - x);
  const span = (f: number) => (f % 2 === 0 ? [f / 2] : [(f - 1) / 2, (f + 1) / 2]);
  const top = new Float64Array(F * F);
  for (let fr = 0; fr < F; fr++) {
    for (let fc = 0; fc < F; fc++) {
      let up = false;
      for (const r of span(fr)) for (const c of span(fc)) if (raised[r * cells + c]) up = true;
      top[fr * F + fc] = up ? high : low;
    }
  }
  return { cols: F, rows: F, xs, ys, z0, top };
}

export interface QrStlPart {
  /** `base` — подложка (первый цвет), `relief` — то, что печатается вторым цветом. */
  name: "base" | "relief";
  triangles: Float32Array;
}

export interface QrStlModel {
  /** Одно тело для печати со сменой филамента на высоте `colorChangeMm`. */
  single: Float32Array;
  /** Два тела для многоцветных принтеров (AMS / MMU). */
  parts: QrStlPart[];
  moduleMm: number;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  /** Высота, на которой менять филамент при печати одним телом. */
  colorChangeMm: number;
  /** Число модулей по стороне вместе с полем. */
  cells: number;
}

export function clampStlOptions(o: Partial<QrStlOptions>): QrStlOptions {
  const n = (v: unknown, d: number, lim: { min: number; max: number }) => {
    const x = typeof v === "number" && Number.isFinite(v) ? v : d;
    return Math.min(lim.max, Math.max(lim.min, x));
  };
  return {
    sizeMm: n(o.sizeMm, QR_STL_DEFAULTS.sizeMm, QR_STL_LIMITS.sizeMm),
    baseMm: n(o.baseMm, QR_STL_DEFAULTS.baseMm, QR_STL_LIMITS.baseMm),
    reliefMm: n(o.reliefMm, QR_STL_DEFAULTS.reliefMm, QR_STL_LIMITS.reliefMm),
    margin: Math.round(n(o.margin, QR_STL_DEFAULTS.margin, QR_STL_LIMITS.margin)),
    style: o.style === "engraved" ? "engraved" : "raised",
    keyring: !!o.keyring,
  };
}

const isDark = (m: QrModules, r: number, c: number) =>
  r >= 0 && c >= 0 && r < m.size && c < m.size && !!m.data[r * m.size + c];

/** Размер модуля для пластины — чтобы предупредить заранее, ещё до сборки модели. */
export function qrStlModuleMm(modules: QrModules, o: Pick<QrStlOptions, "sizeMm" | "margin">): number {
  return o.sizeMm / (modules.size + o.margin * 2);
}

/** Какие ячейки (с полем) печатаются вторым цветом — над подложкой. */
export function qrStlReliefCells(modules: QrModules, o: Pick<QrStlOptions, "margin" | "style">): { cells: number; raised: Uint8Array } {
  const cells = modules.size + o.margin * 2;
  const raised = new Uint8Array(cells * cells);
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const dark = isDark(modules, r - o.margin, c - o.margin);
      raised[r * cells + c] = (o.style === "raised" ? dark : !dark) ? 1 : 0;
    }
  }
  return { cells, raised };
}

export class TriSink {
  private buf: Float32Array;
  private n = 0;
  constructor(capacity = 4096) {
    this.buf = new Float32Array(capacity * 9);
  }
  tri(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number) {
    if ((this.n + 1) * 9 > this.buf.length) {
      const next = new Float32Array(this.buf.length * 2);
      next.set(this.buf);
      this.buf = next;
    }
    const o = this.n * 9;
    const b = this.buf;
    b[o] = ax; b[o + 1] = ay; b[o + 2] = az;
    b[o + 3] = bx; b[o + 4] = by; b[o + 5] = bz;
    b[o + 6] = cx; b[o + 7] = cy; b[o + 8] = cz;
    this.n++;
  }
  /** Четырёхугольник a-b-c-d против часовой стрелки, если смотреть снаружи. */
  quad(a: number[], b: number[], c: number[], d: number[]) {
    this.tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.tri(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
  }
  result(): Float32Array {
    return this.buf.slice(0, this.n * 9);
  }
}

/**
 * Замкнутая сетка по карте высот. Стенки режутся на всех уровнях высот, которые есть
 * в теле, — так вертикальные рёбра соседних стенок совпадают и T-стыков нет.
 */
export function heightGridMesh(g: QrHeightGrid, out = new TriSink(), offX = 0, offY = 0): TriSink {
  const { cols, rows, xs, ys, z0, top } = g;
  const levels = new Set<number>([z0]);
  for (const t of top) if (!Number.isNaN(t)) levels.add(t);
  const sortedLevels = [...levels].sort((a, b) => a - b);
  const at = (r: number, c: number) => (r < 0 || c < 0 || r >= rows || c >= cols ? NaN : top[r * cols + c]);
  const X = (c: number) => offX + xs[c];
  const Y = (r: number) => offY + ys[r];

  const wall = (p: [number, number], q: [number, number], lo: number, hi: number) => {
    // p → q — ребро по ходу против часовой, если смотреть сверху на ячейку; снаружи стенки — сосед.
    let z = lo;
    for (const level of sortedLevels) {
      if (level <= lo || level > hi) continue;
      out.quad([p[0], p[1], z], [q[0], q[1], z], [q[0], q[1], level], [p[0], p[1], level]);
      z = level;
    }
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = at(r, c);
      if (Number.isNaN(t)) continue;
      const x0 = X(c), x1 = X(c + 1), y1 = Y(r), y0 = Y(r + 1);
      out.quad([x0, y0, t], [x1, y0, t], [x1, y1, t], [x0, y1, t]);
      out.quad([x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0]);
      const sides: { n: number; p: [number, number]; q: [number, number] }[] = [
        { n: at(r, c + 1), p: [x1, y0], q: [x1, y1] }, // восток
        { n: at(r - 1, c), p: [x1, y1], q: [x0, y1] }, // север
        { n: at(r, c - 1), p: [x0, y1], q: [x0, y0] }, // запад
        { n: at(r + 1, c), p: [x0, y0], q: [x1, y0] }, // юг
      ];
      for (const s of sides) {
        const lo = Number.isNaN(s.n) ? z0 : s.n;
        if (lo < t) wall(s.p, s.q, lo, t);
      }
    }
  }
  return out;
}

/** Ушко брелока: кольцо, заходит на верхний край пластины. */
export const KEYRING_HOLE_MM = 2.5;
export const KEYRING_WALL_MM = 2.5;
const KEYRING_SEGMENTS = 40;

export function keyringGeometry(widthMm: number, depthMm: number) {
  const rIn = KEYRING_HOLE_MM;
  const rOut = rIn + KEYRING_WALL_MM;
  return { cx: widthMm / 2, cy: depthMm + rIn + 0.6, rIn, rOut };
}

function ringMesh(out: TriSink, cx: number, cy: number, rIn: number, rOut: number, z0: number, z1: number) {
  const N = KEYRING_SEGMENTS;
  const pt = (r: number, i: number, z: number) => {
    const a = (i / N) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z];
  };
  for (let i = 0; i < N; i++) {
    const j = i + 1;
    out.quad(pt(rOut, i, z1), pt(rOut, j, z1), pt(rIn, j, z1), pt(rIn, i, z1));
    out.quad(pt(rIn, i, z0), pt(rIn, j, z0), pt(rOut, j, z0), pt(rOut, i, z0));
    out.quad(pt(rOut, i, z0), pt(rOut, j, z0), pt(rOut, j, z1), pt(rOut, i, z1));
    out.quad(pt(rIn, j, z0), pt(rIn, i, z0), pt(rIn, i, z1), pt(rIn, j, z1));
  }
}

function concat(...arrays: Float32Array[]): Float32Array {
  const out = new Float32Array(arrays.reduce((s, a) => s + a.length, 0));
  let o = 0;
  for (const a of arrays) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

export function buildQrStlModel(modules: QrModules, options: Partial<QrStlOptions>): QrStlModel {
  const o = clampStlOptions(options);
  const { cells, raised } = qrStlReliefCells(modules, o);
  const cell = o.sizeMm / cells;
  const zTop = o.baseMm + o.reliefMm;

  // Одно тело: подложка и рельеф вместе.
  const single = heightGridMesh(seamGrid(cells, cell, 0, raised, zTop, o.baseMm));

  // Две детали: подложка — плоская пластина, рельеф — отдельное тело над ней.
  const base = heightGridMesh(uniformGrid(cells, cell, 0, new Float64Array(cells * cells).fill(o.baseMm)));
  const relief = heightGridMesh(seamGrid(cells, cell, o.baseMm, raised, zTop, NaN));

  let depthMm = o.sizeMm;
  if (o.keyring) {
    const k = keyringGeometry(o.sizeMm, o.sizeMm);
    ringMesh(single, k.cx, k.cy, k.rIn, k.rOut, 0, o.baseMm);
    ringMesh(base, k.cx, k.cy, k.rIn, k.rOut, 0, o.baseMm);
    depthMm = k.cy + k.rOut;
  }

  return {
    single: single.result(),
    parts: [
      { name: "base", triangles: base.result() },
      { name: "relief", triangles: relief.result() },
    ],
    moduleMm: cell,
    widthMm: o.sizeMm,
    depthMm,
    heightMm: zTop,
    colorChangeMm: o.baseMm,
    cells,
  };
}

/** Двоичный STL. Нормали считаются из порядка вершин (против часовой снаружи). */
export function encodeBinaryStl(triangles: Float32Array, header = "QrStars QR code"): Uint8Array {
  const count = triangles.length / 9;
  const bytes = new Uint8Array(84 + count * 50);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < Math.min(80, header.length); i++) bytes[i] = header.charCodeAt(i) & 0x7f;
  view.setUint32(80, count, true);
  let o = 84;
  for (let t = 0; t < count; t++) {
    const p = t * 9;
    const ux = triangles[p + 3] - triangles[p], uy = triangles[p + 4] - triangles[p + 1], uz = triangles[p + 5] - triangles[p + 2];
    const vx = triangles[p + 6] - triangles[p], vy = triangles[p + 7] - triangles[p + 1], vz = triangles[p + 8] - triangles[p + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    view.setFloat32(o, nx, true);
    view.setFloat32(o + 4, ny, true);
    view.setFloat32(o + 8, nz, true);
    for (let k = 0; k < 9; k++) view.setFloat32(o + 12 + k * 4, triangles[p + k], true);
    view.setUint16(o + 48, 0, true);
    o += 50;
  }
  return bytes;
}

/** Объём сетки (мм³) — для оценки расхода пластика. Положительный, если нормали наружу. */
export function meshVolume(triangles: Float32Array): number {
  let v = 0;
  for (let p = 0; p < triangles.length; p += 9) {
    const ax = triangles[p], ay = triangles[p + 1], az = triangles[p + 2];
    const bx = triangles[p + 3], by = triangles[p + 4], bz = triangles[p + 5];
    const cx = triangles[p + 6], cy = triangles[p + 7], cz = triangles[p + 8];
    v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return v / 6;
}

/** Примерный вес PLA (1,24 г/см³) при сплошном заполнении — верхняя оценка. */
export function estimatePlaGrams(triangles: Float32Array): number {
  return (meshVolume(triangles) / 1000) * 1.24;
}

// ---------- ZIP без сжатия (две детали одним файлом) ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** ZIP (метод store). Имена — ASCII. */
export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = (s: string) => Uint8Array.from(s, (ch) => ch.charCodeAt(0) & 0x7f);
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc(f.name);
    const crc = crc32(f.data);
    const h = new Uint8Array(30 + name.length);
    const hv = new DataView(h.buffer);
    hv.setUint32(0, 0x04034b50, true);
    hv.setUint16(4, 20, true);
    hv.setUint32(14, crc, true);
    hv.setUint32(18, f.data.length, true);
    hv.setUint32(22, f.data.length, true);
    hv.setUint16(26, name.length, true);
    h.set(name, 30);
    local.push(h, f.data);
    const c = new Uint8Array(46 + name.length);
    const cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, f.data.length, true);
    cv.setUint32(24, f.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    c.set(name, 46);
    central.push(c);
    offset += h.length + f.data.length;
  }
  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const all = [...local, ...central, end];
  const out = new Uint8Array(all.reduce((s, a) => s + a.length, 0));
  let o = 0;
  for (const a of all) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

export { concat as concatTriangles };
