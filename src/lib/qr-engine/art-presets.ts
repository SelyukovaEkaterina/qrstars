/**
 * Арт-стили в один клик — общий список для генератора на лендинге и «Готовых стилей» кабинета.
 * Стиль меняет только оформление, данные кода не трогает. `id` хранятся в QR как
 * `qr-preset-{id}`: существующие не переименовывать и не менять их вид, новые — в конец.
 */
import type { QrDesign } from "./types";

export type ArtPresetCategory = "art" | "masters" | "medical" | "auto" | "beauty" | "food";

export const ART_PRESET_CATEGORIES: { id: ArtPresetCategory; label: string }[] = [
  { id: "art", label: "Арт" },
  { id: "masters", label: "Мастера" },
  { id: "medical", label: "Медицина" },
  { id: "auto", label: "Авто" },
  { id: "beauty", label: "Красота и спорт" },
  { id: "food", label: "Еда и магазины" },
];

export interface ArtPreset {
  id: string;
  name: string;
  category: ArtPresetCategory;
  description: string;
  /** Эмодзи логотипа, `"qrstars"` — логотип QrStars, нет поля — без логотипа. */
  logo?: string;
  /** Фото для гравюры (путь в `public/`). */
  photo?: string;
  design: Partial<QrDesign>;
}

/** Общая основа: всё, чего нет в `design`, берётся отсюда. */
export const ART_PRESET_BASE: Partial<QrDesign> = {
  dotStyle: "classic",
  eyeStyle: "square",
  fg: "#1e293b",
  bg: "#ffffff",
  gradient: false,
  gradType: "linear-tb",
  ecc: "H",
  margin: 2,
};

/** Фигура с кодом: поле в модуль, код на весь вписанный квадрат. */
const shape = (silhouette: QrDesign["silhouette"]): Partial<QrDesign> => ({ silhouette, silhouetteFit: 100, margin: 1 });

export const ART_PRESETS: ArtPreset[] = [
  // ── Арт ── (первые пять уже привязаны к QR в кабинете — вид не менять)
  {
    id: "art-heart",
    name: "Сердце",
    category: "art",
    description: "Код внутри сердца — для цветов, кондитерских и праздников",
    logo: "❤️",
    design: { ...shape("heart"), fg: "#e11d48", grad1: "#e11d48", grad2: "#be123c", logoSize: 18, logoFill: false },
  },
  {
    id: "art-tooth",
    name: "Зуб",
    category: "medical",
    description: "Бирюзовый код в форме зуба — для стоматологий",
    design: { ...shape("tooth"), fg: "#0e8fa3", grad1: "#06b6d4", grad2: "#0e7490" },
  },
  {
    id: "art-diamond",
    name: "Ромб",
    category: "art",
    description: "Повёрнутый код с «кляксой» вокруг логотипа",
    logo: "qrstars",
    design: { dotStyle: "splash", fg: "#111827", grad1: "#111827", grad2: "#374151", logoSize: 20, logoFill: false, rotate45: true },
  },
  {
    id: "art-print",
    name: "Печать CMYK",
    category: "art",
    description: "Растровые точки с градиентом и сдвигом красок, как в журнале",
    design: { dotStyle: "halftone", eyeStyle: "rounded", fg: "#1d1bbf", gradient: true, grad1: "#1d1bbf", grad2: "#e3166f", ecc: "Q", inkShift: true },
  },
  {
    id: "art-liquid",
    name: "Жидкий",
    category: "art",
    description: "Перетекающие модули — мягкий современный вид",
    design: { dotStyle: "liquid", eyeStyle: "rounded", fg: "#4f46e5", gradient: true, grad1: "#4f46e5", grad2: "#9333ea", gradType: "linear-diag" },
  },
  {
    id: "art-cat",
    name: "Кот",
    category: "art",
    description: "Жидкие модули в форме кошачьей головы",
    design: { ...shape("cat"), dotStyle: "liquid", eyeStyle: "rounded" },
  },
  {
    id: "art-engraving",
    name: "Гравюра",
    category: "art",
    description: "Фото точечной гравюрой, модули — точками в клетках. Загрузите своё фото",
    photo: "/photo-presets/marble.jpg",
    design: { fg: "#111827", photoStyle: "halftone" },
  },
  {
    id: "art-dots",
    name: "Точки",
    category: "art",
    description: "Круглые модули и круглые маркеры",
    design: { dotStyle: "dots", eyeStyle: "circle", fg: "#0f766e" },
  },
  {
    id: "art-cloud",
    name: "Облако",
    category: "art",
    description: "Точки в форме облака с градиентом",
    design: { ...shape("cloud"), dotStyle: "dots", eyeStyle: "rounded", gradient: true, grad1: "#0369a1", grad2: "#7c3aed" },
  },

  // ── Мастера ──
  {
    id: "master-handyman",
    name: "Мастер на час",
    category: "masters",
    description: "Код в форме дома с молотком — для мелкого ремонта и мужа на час",
    logo: "🔨",
    design: { ...shape("house"), fg: "#b45309", logoSize: 18 },
  },
  {
    id: "master-plumber",
    name: "Сантехник",
    category: "masters",
    description: "Капля с жидкими модулями — для сантехников и аварийных служб",
    logo: "🚿",
    design: { ...shape("drop"), dotStyle: "liquid", eyeStyle: "rounded", fg: "#0369a1", logoSize: 18 },
  },
  {
    id: "master-electric",
    name: "Электрик",
    category: "masters",
    description: "Щит с молнией и оранжевыми маркерами — для электриков",
    logo: "⚡",
    design: { ...shape("shield"), fg: "#1e293b", eyeCustom: true, eyeColor: "#b45309", logoSize: 18 },
  },
  {
    id: "master-repair",
    name: "Ремонт техники",
    category: "masters",
    description: "Шестерёнка с ключом — для ремонта техники и мастерских",
    logo: "🔧",
    design: { ...shape("gear"), fg: "#374151", logoSize: 18 },
  },
  {
    id: "master-build",
    name: "Стройка",
    category: "masters",
    description: "Соты с краном — для бригад, отделки и стройки",
    logo: "🏗️",
    design: { ...shape("hexagon"), fg: "#c2410c", logoSize: 18 },
  },
  {
    id: "master-cleaning",
    name: "Клининг",
    category: "masters",
    description: "Точки в облачке чата — для клининга и химчистки",
    logo: "🧹",
    design: { ...shape("bubble"), dotStyle: "dots", eyeStyle: "rounded", fg: "#0e7490", logoSize: 18 },
  },

  // ── Медицина ──
  {
    id: "med-clinic",
    name: "Клиника",
    category: "medical",
    description: "Медицинский крест — для клиник и медцентров",
    logo: "🩺",
    design: { ...shape("cross"), fg: "#0f766e", logoSize: 16 },
  },
  {
    id: "med-doctor",
    name: "Врач",
    category: "medical",
    description: "Сердце из жидких модулей — для частных врачей и кардиологов",
    logo: "🩺",
    design: { ...shape("heart"), dotStyle: "liquid", eyeStyle: "rounded", gradient: true, grad1: "#2563eb", grad2: "#0e7490", logoSize: 16 },
  },
  {
    id: "med-pharmacy",
    name: "Аптека",
    category: "medical",
    description: "Зелёный крест с таблеткой — для аптек",
    logo: "💊",
    design: { ...shape("cross"), fg: "#15803d", logoSize: 16 },
  },
  {
    id: "med-vet",
    name: "Ветклиника",
    category: "medical",
    description: "Лапа — для ветеринаров, груминга и зоомагазинов",
    design: { ...shape("paw"), fg: "#7c2d12" },
  },

  // ── Авто ──
  {
    id: "auto-service",
    name: "Автосервис",
    category: "auto",
    description: "Шестерёнка с оранжевыми маркерами — для СТО и шиномонтажа",
    logo: "🚗",
    design: { ...shape("gear"), fg: "#111827", eyeCustom: true, eyeColor: "#c2410c", logoSize: 18 },
  },
  {
    id: "auto-taxi",
    name: "Такси",
    category: "auto",
    description: "Машина на жёлтом фоне — для такси и трансферов",
    design: { ...shape("car"), fg: "#111827", bg: "#fde047" },
  },
  {
    id: "auto-driver",
    name: "Водитель",
    category: "auto",
    description: "Метка на карте — для водителей, перевозок и выездных мастеров",
    logo: "🚗",
    design: { ...shape("pin"), fg: "#1d4ed8", logoSize: 18 },
  },
  {
    id: "auto-wash",
    name: "Автомойка",
    category: "auto",
    description: "Капля из точек с синим градиентом — для автомоек и детейлинга",
    logo: "🚗",
    design: { ...shape("drop"), dotStyle: "dots", eyeStyle: "rounded", gradient: true, grad1: "#0369a1", grad2: "#4f46e5", logoSize: 18 },
  },
  {
    id: "auto-delivery",
    name: "Доставка",
    category: "auto",
    description: "Соты с коробкой — для курьеров и доставки",
    logo: "📦",
    design: { ...shape("hexagon"), gradient: true, grad1: "#c2410c", grad2: "#b91c1c", gradType: "linear-diag", logoSize: 18 },
  },

  // ── Красота и спорт ──
  {
    id: "beauty-salon",
    name: "Салон красоты",
    category: "beauty",
    description: "Корона из жидких модулей — для салонов, маникюра и бровистов",
    logo: "💅",
    design: { ...shape("crown"), dotStyle: "liquid", eyeStyle: "rounded", fg: "#be185d", logoSize: 18 },
  },
  {
    id: "beauty-barber",
    name: "Барбершоп",
    category: "beauty",
    description: "Тёмный щит с красными маркерами — для барбершопов",
    logo: "💈",
    design: { ...shape("shield"), fg: "#111827", eyeCustom: true, eyeColor: "#b91c1c", logoSize: 18 },
  },
  {
    id: "beauty-flowers",
    name: "Цветы",
    category: "beauty",
    description: "Круг из точек с розовым градиентом — для цветочных и подарков",
    logo: "🌸",
    design: { ...shape("circle"), dotStyle: "dots", eyeStyle: "circle", gradient: true, grad1: "#be185d", grad2: "#7c3aed", logoSize: 18 },
  },
  {
    id: "beauty-fitness",
    name: "Фитнес",
    category: "beauty",
    description: "Звезда — для фитнеса, тренеров и спортивных секций",
    logo: "🏋️",
    design: { ...shape("star"), fg: "#dc2626", logoSize: 16 },
  },

  // ── Еда и магазины ──
  {
    id: "food-coffee",
    name: "Кофейня",
    category: "food",
    description: "Чашка — для кофеен и кондитерских",
    logo: "☕",
    design: { ...shape("cup"), fg: "#78350f", logoSize: 16 },
  },
  {
    id: "food-pizza",
    name: "Пиццерия",
    category: "food",
    description: "Красный круг из жидких модулей — для пиццерий и доставки еды",
    logo: "🍕",
    design: { ...shape("circle"), dotStyle: "liquid", eyeStyle: "rounded", fg: "#b91c1c", logoSize: 18 },
  },
  {
    id: "food-shop",
    name: "Магазин",
    category: "food",
    description: "Пакет с покупками — для магазинов и маркетплейсов",
    logo: "🛍️",
    design: { ...shape("bag"), fg: "#7c3aed", logoSize: 18 },
  },
  {
    id: "food-clothes",
    name: "Одежда",
    category: "food",
    description: "Футболка из точек — для магазинов одежды и мерча",
    design: { ...shape("shirt"), dotStyle: "dots", eyeStyle: "rounded", fg: "#0f172a" },
  },
  {
    id: "food-hotel",
    name: "Отель",
    category: "food",
    description: "Дом с золотистым градиентом — для отелей, хостелов и посуточной аренды",
    logo: "🏨",
    design: { ...shape("house"), gradient: true, grad1: "#a16207", grad2: "#78350f", logoSize: 18 },
  },
];

/** Полное оформление стиля поверх основы (без логотипа и фото — их подставляет каждая сторона). */
export function artPresetDesign(p: ArtPreset): Partial<QrDesign> {
  return { ...ART_PRESET_BASE, ...p.design };
}
