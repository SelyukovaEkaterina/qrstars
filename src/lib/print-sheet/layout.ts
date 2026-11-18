/**
 * Генератор листов для печати QR: форматы, раскладка на листе, тексты по режиму QR.
 * Чистая логика без DOM — покрыта юнит-тестами (`layout.test.ts`).
 *
 * Всё в миллиметрах. Id форматов, дизайнов и пресетов хранятся в localStorage —
 * не переименовывать, новые добавлять в конец.
 */

export type PrintProductKind = "sign" | "tent" | "stickers";

export interface PrintFormat {
  id: string;
  kind: PrintProductKind;
  label: string;
  hint: string;
  /** Размер одной таблички / панели тента / стикера в книжной ориентации, мм. */
  wMm: number;
  hMm: number;
}

export const PRINT_FORMATS: PrintFormat[] = [
  { id: "a6", kind: "sign", label: "A6", hint: "105 × 148 мм · на стол, ресепшен", wMm: 105, hMm: 148 },
  { id: "a5", kind: "sign", label: "A5", hint: "148 × 210 мм · стойка, витрина", wMm: 148, hMm: 210 },
  { id: "a4", kind: "sign", label: "A4", hint: "210 × 297 мм · стена, дверь", wMm: 210, hMm: 297 },
  { id: "a3", kind: "sign", label: "A3", hint: "297 × 420 мм · плакат", wMm: 297, hMm: 420 },
  { id: "tent-a5", kind: "tent", label: "Домик A5", hint: "лист A4 складывается пополам", wMm: 210, hMm: 148.5 },
  { id: "tent-a6", kind: "tent", label: "Домик A6", hint: "2 домика с листа A4", wMm: 148.5, hMm: 105 },
  { id: "sticker-50", kind: "stickers", label: "Стикер 5 см", hint: "на стол, кассу, щиток, оборудование", wMm: 50, hMm: 50 },
  { id: "sticker-60", kind: "stickers", label: "Стикер 6 см", hint: "на стол, дверь, витрину", wMm: 60, hMm: 60 },
  { id: "sticker-90", kind: "stickers", label: "Стикер 9 см", hint: "на витрину, стену", wMm: 90, hMm: 90 },
];

export function findPrintFormat(id: string | null | undefined): PrintFormat {
  return PRINT_FORMATS.find((f) => f.id === id) ?? PRINT_FORMATS[0];
}

export type Orientation = "portrait" | "landscape";

/** sheet — на листе A4/A3 для принтера; exact — точный формат с вылетами для типографии. */
export type PrintOutput = "sheet" | "exact";

export const A4 = { wMm: 210, hMm: 297 };
export const A3 = { wMm: 297, hMm: 420 };
/** Вылеты под обрез для типографии. */
export const BLEED_MM = 2;
const STICKER_GAP_MM = 4;
/** Поле листа: домашние принтеры не печатают ближе 4–5 мм к краю. */
const STICKER_MARGIN_MM = 8;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlacedItem extends Rect {
  /** Повернуть содержимое на 180° (верхняя панель домика). */
  rotate180?: boolean;
}

export interface SheetLayout {
  pageWMm: number;
  pageHMm: number;
  bleedMm: number;
  items: PlacedItem[];
  /** Линии реза — пунктир, мм от левого верхнего угла: [x1, y1, x2, y2]. */
  cutLines: [number, number, number, number][];
  /** Линии сгиба (домик). */
  foldLines: [number, number, number, number][];
  /** Контуры стикеров для вырезания. */
  cutOutlines: Rect[];
  /** Подсказка под превью. */
  note: string;
}

/** Размер одной таблички с учётом ориентации (для домика и стикеров ориентация фиксирована). */
export function itemSize(format: PrintFormat, orientation: Orientation): { wMm: number; hMm: number } {
  if (format.kind !== "sign" || orientation === "portrait") return { wMm: format.wMm, hMm: format.hMm };
  return { wMm: format.hMm, hMm: format.wMm };
}

/** Можно ли выбирать ориентацию. */
export function supportsOrientation(format: PrintFormat): boolean {
  return format.kind === "sign";
}

/** Режим «для типографии» имеет смысл только для одиночной таблички. */
export function supportsExactOutput(format: PrintFormat): boolean {
  return format.kind === "sign";
}

function stickerGrid(sizeMm: number): { cols: number; rows: number } {
  const span = (total: number) =>
    Math.max(1, Math.floor((total - 2 * STICKER_MARGIN_MM + STICKER_GAP_MM) / (sizeMm + STICKER_GAP_MM)));
  return { cols: span(A4.wMm), rows: span(A4.hMm) };
}

export function sheetCopies(format: PrintFormat, orientation: Orientation, output: PrintOutput): number {
  return buildSheetLayout(format, orientation, output).items.length;
}

export function buildSheetLayout(
  format: PrintFormat,
  orientation: Orientation,
  output: PrintOutput,
): SheetLayout {
  const empty = { cutLines: [], foldLines: [], cutOutlines: [] } as Pick<
    SheetLayout,
    "cutLines" | "foldLines" | "cutOutlines"
  >;

  if (format.kind === "sign") {
    const { wMm, hMm } = itemSize(format, orientation);
    if (output === "exact" && supportsExactOutput(format)) {
      return {
        ...empty,
        pageWMm: wMm + 2 * BLEED_MM,
        pageHMm: hMm + 2 * BLEED_MM,
        bleedMm: BLEED_MM,
        items: [{ x: BLEED_MM, y: BLEED_MM, w: wMm, h: hMm }],
        note: `Для типографии: ${fmtMm(wMm)} × ${fmtMm(hMm)} мм + вылеты ${BLEED_MM} мм`,
      };
    }
    if (format.id === "a3") {
      const page = orientation === "portrait" ? A3 : { wMm: A3.hMm, hMm: A3.wMm };
      return {
        ...empty,
        pageWMm: page.wMm,
        pageHMm: page.hMm,
        bleedMm: 0,
        items: [{ x: 0, y: 0, w: page.wMm, h: page.hMm }],
        note: "Лист A3 — печать на широкоформатном принтере или в копицентре",
      };
    }
    if (format.id === "a4") {
      const page = orientation === "portrait" ? A4 : { wMm: A4.hMm, hMm: A4.wMm };
      return {
        ...empty,
        pageWMm: page.wMm,
        pageHMm: page.hMm,
        bleedMm: 0,
        items: [{ x: 0, y: 0, w: page.wMm, h: page.hMm }],
        note: "Лист A4 — обычный принтер",
      };
    }
    if (format.id === "a5") {
      // Две таблички A5 на A4: книжные A5 — на альбомном A4, альбомные — на книжном.
      const pagePortrait = orientation === "landscape";
      const page = pagePortrait ? A4 : { wMm: A4.hMm, hMm: A4.wMm };
      const items: PlacedItem[] = pagePortrait
        ? [
            { x: 0, y: 0, w: page.wMm, h: page.hMm / 2 },
            { x: 0, y: page.hMm / 2, w: page.wMm, h: page.hMm / 2 },
          ]
        : [
            { x: 0, y: 0, w: page.wMm / 2, h: page.hMm },
            { x: page.wMm / 2, y: 0, w: page.wMm / 2, h: page.hMm },
          ];
      const cut: [number, number, number, number] = pagePortrait
        ? [0, page.hMm / 2, page.wMm, page.hMm / 2]
        : [page.wMm / 2, 0, page.wMm / 2, page.hMm];
      return {
        ...empty,
        pageWMm: page.wMm,
        pageHMm: page.hMm,
        bleedMm: 0,
        items,
        cutLines: [cut],
        note: "2 таблички A5 на листе A4 — разрежьте по пунктиру",
      };
    }
    // A6: четыре на A4 (2×2) в обеих ориентациях.
    const page = orientation === "portrait" ? A4 : { wMm: A4.hMm, hMm: A4.wMm };
    const cw = page.wMm / 2;
    const ch = page.hMm / 2;
    return {
      ...empty,
      pageWMm: page.wMm,
      pageHMm: page.hMm,
      bleedMm: 0,
      items: [
        { x: 0, y: 0, w: cw, h: ch },
        { x: cw, y: 0, w: cw, h: ch },
        { x: 0, y: ch, w: cw, h: ch },
        { x: cw, y: ch, w: cw, h: ch },
      ],
      cutLines: [
        [cw, 0, cw, page.hMm],
        [0, ch, page.wMm, ch],
      ],
      note: "4 таблички A6 на листе A4 — разрежьте по пунктиру",
    };
  }

  if (format.kind === "tent") {
    if (format.id === "tent-a5") {
      // A4 книжный, сгиб посередине: верхняя панель вверх ногами.
      const h = A4.hMm / 2;
      return {
        ...empty,
        pageWMm: A4.wMm,
        pageHMm: A4.hMm,
        bleedMm: 0,
        items: [
          { x: 0, y: 0, w: A4.wMm, h, rotate180: true },
          { x: 0, y: h, w: A4.wMm, h },
        ],
        foldLines: [[0, h, A4.wMm, h]],
        note: "Сложите лист пополам по линии — получится домик A5 с надписью с двух сторон",
      };
    }
    // Два домика A6 на альбомном A4: разрез по вертикали, сгиб по горизонтали.
    const page = { wMm: A4.hMm, hMm: A4.wMm };
    const cw = page.wMm / 2;
    const ch = page.hMm / 2;
    return {
      ...empty,
      pageWMm: page.wMm,
      pageHMm: page.hMm,
      bleedMm: 0,
      items: [
        { x: 0, y: 0, w: cw, h: ch, rotate180: true },
        { x: cw, y: 0, w: cw, h: ch, rotate180: true },
        { x: 0, y: ch, w: cw, h: ch },
        { x: cw, y: ch, w: cw, h: ch },
      ],
      cutLines: [[cw, 0, cw, page.hMm]],
      foldLines: [[0, ch, page.wMm, ch]],
      note: "Разрежьте лист по пунктиру и сложите каждую половину по линии сгиба",
    };
  }

  // Стикеры: сетка с промежутками на A4.
  const size = format.wMm;
  const { cols, rows } = stickerGrid(size);
  const gridW = cols * size + (cols - 1) * STICKER_GAP_MM;
  const gridH = rows * size + (rows - 1) * STICKER_GAP_MM;
  const x0 = (A4.wMm - gridW) / 2;
  const y0 = (A4.hMm - gridH) / 2;
  const items: PlacedItem[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      items.push({
        x: x0 + c * (size + STICKER_GAP_MM),
        y: y0 + r * (size + STICKER_GAP_MM),
        w: size,
        h: size,
      });
    }
  }
  return {
    ...empty,
    pageWMm: A4.wMm,
    pageHMm: A4.hMm,
    bleedMm: 0,
    items,
    cutOutlines: items.map(({ x, y, w, h }) => ({ x, y, w, h })),
    note: `${items.length} стикеров на листе A4 — печать на самоклеящейся бумаге`,
  };
}

function fmtMm(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

/**
 * Разрешение растра: 300 dpi, но canvas не больше ~15 Мпикс
 * (iOS Safari не рисует canvas больше 16,7 Мпикс).
 */
export function exportDpi(pageWMm: number, pageHMm: number, maxPixels = 15_000_000): number {
  const wIn = pageWMm / 25.4;
  const hIn = pageHMm / 25.4;
  return Math.min(300, Math.floor(Math.sqrt(maxPixels / (wIn * hIn))));
}

// ───────────────────────── дизайн и тексты ─────────────────────────

export type PrintDesignId = "classic" | "bold" | "soft" | "dark" | "frame";

export const PRINT_DESIGNS: { id: PrintDesignId; label: string }[] = [
  { id: "classic", label: "Классика" },
  { id: "bold", label: "Яркий" },
  { id: "soft", label: "Нежный" },
  { id: "dark", label: "Тёмный" },
  { id: "frame", label: "Рамка" },
];

export const PRINT_ACCENTS = [
  "#4F46E5",
  "#111827",
  "#1E3A8A",
  "#0F766E",
  "#047857",
  "#DC2626",
  "#EA580C",
  "#B45309",
  "#DB2777",
  "#7C3AED",
];

/** Режим QR, под который подбираются тексты. */
export type PrintScenario =
  | "REVIEW"
  | "MENU"
  | "WIFI"
  | "BUSINESS_CARD"
  | "LANDING"
  | "FILE"
  | "TIPS"
  | "FORM"
  | "LINK";

export function scenarioForMode(mode: string | null | undefined): PrintScenario {
  switch (mode) {
    case "REVIEW":
    case "MENU":
    case "WIFI":
    case "BUSINESS_CARD":
    case "LANDING":
    case "FILE":
    case "TIPS":
    case "FORM":
      return mode;
    default:
      return "LINK";
  }
}

export interface PrintTexts {
  title: string;
  subtitle: string;
  footer: string;
}

/** Готовые варианты текста: первый — по умолчанию. */
export const PRINT_TEXT_PRESETS: Record<PrintScenario, PrintTexts[]> = {
  REVIEW: [
    { title: "Оцените нас", subtitle: "Нам важно ваше мнение — это займёт 10 секунд", footer: "Спасибо, что вы с нами!" },
    { title: "Понравилось?", subtitle: "Поставьте оценку — мы читаем каждый отзыв", footer: "Спасибо!" },
    { title: "Как вам у нас?", subtitle: "Расскажите, что понравилось и что улучшить", footer: "Хорошего дня!" },
    { title: "ОТЗЫВЫ", subtitle: "Поделитесь впечатлениями — это займёт минуту", footer: "" },
  ],
  MENU: [
    { title: "Меню", subtitle: "Блюда и цены — в вашем телефоне", footer: "Приятного аппетита!" },
    { title: "Меню и цены", subtitle: "Блюда, напитки и цены — в телефоне", footer: "" },
    { title: "Наше меню", subtitle: "Откройте меню и выберите блюда", footer: "Приятного аппетита!" },
  ],
  WIFI: [
    { title: "Бесплатный Wi-Fi", subtitle: "Телефон подключится сам — без ввода пароля", footer: "" },
    { title: "Wi-Fi", subtitle: "Подключение в одно касание", footer: "" },
  ],
  BUSINESS_CARD: [
    { title: "Мои контакты", subtitle: "Сохраните номер в один клик", footer: "" },
    { title: "Будем на связи", subtitle: "Телефон, мессенджеры и услуги — в одном QR", footer: "" },
    { title: "Вызвать мастера", subtitle: "Отсканируйте и оставьте заявку", footer: "" },
  ],
  LANDING: [
    { title: "Всё о нас", subtitle: "Меню, контакты, отзывы и Wi-Fi — в одном QR", footer: "" },
    { title: "Добро пожаловать!", subtitle: "Отсканируйте, чтобы узнать больше", footer: "" },
  ],
  FILE: [
    { title: "Скачайте файл", subtitle: "Откроется прямо в телефоне", footer: "" },
    { title: "Прайс-лист", subtitle: "Актуальные цены — по QR-коду", footer: "" },
  ],
  TIPS: [
    { title: "Чаевые", subtitle: "Спасибо, что цените нашу работу", footer: "" },
    { title: "Поблагодарить", subtitle: "Оставьте чаевые по QR-коду", footer: "Спасибо!" },
  ],
  FORM: [
    { title: "Расскажите о нас", subtitle: "Короткая анкета — займёт минуту", footer: "Спасибо!" },
    { title: "Участвуйте в розыгрыше", subtitle: "Заполните форму — и вы в списке участников", footer: "" },
    { title: "Регистрация", subtitle: "Запишитесь на мероприятие по QR-коду", footer: "" },
    { title: "Запись онлайн", subtitle: "Оставьте заявку — мы перезвоним", footer: "" },
  ],
  LINK: [
    { title: "Отсканируйте", subtitle: "Ссылка откроется за секунду", footer: "" },
    { title: "Подпишитесь на нас", subtitle: "Новости и акции — в нашем канале", footer: "" },
    { title: "Запись онлайн", subtitle: "Выберите удобное время", footer: "" },
  ],
};

export interface PrintSettings {
  formatId: string;
  orientation: Orientation;
  output: PrintOutput;
  design: PrintDesignId;
  accent: string;
  title: string;
  subtitle: string;
  footer: string;
  showLogo: boolean;
  showName: boolean;
  showStars: boolean;
  showHint: boolean;
  showLink: boolean;
  showWifi: boolean;
  /** PRO: убрать подпись QrStars. */
  hideBranding: boolean;
}

export function defaultPrintSettings(
  scenario: PrintScenario,
  accent: string | null | undefined,
): PrintSettings {
  const texts = PRINT_TEXT_PRESETS[scenario][0];
  return {
    // Визитку мастера клеят на щиток или оборудование — стикер, остальное — табличка на стол.
    formatId: scenario === "BUSINESS_CARD" ? "sticker-60" : "a6",
    orientation: "portrait",
    output: "sheet",
    design: "classic",
    accent: normalizeHex(accent) ?? PRINT_ACCENTS[0],
    ...texts,
    showLogo: true,
    showName: true,
    showStars: scenario === "REVIEW",
    showHint: true,
    showLink: false,
    showWifi: scenario === "WIFI",
    hideBranding: true,
  };
}

export function normalizeHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    return ("#" + v.slice(1).split("").map((c) => c + c).join("")).toUpperCase();
  }
  return null;
}

/** Мягко чинит настройки из localStorage: неизвестные значения → дефолт. */
export function sanitizePrintSettings(raw: unknown, fallback: PrintSettings): PrintSettings {
  if (!raw || typeof raw !== "object") return fallback;
  const r = raw as Record<string, unknown>;
  const str = (k: keyof PrintSettings, max: number) =>
    typeof r[k] === "string" ? (r[k] as string).slice(0, max) : (fallback[k] as string);
  const bool = (k: keyof PrintSettings) => (typeof r[k] === "boolean" ? (r[k] as boolean) : (fallback[k] as boolean));
  return {
    formatId: PRINT_FORMATS.some((f) => f.id === r.formatId) ? (r.formatId as string) : fallback.formatId,
    orientation: r.orientation === "landscape" ? "landscape" : "portrait",
    output: r.output === "exact" ? "exact" : "sheet",
    design: PRINT_DESIGNS.some((d) => d.id === r.design) ? (r.design as PrintDesignId) : fallback.design,
    accent: normalizeHex(r.accent as string) ?? fallback.accent,
    title: str("title", 80),
    subtitle: str("subtitle", 160),
    footer: str("footer", 80),
    showLogo: bool("showLogo"),
    showName: bool("showName"),
    showStars: bool("showStars"),
    showHint: bool("showHint"),
    showLink: bool("showLink"),
    showWifi: bool("showWifi"),
    hideBranding: bool("hideBranding"),
  };
}
