/**
 * Premium A4 sheet renderer — единый источник правды для PDF-печати наборов
 * QR-стикеров (формат 8 × 8 см, 6 шт. на лист A4 + инструкция).
 *
 * Используется и админкой ([id]/print/page.tsx), и сэмпл-скриптом
 * (scripts/sample-premium-a4.mts). Лицевая часть стикера НЕ привязана к
 * заведению — на момент печати с фабрики QR-коды ещё не активированы.
 */
import type { jsPDF as JsPDF } from "jspdf";
import QRCode from "qrcode";

export interface PremiumA4Sticker {
  code: string;
  serialCode?: string | null;
  isActive?: boolean;
}

export interface PremiumA4Batch {
  masterCode: string;
  label?: string | null;
  qrcodes: PremiumA4Sticker[];
}

export interface PremiumA4TextOpts {
  size?: number;
  bold?: boolean;
  rgb?: [number, number, number];
  align?: "left" | "center" | "right";
  /**
   * Поворот в градусах CCW. Когда задан, (x, y) — центр вращения,
   * align применяется ДО поворота.
   */
  angle?: number;
  /** Доп. интерлиньяж символов в пунктах (только для повёрнутого/вертикального текста). */
  charSpacing?: number;
}

export interface PremiumA4Deps {
  doc: JsPDF;
  /** Print text (must support Cyrillic — browser uses canvas, Node uses TTF). */
  text: (s: string, x: number, y: number, opts?: PremiumA4TextOpts) => void;
  /**
   * Optional override for QR rendering. By default we draw a vector styled QR
   * (rounded data dots, rounded finder eyes, ★ in the center). Provide this
   * only if you need a raster QR for some reason — it'll be embedded as PNG.
   */
  qrPngDataUrl?: (url: string) => Promise<string>;
  baseUrl?: string;
  onProgress?: (percent: number) => void;
}

// ── Layout constants (mm) — 2 × 3 = 6 стикеров 8×8 см на лист A4 ────────────
const A4_W = 210;
const A4_H = 297;
const MARGIN_X = 13;
const MARGIN_TOP = 5;
const HEADER_H = 7;
const FOOTER_H = 4;
const INSTR_H = 17;
const SAFETY = 3;
const STICKER_MM = 80;
const TILE = STICKER_MM + SAFETY * 2;   // 86
const COLS = 2;
const ROWS = 3;
export const PREMIUM_PER_PAGE = COLS * ROWS;
const COL_GAP = 10;
const ROW_GAP = 3;

const GRID_W = COLS * TILE + (COLS - 1) * COL_GAP;
const GRID_X0 = (A4_W - GRID_W) / 2;
const GRID_Y0 = MARGIN_TOP + HEADER_H;

/* ─────────────────────────────────────────────
   Категории — все три на каждом стикере.
   QR ведёт на универсальный микролендинг, где
   у заведения есть и меню, и отзывы, и чаевые —
   поэтому делить стикеры по ролям не нужно.
───────────────────────────────────────────── */
interface CategoryStyle {
  label: string;
  ink: [number, number, number];
}

const CATEGORIES: CategoryStyle[] = [
  { label: "МЕНЮ",    ink: [75, 60, 228]  },
  { label: "Отзывы",  ink: [232, 154, 12] },
  { label: "ЧАЕВЫЕ",  ink: [22, 163, 106] },
];

const SAFETY_SOFT: [number, number, number] = [231, 228, 251]; // pastel indigo

/* ─────────────────────────────────────────────
   Vector logo — настоящая 5-конечная звезда + текст
───────────────────────────────────────────── */
function drawStar(
  doc: JsPDF,
  cx: number, cy: number, r: number,
  rgb: [number, number, number],
) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.42;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  // jsPDF lines(): relative deltas from a start point, closed-path fill
  const deltas: [number, number][] = [];
  for (let i = 1; i < pts.length; i++) {
    deltas.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
  }
  deltas.push([pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]]);
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).lines(deltas, pts[0][0], pts[0][1], [1, 1], "F", true);
}

/**
 * Рисует логотип QrStars: жирный wordmark + векторная звезда.
 * Центрируется по точке (cx, baselineY). `scale` — высота капитальной буквы (мм).
 */
function drawLogo(
  deps: PremiumA4Deps,
  cx: number,
  baselineY: number,
  scale: number,
  inkRgb: [number, number, number] = [26, 26, 26],
  starRgb: [number, number, number] = [232, 154, 12],
) {
  const { doc, text } = deps;
  // Approx whole-word width and star radius
  const wWord = scale * 3.65;     // empirical for "QrStars" at this font size
  const starR = scale * 0.62;
  const gap = scale * 0.05;       // tiny breath between word and star
  const totalW = wWord + gap + starR * 2;
  const x0 = cx - totalW / 2;

  // Single wordmark — рендерим одним словом, чтобы пробела не было
  text("QrStars", x0, baselineY,
    { size: scale * 2.6, bold: true, rgb: inkRgb });

  // Filled vector star — без обводки, чтобы не было белого кольца
  const starCx = x0 + wWord + gap + starR;
  const starCy = baselineY - scale * 0.7;
  drawStar(doc, starCx, starCy, starR, starRgb);
}

/* ─────────────────────────────────────────────
   Styled QR — векторный рендер: круглые точки
   модулей, скруглённые finder-«глаза», ★ в центре.
   ECC = "H" даёт ~30% redundancy, центральный
   логотип/звезда не ломает декодирование.
───────────────────────────────────────────── */
interface StyledQROpts {
  ink?: [number, number, number];
  bg?: [number, number, number] | null;       // null → прозрачный
  /** Цвет звезды в центре. null → не рисовать звезду. */
  centerStarRgb?: [number, number, number] | null;
}

function drawStyledQR(
  doc: JsPDF,
  url: string,
  x: number, y: number, sizeMm: number,
  opts: StyledQROpts = {},
) {
  const ink = opts.ink || [26, 26, 26];
  const bg = opts.bg === undefined ? ([255, 255, 255] as [number, number, number]) : opts.bg;
  const centerStarRgb = opts.centerStarRgb === undefined ? ([232, 154, 12] as [number, number, number]) : opts.centerStarRgb;

  // 1) Optional background
  if (bg) {
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.roundedRect(x, y, sizeMm, sizeMm, 1.5, 1.5, "F");
  }

  // 2) Build module matrix
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (QRCode as any).create(url, { errorCorrectionLevel: "H" });
  const N: number = m.modules.size;
  const data: Uint8Array = m.modules.data;
  const get = (cx: number, cy: number): number =>
    cx < 0 || cy < 0 || cx >= N || cy >= N ? 0 : data[cy * N + cx];

  const cell = sizeMm / N;
  doc.setFillColor(ink[0], ink[1], ink[2]);

  const inFinder = (cx: number, cy: number) => {
    // 7×7 finder squares at three corners + 1-cell separator
    if (cx <= 7 && cy <= 7) return true;
    if (cx >= N - 8 && cy <= 7) return true;
    if (cx <= 7 && cy >= N - 8) return true;
    return false;
  };

  // 3) Data dots — 4-point sparkle stars (same shape as StickerDesigner UI)
  // Outer radius чуть больше, чем у круглого варианта, чтобы сохранить
  // покрытие модуля и не терять контраст для сканера.
  const dotR = cell * 0.50;
  const midK = 0.72;                // chubby sparkle — high cell coverage, robust decode
  const sparkleDeltas = (() => {
    // 8 vertices of the 4-point sparkle, anchored at top point
    const out = dotR, mid = dotR * midK;
    const pts: [number, number][] = [
      [0, -out], [+mid, -mid], [+out, 0], [+mid, +mid],
      [0, +out], [-mid, +mid], [-out, 0], [-mid, -mid],
    ];
    const d: [number, number][] = [];
    for (let i = 1; i < pts.length; i++) d.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
    d.push([pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]]);
    return d;
  })();
  for (let cy = 0; cy < N; cy++) {
    for (let cx = 0; cx < N; cx++) {
      if (!get(cx, cy)) continue;
      if (inFinder(cx, cy)) continue;
      const px = x + cell * (cx + 0.5);
      const py = y + cell * (cy + 0.5);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc as any).lines(sparkleDeltas, px, py - dotR, [1, 1], "F", true);
    }
  }

  // 4) Three finder eyes — rounded rect ring + rounded inner dot
  const drawEye = (cx: number, cy: number) => {
    const ex = x + cx * cell;
    const ey = y + cy * cell;
    const s = 7 * cell;

    // Outer rounded square — заметные скругления
    doc.setFillColor(ink[0], ink[1], ink[2]);
    doc.roundedRect(ex, ey, s, s, cell * 2.4, cell * 2.4, "F");

    // Cut out the middle ring → background
    if (bg) doc.setFillColor(bg[0], bg[1], bg[2]);
    else doc.setFillColor(255, 255, 255);
    doc.roundedRect(ex + cell, ey + cell, s - 2 * cell, s - 2 * cell,
                    cell * 1.8, cell * 1.8, "F");

    // Inner dark dot — почти круглый
    doc.setFillColor(ink[0], ink[1], ink[2]);
    doc.roundedRect(ex + 2 * cell, ey + 2 * cell, 3 * cell, 3 * cell,
                    cell * 1.5, cell * 1.5, "F");
  };
  drawEye(0, 0);
  drawEye(N - 7, 0);
  drawEye(0, N - 7);

  // 5) Center star — small overlay, with белый ореол (для контраста к фону)
  // Halo держим компактным (~4 cells across), чтобы не съесть лишние модули.
  if (centerStarRgb) {
    const haloR = cell * 2.2;
    const cxMm = x + sizeMm / 2;
    const cyMm = y + sizeMm / 2;
    if (bg) doc.setFillColor(bg[0], bg[1], bg[2]);
    else doc.setFillColor(255, 255, 255);
    doc.circle(cxMm, cyMm, haloR, "F");
    drawStar(doc, cxMm, cyMm, cell * 1.8, centerStarRgb);
  }
}

/* ─────────────────────────────────────────────
   Sticker face — универсальный для микролендинга.
   Все три категории присутствуют на каждом стикере:
   гость сканирует один QR и попадает на страницу
   с меню, отзывами и чаевыми одновременно.
───────────────────────────────────────────── */
async function drawStickerFace(
  deps: PremiumA4Deps,
  qr: PremiumA4Sticker,
  x: number,
  y: number,
  baseUrl: string,
) {
  const { doc, text } = deps;
  const S = STICKER_MM;

  // ── Dark matte face — премиальный «дорогой» вид
  const FACE: [number, number, number] = [18, 18, 22];           // глубокий чёрный с лёгким сине-серым тоном
  const INK_LIGHT: [number, number, number] = [245, 240, 230];   // тёплый кремовый для основных текстов
  const INK_DIM: [number, number, number] = [170, 170, 175];     // приглушённый для подписей
  const GOLD: [number, number, number] = [232, 154, 12];

  doc.setFillColor(FACE[0], FACE[1], FACE[2]);
  doc.setDrawColor(40, 40, 45);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, S, S, 2.5, 2.5, "FD");

  // ── Brand wordmark — верхний левый угол, светлый, компактнее
  drawLogo(deps, x + 7, y + 5, 1.4, INK_LIGHT, GOLD);

  // ── QR — крупный, центрирован ПО ОБЕИМ ОСЯМ стикера
  const qrSize = 52;
  const qrX = x + (S - qrSize) / 2;
  const qrY = y + (S - qrSize) / 2;  // = y + 14
  const cardPad = 2;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qrX - cardPad, qrY - cardPad,
                  qrSize + 2 * cardPad, qrSize + 2 * cardPad,
                  2, 2, "F");

  // Optional caller-supplied raster QR (back-compat); else draw vector
  if (deps.qrPngDataUrl) {
    const png = await deps.qrPngDataUrl(`${baseUrl}/q/${qr.code}`);
    doc.addImage(png, "PNG", qrX, qrY, qrSize, qrSize);
  } else {
    drawStyledQR(doc, `${baseUrl}/q/${qr.code}`, qrX, qrY, qrSize, {
      ink: [26, 26, 26],
      bg: [255, 255, 255],
      centerStarRgb: GOLD,
    });
  }

  // ── Surround labels — большой белый шрифт без фона, премиум-look
  const labelPt = 14;
  const labelOpts: PremiumA4TextOpts = {
    size: labelPt, bold: true, rgb: INK_LIGHT, align: "center",
  };
  // TOP — горизонтальный. «ОСТАВИТЬ ОТЗЫВ» длиннее, чем боковые ярлыки,
  // поэтому здесь шрифт чуть меньше и центрируется по горизонтали QR.
  text("ОСТАВИТЬ ОТЗЫВ", qrX + qrSize / 2, qrY - 4.5,
    { ...labelOpts, size: 12.5 });
  // jsPDF rotation+align=center has TWO asymmetries:
  //   1) Текст смещается влево от якоря (~6мм) — компенсируем сдвигом X.
  //   2) Вертикально центрируется не визуальный центр текста, а его
  //      базовая линия → для angle=+90 текст висит над якорем, для
  //      angle=-90 — под якорем. Компенсируем сдвигом Y на полувысоту.
  // Полу-высота вертикального текста (pre-rotation width / 2) — откалибровано
  // эмпирически для bold Cyrillic 14pt: ~3.4 мм на символ → 1.7 на полусимвол.
  const halfH = (label: string) => label.length * 1.7;
  // LEFT — вертикальный, читается снизу-вверх (М внизу): angle=+90
  // Якорь чуть НИЖЕ центра QR → текст поднимется на свою полувысоту, попадёт по центру.
  text("МЕНЮ", qrX + 3, qrY + qrSize / 2 + halfH("МЕНЮ"),
    { ...labelOpts, angle: 90 });
  // RIGHT — вертикальный, читается сверху-вниз (Ч сверху): angle=-90
  // Якорь чуть ВЫШЕ центра QR → текст опустится на свою полувысоту, попадёт по центру.
  text("ЧАЕВЫЕ", qrX + qrSize + cardPad + 13, qrY + qrSize / 2 - halfH("ЧАЕВЫЕ"),
    { ...labelOpts, angle: -90 });

  // ── CTA — теперь по центру свободной нижней полосы (QR centered → ~14мм снизу)
  text("Наведите камеру на QR-код", x + S / 2, y + S - 5,
    { size: 7, bold: true, rgb: INK_LIGHT, align: "center" });

  // ── Serial in the lower-right corner (kept INSIDE the cut)
  if (qr.serialCode) {
    text(qr.serialCode, x + S - 3, y + S - 1,
      { size: 4.5, rgb: INK_DIM, align: "right" });
  }
}

/* ─────────────────────────────────────────────
   Tile (safety + cut + face + registration)
───────────────────────────────────────────── */
async function drawTile(
  deps: PremiumA4Deps,
  qr: PremiumA4Sticker,
  idx: number,
  baseUrl: string,
) {
  const { doc, text } = deps;
  const col = idx % COLS;
  const row = Math.floor(idx / COLS);
  const tileX = GRID_X0 + col * (TILE + COL_GAP);
  const tileY = GRID_Y0 + row * (TILE + ROW_GAP);

  // Safety frame — единый нейтральный пастельный фон
  doc.setFillColor(SAFETY_SOFT[0], SAFETY_SOFT[1], SAFETY_SOFT[2]);
  doc.setDrawColor(SAFETY_SOFT[0], SAFETY_SOFT[1], SAFETY_SOFT[2]);
  doc.roundedRect(tileX, tileY, TILE, TILE, 4.5, 4.5, "F");

  // Cut line убран — для виниловой печати контур задаётся отдельным
  // cut-path в раскройной программе, на самой плёнке его рисовать не нужно.
  // Soft pastel safety frame служит визуальной подсказкой границы.

  await drawStickerFace(deps, qr, tileX + SAFETY, tileY + SAFETY, baseUrl);
}

/* ─────────────────────────────────────────────
   Header & instruction
───────────────────────────────────────────── */
function drawHeader(deps: PremiumA4Deps, batch: PremiumA4Batch, dateStr: string) {
  const { doc, text } = deps;

  // Vector logo on the left
  drawLogo(deps, MARGIN_X + 13, MARGIN_TOP + 5, 3.2);

  // Meta line beside the logo
  text(`стикеры A4 · 8 × 8 см · ${PREMIUM_PER_PAGE} шт.`,
    MARGIN_X + 30, MARGIN_TOP + 4.5,
    { size: 7, rgb: [120, 120, 120] });

  // Inline category legend — что лежит на микролендинге
  const legendY = MARGIN_TOP + 4.5;
  let cx = A4_W / 2 - 16;
  for (const cat of CATEGORIES) {
    doc.setFillColor(cat.ink[0], cat.ink[1], cat.ink[2]);
    doc.circle(cx, legendY - 1, 0.9, "F");
    text(cat.label, cx + 1.8, legendY, { size: 6.5, rgb: [80, 80, 80] });
    cx += 17;
  }

  text(
    `${batch.masterCode}${batch.label ? " · " + batch.label : ""} · ${dateStr}`,
    A4_W - MARGIN_X, MARGIN_TOP + 4.5,
    { size: 7, rgb: [110, 110, 110], align: "right" },
  );

  doc.setDrawColor(200, 197, 185);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.setLineWidth(0.25);
  doc.line(MARGIN_X, MARGIN_TOP + HEADER_H - 0.5,
           A4_W - MARGIN_X, MARGIN_TOP + HEADER_H - 0.5);
  doc.setLineDashPattern([], 0);
}

function drawInstruction(deps: PremiumA4Deps, batch: PremiumA4Batch) {
  const { doc, text } = deps;
  const instrY = A4_H - FOOTER_H - INSTR_H;

  doc.setDrawColor(200, 197, 185);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.setLineWidth(0.25);
  doc.line(MARGIN_X, instrY, A4_W - MARGIN_X, instrY);
  doc.setLineDashPattern([], 0);

  // Right activation box
  const boxW = 70;
  const boxX = A4_W - MARGIN_X - boxW;
  const boxY = instrY + 2;
  const boxH = INSTR_H - 4;
  doc.setFillColor(255, 248, 220);
  doc.setDrawColor(232, 154, 12);
  doc.setLineWidth(0.4);
  doc.roundedRect(boxX, boxY, boxW, boxH, 1.8, 1.8, "FD");

  text("АКТИВАЦИЯ НАБОРА", boxX + 3, boxY + 4,
    { size: 6.5, bold: true, rgb: [110, 70, 0] });
  text("app.qrstars.ru → «Активация» → код:",
    boxX + 3, boxY + 8,
    { size: 6.5, rgb: [110, 70, 0] });
  text(batch.masterCode, boxX + 3, boxY + 12.2,
    { size: 9.5, bold: true, rgb: [26, 26, 26] });

  // Left steps
  const leftX = MARGIN_X;
  text("КАК ИСПОЛЬЗОВАТЬ", leftX, instrY + 4,
    { size: 6.5, bold: true, rgb: [110, 110, 110] });
  text("1. Активируйте набор по коду справа — привяжете все стикеры к заведению.",
    leftX, instrY + 9, { size: 7.5, rgb: [60, 60, 60] });
  text("2. Наклейте на стол / меню / кассу. Гость наводит камеру → ваша страница.",
    leftX, instrY + 14, { size: 7.5, rgb: [60, 60, 60] });

  text("QRSTARS.RU · STICKER SHEET A4 · 8 × 8 см",
    A4_W / 2, A4_H - 1.5,
    { size: 5.5, rgb: [150, 150, 150], align: "center" });
}


/* ─────────────────────────────────────────────
   Public entry point
───────────────────────────────────────────── */
export async function renderPremiumA4Sheet(
  batch: PremiumA4Batch,
  deps: PremiumA4Deps,
) {
  const baseUrl = deps.baseUrl || "https://app.qrstars.ru";
  const dateStr = new Date().toLocaleDateString("ru-RU");
  const total = batch.qrcodes.length;
  let isFirstPage = true;

  for (let p = 0; p < total; p += PREMIUM_PER_PAGE) {
    if (!isFirstPage) deps.doc.addPage();
    isFirstPage = false;
    drawHeader(deps, batch, dateStr);
    const slice = batch.qrcodes.slice(p, p + PREMIUM_PER_PAGE);
    for (let i = 0; i < slice.length; i++) {
      await drawTile(deps, slice[i], i, baseUrl);
      deps.onProgress?.(Math.round(((p + i + 1) / total) * 100));
    }
    drawInstruction(deps, batch);
  }
}
