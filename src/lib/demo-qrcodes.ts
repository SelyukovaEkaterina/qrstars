import type { QRCodeMode } from "@/generated/prisma/client";
import { DEMO_MENU_ITEMS } from "@/lib/demo-menu-data";
import { DEMO_TIRE_MENU_ITEMS } from "@/lib/demo-tire-menu-data";
import { DEMO_DENTAL_MENU_ITEMS } from "@/lib/demo-dental-menu-data";
import { type PageModules, type ModuleIcons, type ModuleTypes } from "@/lib/page-modules";
import type { FormViewData } from "@/components/scan/FormView";
import { DEFAULT_REVIEW_ROUTING, reviewRoutingToJson } from "@/lib/review-routing";
import type { PublicBusinessCard } from "@/lib/business-card";

/** Стабильные коды для лендинга: /q/demo-review и т.д. Не хранятся в БД. */
export const DEMO_QR_PREFIX = "demo-" as const;

export type DemoQrSlug =
  | "demo-landing"
  | "demo-review"
  | "demo-2gis"
  | "demo-redirect"
  | "demo-business-card"
  | "demo-wifi"
  | "demo-file"
  | "demo-menu"
  | "demo-form"
  | "demo2-landing"
  | "demo2-review"
  | "demo2-redirect"
  | "demo2-business-card"
  | "demo2-wifi"
  | "demo2-file"
  | "demo2-menu"
  | "demo3-landing"
  | "demo3-review"
  | "demo3-redirect"
  | "demo3-business-card"
  | "demo3-wifi"
  | "demo3-file"
  | "demo3-menu"
  | "demo-tips"
  | "demo-master"
  | "demo-seller";

export interface DemoQrCatalogItem {
  slug: DemoQrSlug;
  mode: QRCodeMode;
  title: string;
  description: string;
  emoji: string;
}

export const DEMO_QR_CATALOG: DemoQrCatalogItem[] = [
  {
    slug: "demo-landing",
    mode: "LANDING",
    title: "Микросайт",
    description: "Все сервисы на одной странице: меню, отзывы, Wi‑Fi, контакты",
    emoji: "📱",
  },
  {
    slug: "demo-review",
    mode: "REVIEW",
    title: "Отзывы",
    description: "Оценка 1–5★, негатив владельцу, позитив на карты",
    emoji: "⭐",
  },
  {
    slug: "demo-2gis",
    mode: "REVIEW",
    title: "Отзывы в 2GIS",
    description: "Оценка 1–5★, негатив владельцу, позитив в 2GIS",
    emoji: "📍",
  },
  {
    slug: "demo-redirect",
    mode: "REDIRECT",
    title: "Редирект",
    description: "Мгновенный переход по ссылке без промежуточного экрана",
    emoji: "🔗",
  },
  {
    slug: "demo-business-card",
    mode: "BUSINESS_CARD",
    title: "Визитка",
    description: "Контакты, соцсети, сохранение в телефон",
    emoji: "📇",
  },
  {
    slug: "demo-wifi",
    mode: "WIFI",
    title: "Wi‑Fi",
    description: "QR для подключения к гостевой сети",
    emoji: "📶",
  },
  {
    slug: "demo-file",
    mode: "FILE",
    title: "Файл",
    description: "Скачивание PDF или документа",
    emoji: "📄",
  },
  {
    slug: "demo-menu",
    mode: "MENU",
    title: "Меню",
    description: "Цифровое меню с поиском по позициям",
    emoji: "☕",
  },
  {
    slug: "demo-form",
    mode: "FORM",
    title: "Форма",
    description: "Сбор заявок: запись на услугу, бронь столика, опрос",
    emoji: "📝",
  },
  {
    slug: "demo-tips",
    mode: "TIPS",
    title: "Чаевые",
    description: "Страница приёма чаевых: перевод по номеру телефона или редирект на сервис",
    emoji: "💰",
  },
  {
    slug: "demo-master",
    mode: "BUSINESS_CARD",
    title: "Визитка мастера",
    description: "Позвонить, WhatsApp, услуги и цены, сохранить контакт",
    emoji: "🔧",
  },
  {
    slug: "demo-seller",
    mode: "LANDING",
    title: "Страница товара для селлера",
    description: "QR на вкладыш: инструкция, поддержка, отзыв на WB и Ozon, другие товары",
    emoji: "📦",
  },
  {
    slug: "demo2-landing",
    mode: "LANDING",
    title: "Микросайт — шиномонтаж",
    description: "Демо для автосервиса: услуги, отзывы, Wi‑Fi, контакты",
    emoji: "🔧",
  },
  {
    slug: "demo2-review",
    mode: "REVIEW",
    title: "Отзывы — шиномонтаж",
    description: "Оценка 1–5★ для автосервиса",
    emoji: "⭐",
  },
  {
    slug: "demo2-redirect",
    mode: "REDIRECT",
    title: "Редирект — шиномонтаж",
    description: "Переход на Яндекс.Карты шиномонтажа",
    emoji: "🔗",
  },
  {
    slug: "demo2-business-card",
    mode: "BUSINESS_CARD",
    title: "Визитка — шиномонтаж",
    description: "Контакты мастера шиномонтажа",
    emoji: "📇",
  },
  {
    slug: "demo2-wifi",
    mode: "WIFI",
    title: "Wi‑Fi — шиномонтаж",
    description: "Гостевая сеть в зоне ожидания",
    emoji: "📶",
  },
  {
    slug: "demo2-file",
    mode: "FILE",
    title: "Файл — шиномонтаж",
    description: "Скачать прайс-лист",
    emoji: "📄",
  },
  {
    slug: "demo2-menu",
    mode: "MENU",
    title: "Услуги — шиномонтаж",
    description: "Прайс-лист услуг шиномонтажа",
    emoji: "🔧",
  },
  {
    slug: "demo3-landing",
    mode: "LANDING",
    title: "Микросайт — стоматология",
    description: "Демо для клиники: услуги, отзывы, Wi‑Fi, контакты",
    emoji: "🦷",
  },
  {
    slug: "demo3-review",
    mode: "REVIEW",
    title: "Отзывы — стоматология",
    description: "Оценка 1–5★ для стоматологической клиники",
    emoji: "⭐",
  },
  {
    slug: "demo3-redirect",
    mode: "REDIRECT",
    title: "Редирект — стоматология",
    description: "Переход на Яндекс.Карты клиники",
    emoji: "🔗",
  },
  {
    slug: "demo3-business-card",
    mode: "BUSINESS_CARD",
    title: "Визитка — стоматология",
    description: "Контакты главного врача клиники",
    emoji: "📇",
  },
  {
    slug: "demo3-wifi",
    mode: "WIFI",
    title: "Wi‑Fi — стоматология",
    description: "Гостевая сеть в зоне ожидания клиники",
    emoji: "📶",
  },
  {
    slug: "demo3-file",
    mode: "FILE",
    title: "Файл — стоматология",
    description: "Скачать прайс-лист услуг",
    emoji: "📄",
  },
  {
    slug: "demo3-menu",
    mode: "MENU",
    title: "Услуги — стоматология",
    description: "Прайс-лист услуг стоматологии",
    emoji: "🦷",
  },
];

const DEMO_SLUGS = new Set<string>(DEMO_QR_CATALOG.map((d) => d.slug));

export function isDemoQrCode(code: string): code is DemoQrSlug {
  return DEMO_SLUGS.has(code);
}

export function scanPath(slug: DemoQrSlug): string {
  return `/q/${slug}`;
}

/** ID заведения для демо-режима отзывов (не пишется в БД). */
export const DEMO_ESTABLISHMENT_ID = "demo";

export const demoBusinessCard = {
  id: "demo-bc",
  fullName: "Анна Иванова",
  title: "Управляющая",
  company: "Кофейня «Бобр»",
  phone: "+7 (495) 123-45-67",
  email: "anna@demo.qrstars.ru",
  website: "https://qrstars.ru",
  address: "Москва, ул. Примерная, 42",
  about:
    "Демо-визитка QrStars.ru. Отсканируйте QR на столе — гости увидят такой же экран с вашими контактами.",
  avatarUrl: null,
  socialLinks: [
    { type: "telegram", url: "https://t.me/qrstars_demo" },
    { type: "vk", url: "https://vk.com" },
  ],
  accentColor: "#4f46e5",
};

/** Визитка мастера для лендинга «QR-визитка для мастера» (/q/demo-master). */
export const demoMasterCard: PublicBusinessCard = {
  id: "demo-master",
  fullName: "Сергей Петров",
  title: "Электрик",
  company: null,
  phone: "+7 (900) 000-00-00",
  email: null,
  website: null,
  address: null,
  about:
    "Опыт 12 лет. Розетки, автоматы, щитки, проводка под ключ. Приеду в день обращения, гарантия на работу 1 год.\n\nЭто демо-визитка QrStars — свою можно сделать бесплатно за минуту.",
  avatarUrl: null,
  socialLinks: [],
  accentColor: "#0369a1",
  whatsapp: "+7 (900) 000-00-00",
  telegram: "@qrstars_demo",
  maxUrl: null,
  services: [
    { name: "Выезд и диагностика", price: "500 ₽" },
    { name: "Установка розетки", price: "от 400 ₽" },
    { name: "Замена автомата", price: "от 600 ₽" },
    { name: "Сборка щитка", price: "от 3 500 ₽" },
    { name: "Проводка в квартире", price: "договорная" },
  ],
  serviceArea: "Москва, выезд по городу",
  workHours: "Ежедневно 8:00–21:00",
  reviewsUrl: "https://qrstars.ru",
};

export const demoWifiConfig = {
  id: "demo-wifi",
  ssid: "QrStars-Guest",
  password: "demo-wifi-2025",
  encryption: "WPA",
  hidden: false,
};

export const demoFileAsset = {
  id: "demo-file",
  title: "Меню напитков",
  fileName: "menu-demo.pdf",
  fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
  mimeType: "application/pdf",
  fileSize: 13264,
};

const demoMenuImage = (file: string) => `/demo/menu/${file}`;

export const demoMenu = {
  id: "demo-menu",
  title: "Меню кофейни",
  description: "Демо-режим QrStars.ru — так гости видят ваше меню",
  cartEnabled: true,
  askPhone: true,
  askEmail: false,
  askAddress: false,
  items: DEMO_MENU_ITEMS.map((item, order) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    weight: item.weight,
    price: item.price,
    description: item.description,
    imageUrl: demoMenuImage(item.image),
    order,
  })),
};

/** Все блоки включены для демо микро-лендинга. */
export const demoPageModules: PageModules = {
  menu: true,
  review: true,
  businessCard: true,
  wifi: true,
  tips: true,
};

export const demoModuleIcons: ModuleIcons = {
  menu: "☕",
  review: "⭐",
  businessCard: "📇",
  wifi: "📶",
  tips: "💰",
};

const demoTipsImage = (file: string) => `/demo/tips/${file}`;

/** Сотрудники для демо-чаевых кофейни «Бобр» — разные способы приёма. */
export const demoTipsEmployees = [
  {
    id: "demo-tip-maria",
    name: "Мария",
    photoUrl: demoTipsImage("maria.jpg"),
    paymentType: "LINK" as const,
    paymentUrl: "https://qrstars.ru/?demo-tips=cloudtips",
  },
  {
    id: "demo-tip-alexander",
    name: "Александр",
    photoUrl: demoTipsImage("alexander.jpg"),
    paymentType: "PHONE" as const,
    phone: "+7 900 123-45-67",
    bankName: "Тинькофф",
  },
  {
    id: "demo-tip-darya",
    name: "Дарья",
    photoUrl: demoTipsImage("darya.jpg"),
    paymentType: "PHONE" as const,
    phone: "+7 916 555-12-34",
    bankName: "Сбербанк",
  },
  {
    id: "demo-tip-ivan",
    name: "Иван",
    photoUrl: demoTipsImage("ivan.jpg"),
    paymentType: "LINK" as const,
    paymentUrl: "https://qrstars.ru/?demo-tips=netmonet",
  },
];

export const demoTipsConfig = {
  tipsType: "EMPLOYEES" as const,
  employees: demoTipsEmployees,
};

export const demoCustomPages = [
  {
    id: "demo-custom-1",
    menuItemLabel: "О нас",
    title: "О нашей кофейне",
    content:
      "<h2>Добро пожаловать в «Бобр»!</h2><p>Мы — уютная кофейня в центре Москвы. Готовим на зерне собственной обжарки.</p><p><strong>Работаем с 2019 года</strong> и любим каждого гостя.</p><ul><li>Свежая выпечка каждое утро</li><li>Альтернативные методы заваривания</li><li>Десерты ручной работы</li></ul>",
    type: "HTML",
    url: null,
    icon: "ℹ️",
    enabled: true,
  },
  {
    id: "demo-custom-link-1",
    menuItemLabel: "Наш сайт",
    title: "Наш сайт",
    content: "",
    type: "LINK",
    url: "https://qrstars.ru",
    icon: "🌐",
    enabled: true,
  },
];

export const demoReviewScan = {
  establishmentName: "Кофейня «Бобр»",
  establishmentId: DEMO_ESTABLISHMENT_ID,
  qrCodeId: "demo-review" as DemoQrSlug,
  reviewRouting: reviewRoutingToJson(DEFAULT_REVIEW_ROUTING),
  platformUrls: {
    yandexMapsUrl: "https://yandex.ru/maps/",
    twoGisUrl: "https://2gis.ru/",
    avitoUrl: null,
  },
  watermarkEnabled: true,
  showPromo: true,
  promoCode: "DEMO10",
};

const demo2GisReviewRouting = {
  ...DEFAULT_REVIEW_ROUTING,
  4: {
    ...DEFAULT_REVIEW_ROUTING[4],
    action: "TWO_GIS" as const,
    platformList: [{ type: "TWO_GIS" as const }],
    ctaLabel: "Оставить отзыв в 2GIS",
  },
  5: {
    ...DEFAULT_REVIEW_ROUTING[5],
    action: "TWO_GIS" as const,
    platformList: [{ type: "TWO_GIS" as const }],
    ctaLabel: "Оставить отзыв в 2GIS",
  },
};

/** Демо отзывов для SEO-страницы 2GIS: 4–5★ направляются в 2GIS. */
export const demo2GisReviewScan = {
  ...demoReviewScan,
  qrCodeId: "demo-2gis" as DemoQrSlug,
  reviewRouting: reviewRoutingToJson(demo2GisReviewRouting),
};

/** Куда уводит демо-редирект (безопасная публичная ссылка). */
export const demoRedirectUrl = "https://yandex.ru/maps/";

/** Часы работы для демо-заведений. */
export const demoWorkingHours = {
  mon: { open: "08:00", close: "22:00" },
  tue: { open: "08:00", close: "22:00" },
  wed: { open: "08:00", close: "22:00" },
  thu: { open: "08:00", close: "22:00" },
  fri: { open: "08:00", close: "23:00" },
  sat: { open: "09:00", close: "23:00" },
  sun: { open: "09:00", close: "22:00" },
};

export const demo2WorkingHours = {
  mon: { open: "09:00", close: "20:00" },
  tue: { open: "09:00", close: "20:00" },
  wed: { open: "09:00", close: "20:00" },
  thu: { open: "09:00", close: "20:00" },
  fri: { open: "09:00", close: "20:00" },
  sat: { open: "10:00", close: "18:00" },
  sun: null,
};

export const demo3WorkingHours = {
  mon: { open: "09:00", close: "21:00" },
  tue: { open: "09:00", close: "21:00" },
  wed: { open: "09:00", close: "21:00" },
  thu: { open: "09:00", close: "21:00" },
  fri: { open: "09:00", close: "21:00" },
  sat: { open: "10:00", close: "18:00" },
  sun: null,
};

// ─────────────────────────────────────────────
// Демо-набор №2: Шиномонтаж «Колесо»
// ─────────────────────────────────────────────

export const demo2EstablishmentId = "demo2";

const demo2MenuImage = (file: string) => `/demo/tire/${file}`;

export const demo2Menu = {
  id: "demo2-menu",
  title: "Услуги шиномонтажа",
  description: "Демо-режим QrStars.ru — так клиенты видят ваш прайс",
  items: DEMO_TIRE_MENU_ITEMS.map((item, order) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    weight: item.weight,
    price: item.price,
    description: item.description,
    imageUrl: demo2MenuImage(item.image),
    order,
  })),
};

export const demo2BusinessCard = {
  id: "demo2-bc",
  fullName: "Дмитрий Петров",
  title: "Мастер-приёмщик",
  company: "Шиномонтаж «Колесо»",
  phone: "+7 (495) 987-65-43",
  email: "info@demo2.qrstars.ru",
  website: "https://qrstars.ru",
  address: "г. Москва, Каширское шоссе, 61, стр. 2",
  about:
    "Демо-визитка шиномонтажа QrStars.ru. Гости сканируют QR в зоне ожидания и видят все услуги, контакты и могут оставить отзыв.",
  avatarUrl: null,
  socialLinks: [
    { type: "telegram", url: "https://t.me/qrstars_demo" },
    { type: "vk", url: "https://vk.com" },
  ],
  accentColor: "#dc2626",
  services: [
    { name: "Шиномонтаж R13–R16, комплект", price: "от 1 600 ₽" },
    { name: "Шиномонтаж R17–R19, комплект", price: "от 2 400 ₽" },
    { name: "Балансировка колеса", price: "от 250 ₽" },
    { name: "Ремонт прокола", price: "от 400 ₽" },
    { name: "Сезонное хранение, 4 колеса", price: "3 500 ₽ / сезон" },
    { name: "Правка литого диска", price: "от 1 500 ₽" },
  ],
};

export const demo2WifiConfig = {
  id: "demo2-wifi",
  ssid: "Koleso-Guest",
  password: "tire2025demo",
  encryption: "WPA",
  hidden: false,
};

export const demo2FileAsset = {
  id: "demo2-file",
  title: "Полный прайс-лист",
  fileName: "pricelist-demo.pdf",
  fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
  mimeType: "application/pdf",
  fileSize: 18432,
};

export const demo2PageModules: PageModules = {
  menu: true,
  review: true,
  businessCard: true,
  wifi: true,
  tips: false,
};

export const demo2ModuleIcons: ModuleIcons = {
  menu: "🔧",
  review: "⭐",
  businessCard: "📇",
  wifi: "📶",
};

export const demo2CustomPages = [
  {
    id: "demo2-custom-1",
    menuItemLabel: "О нас",
    title: "О нашем шиномонтаже",
    content:
      "<h2>Шиномонтаж «Колесо»</h2><p>Работаем с 2016 года на Каширском шоссе. Полный спектр шиномонтажных работ для легковых и лёгких грузовых автомобилей.</p><p><strong>Наши преимущества:</strong></p><ul><li>Немецкое оборудование Hofmann</li><li>Запись онлайн — без очередей</li><li>Зона ожидания с Wi‑Fi, кофе и ТВ</li><li>Гарантия на все виды работ</li><li>Хранение сезонных шин</li></ul><p>Более <strong>15 000 клиентов</strong> доверяют нам свои колёса.</p>",
    type: "HTML",
    url: null,
    icon: "🔧",
    enabled: true,
  },
  {
    id: "demo2-custom-2",
    menuItemLabel: "Как добраться",
    title: "Как нас найти",
    content:
      "<h2>Как добраться</h2><p><strong>Адрес:</strong> г. Москва, Каширское шоссе, д. 61, стр. 2</p><p><strong>Режим работы:</strong> ежедневно с 08:00 до 22:00</p><p><strong>Телефон:</strong> +7 (495) 987-65-43</p><p><strong>Парковка:</strong> свободная, перед въездом 5 мест.</p><p>От м. «Каширская» — 10 минут пешком или 3 минуты на автобусе 275 до остановки «Шиномонтаж».</p>",
    type: "HTML",
    url: null,
    icon: "🗺️",
    enabled: true,
  },
];

export const demo2ReviewScan = {
  establishmentName: "Шиномонтаж «Колесо»",
  establishmentId: demo2EstablishmentId,
  qrCodeId: "demo2-review" as DemoQrSlug,
  reviewRouting: reviewRoutingToJson(DEFAULT_REVIEW_ROUTING),
  platformUrls: {
    yandexMapsUrl: "https://yandex.ru/maps/",
    twoGisUrl: "https://2gis.ru/",
    avitoUrl: null,
  },
  watermarkEnabled: true,
  showPromo: true,
  promoCode: "TIREDEMO",
};

export const demo2RedirectUrl = "https://yandex.ru/maps/";

// ─────────────────────────────────────────────
// Демо-набор №3: Стоматология «ДентаЛюкс»
// ─────────────────────────────────────────────

export const demo3EstablishmentId = "demo3";

const demo3MenuImage = (file: string) => `/demo/dental/${file}`;

export const demo3Menu = {
  id: "demo3-menu",
  title: "Услуги стоматологии",
  description: "Демо-режим QrStars.ru — так пациенты видят ваш прайс",
  items: DEMO_DENTAL_MENU_ITEMS.map((item, order) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    weight: item.weight,
    price: item.price,
    description: item.description,
    imageUrl: demo3MenuImage(item.image),
    order,
  })),
};

export const demo3BusinessCard = {
  id: "demo3-bc",
  fullName: "Елена Смирнова",
  title: "Главный врач, стоматолог-ортопед",
  company: "Стоматология «ДентаЛюкс»",
  phone: "+7 (495) 555-12-34",
  email: "info@demo3.qrstars.ru",
  website: "https://qrstars.ru",
  address: "г. Москва, ул. Тверская, 18, стр. 1",
  about:
    "Демо-визитка стоматологии QrStars.ru. Пациенты сканируют QR в зоне ожидания и видят все услуги, контакты и могут оставить отзыв.",
  avatarUrl: null,
  socialLinks: [
    { type: "telegram", url: "https://t.me/qrstars_demo" },
    { type: "vk", url: "https://vk.com" },
  ],
  accentColor: "#0891b2",
  services: [
    { name: "Консультация и план лечения", price: "бесплатно" },
    { name: "Профессиональная гигиена", price: "4 900 ₽" },
    { name: "Лечение кариеса", price: "от 5 500 ₽" },
    { name: "Отбеливание ZOOM 4", price: "18 000 ₽" },
    { name: "Имплант под ключ", price: "от 45 000 ₽" },
    { name: "Детская стоматология", price: "от 2 500 ₽" },
  ],
};

export const demo3WifiConfig = {
  id: "demo3-wifi",
  ssid: "DentaLux-Guest",
  password: "smile2025demo",
  encryption: "WPA",
  hidden: false,
};

export const demo3FileAsset = {
  id: "demo3-file",
  title: "Полный прайс-лист",
  fileName: "dental-pricelist-demo.pdf",
  fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
  mimeType: "application/pdf",
  fileSize: 20480,
};

export const demo3PageModules: PageModules = {
  menu: true,
  review: true,
  businessCard: true,
  wifi: true,
  tips: false,
};

export const demo3ModuleIcons: ModuleIcons = {
  menu: "🦷",
  review: "⭐",
  businessCard: "📇",
  wifi: "📶",
};

export const demo3CustomPages = [
  {
    id: "demo3-custom-1",
    menuItemLabel: "О нас",
    title: "О нашей клинике",
    content:
      "<h2>Стоматология «ДентаЛюкс»</h2><p>Современная клиника в центре Москвы. Работаем с 2014 года и принимаем пациентов всех возрастов.</p><p><strong>Почему выбирают нас:</strong></p><ul><li>Компьютерная томография Planmeca (Финляндия)</li><li>Лечение под микроскопом Carl Zeiss</li><li>Собственная зуботехническая лаборатория</li><li>Рассрочка 0% на 12 месяцев</li><li>Гарантия на все виды работ</li></ul><p>Более <strong>20 000 довольных пациентов</strong> за 10 лет работы.</p>",
    type: "HTML",
    url: null,
    icon: "🏥",
    enabled: true,
  },
  {
    id: "demo3-custom-2",
    menuItemLabel: "Как добраться",
    title: "Как нас найти",
    content:
      "<h2>Как добраться</h2><p><strong>Адрес:</strong> г. Москва, ул. Тверская, д. 18, стр. 1 (здание «Дом книги», 3 этаж)</p><p><strong>Режим работы:</strong> Пн–Сб с 09:00 до 21:00, Вс — выходной</p><p><strong>Телефон:</strong> +7 (495) 555-12-34</p><p><strong>Парковка:</strong> подземная парковка ТЦ «Тверской», первый час бесплатно.</p><p>От м. «Пушкинская» / «Тверская» — 3 минуты пешком.</p>",
    type: "HTML",
    url: null,
    icon: "🗺️",
    enabled: true,
  },
];

export const demo3ReviewScan = {
  establishmentName: "Стоматология «ДентаЛюкс»",
  establishmentId: demo3EstablishmentId,
  qrCodeId: "demo3-review" as DemoQrSlug,
  reviewRouting: reviewRoutingToJson(DEFAULT_REVIEW_ROUTING),
  platformUrls: {
    yandexMapsUrl: "https://yandex.ru/maps/",
    twoGisUrl: "https://2gis.ru/",
    avitoUrl: null,
  },
  watermarkEnabled: true,
  showPromo: true,
  promoCode: "DENTADEMO",
};

export const demo3RedirectUrl = "https://yandex.ru/maps/";

// ─────────────────────────────────────────────
// Демо-формы для лендингов
// ─────────────────────────────────────────────

export const demoForm: FormViewData = {
  id: "demo-form-landing",
  title: "Забронировать столик",
  description: "Демо: ваша заявка никуда не отправится.",
  submitLabel: "Забронировать",
  successMessage: "Спасибо! Мы подтвердим бронь по телефону в ближайшее время.",
  enabled: true,
  fields: [
    { id: "df-1", label: "Имя", placeholder: "Как к вам обращаться", helpText: null, type: "text", required: true, options: null, order: 0 },
    { id: "df-2", label: "Телефон", placeholder: "+7 (___) ___-__-__", helpText: null, type: "phone", required: true, options: null, order: 1 },
    { id: "df-3", label: "Дата", placeholder: null, helpText: null, type: "date", required: true, options: null, order: 2 },
    { id: "df-4", label: "Время", placeholder: null, helpText: null, type: "time", required: true, options: null, order: 3 },
    { id: "df-5", label: "Количество гостей", placeholder: "2", helpText: null, type: "number", required: true, options: null, order: 4 },
    { id: "df-6", label: "Пожелания", placeholder: "У окна, детский стульчик и т.д.", helpText: null, type: "textarea", required: false, options: null, order: 5 },
  ],
};

export const demo2Form: FormViewData = {
  id: "demo2-form-landing",
  title: "Записаться на шиномонтаж",
  description: "Демо: ваша заявка никуда не отправится.",
  submitLabel: "Записаться",
  successMessage: "Спасибо! Мастер свяжется с вами для подтверждения времени.",
  enabled: true,
  fields: [
    { id: "d2f-1", label: "Имя", placeholder: "Как к вам обращаться", helpText: null, type: "text", required: true, options: null, order: 0 },
    { id: "d2f-2", label: "Телефон", placeholder: "+7 (___) ___-__-__", helpText: null, type: "phone", required: true, options: null, order: 1 },
    { id: "d2f-3", label: "Марка и модель авто", placeholder: "Toyota Camry 2018", helpText: null, type: "text", required: true, options: null, order: 2 },
    { id: "d2f-4", label: "Тип услуги", placeholder: null, helpText: null, type: "select", required: true, options: ["Сезонный шиномонтаж R13–R16", "Сезонный шиномонтаж R17+", "Балансировка", "Ремонт прокола", "Другое"], order: 3 },
    { id: "d2f-5", label: "Удобная дата", placeholder: null, helpText: null, type: "date", required: false, options: null, order: 4 },
    { id: "d2f-6", label: "Комментарий", placeholder: null, helpText: null, type: "textarea", required: false, options: null, order: 5 },
  ],
};

export const demo3Form: FormViewData = {
  id: "demo3-form-landing",
  title: "Записаться к стоматологу",
  description: "Демо: ваша заявка никуда не отправится.",
  submitLabel: "Записаться",
  successMessage: "Спасибо! Администратор клиники свяжется с вами в ближайшее время.",
  enabled: true,
  fields: [
    { id: "d3f-1", label: "Имя", placeholder: "Как к вам обращаться", helpText: null, type: "text", required: true, options: null, order: 0 },
    { id: "d3f-2", label: "Телефон", placeholder: "+7 (___) ___-__-__", helpText: null, type: "phone", required: true, options: null, order: 1 },
    { id: "d3f-3", label: "Услуга", placeholder: null, helpText: null, type: "select", required: true, options: ["Консультация", "Профессиональная чистка", "Лечение кариеса", "Имплантация", "Другое"], order: 2 },
    { id: "d3f-4", label: "Удобная дата визита", placeholder: null, helpText: null, type: "date", required: false, options: null, order: 3 },
    { id: "d3f-5", label: "Номер полиса ОМС", placeholder: "необязательно", helpText: "Если лечение по ОМС", type: "text", required: false, options: null, order: 4 },
    { id: "d3f-6", label: "Жалобы / комментарий", placeholder: null, helpText: null, type: "textarea", required: false, options: null, order: 5 },
  ],
};

export const demoModuleTypes: ModuleTypes = {
  [`form-${demoForm.id}`]: { type: "form", instanceId: demoForm.id },
};

export const demo2ModuleTypes: ModuleTypes = {
  [`form-${demo2Form.id}`]: { type: "form", instanceId: demo2Form.id },
};

export const demo3ModuleTypes: ModuleTypes = {
  [`form-${demo3Form.id}`]: { type: "form", instanceId: demo3Form.id },
};


// ── Демо для селлеров маркетплейсов (H-008): страница товара по QR на вкладыше ──
// Без фильтра отзывов и без бонусов за отзыв: на WB и Ozon это запрещено.

const sellerImage = (file: string) => `/demo/seller/${file}`;

export const demoSellerName = "Лучик — свет для дома";

export const demoSellerMenu = {
  id: "demo-seller-catalog",
  title: "Другие наши товары",
  description: "Найдите по артикулу на Wildberries или Ozon",
  cartEnabled: false,
  askPhone: false,
  askEmail: false,
  askAddress: false,
  items: [
    { id: "ds-1", name: "Лампа Лучик Pro с беспроводной зарядкой", category: "Свет", weight: "Арт. 184522371", price: "2 490 ₽", description: "Три режима света, зарядка телефона прямо на подставке.", imageUrl: sellerImage("lamp.svg"), order: 0 },
    { id: "ds-2", name: "Ночник «Луна» с таймером", category: "Свет", weight: "Арт. 184522372", price: "1 190 ₽", description: "Мягкий свет для детской, выключается сам через 30 минут.", imageUrl: sellerImage("nightlight.svg"), order: 1 },
    { id: "ds-3", name: "Органайзер для стола «Порядок»", category: "Для дома", weight: "Арт. 184522373", price: "890 ₽", description: "Три отсека для ручек, зарядок и мелочей.", imageUrl: sellerImage("organizer.svg"), order: 2 },
    { id: "ds-4", name: "Увлажнитель «Облачко»", category: "Для дома", weight: "Арт. 184522374", price: "2 190 ₽", description: "Тихий, 12 часов работы, ночная подсветка.", imageUrl: sellerImage("humidifier.svg"), order: 3 },
    { id: "ds-5", name: "Термокружка 450 мл", category: "Для дома", weight: "Арт. 184522375", price: "990 ₽", description: "Держит тепло 6 часов, не протекает в сумке.", imageUrl: sellerImage("mug.svg"), order: 4 },
  ],
};

export const demoSellerForm: FormViewData = {
  id: "demo-seller-support",
  title: "Проблема с товаром?",
  description: "Напишите нам — решим быстрее, чем возврат. Демо: заявка никуда не отправится.",
  submitLabel: "Написать продавцу",
  successMessage: "Спасибо! Мы ответим в течение рабочего дня и поможем разобраться.",
  enabled: true,
  fields: [
    { id: "dsf-1", label: "Имя", placeholder: "Как к вам обращаться", helpText: null, type: "text", required: true, options: null, order: 0 },
    { id: "dsf-2", label: "Телефон", placeholder: "+7 999 123-45-67", helpText: "Перезвоним или напишем в мессенджер", type: "phone", required: true, options: null, order: 1 },
    { id: "dsf-3", label: "Номер заказа", placeholder: "Необязательно", helpText: "Есть в личном кабинете маркетплейса", type: "text", required: false, options: null, order: 2 },
    { id: "dsf-4", label: "Что случилось", placeholder: null, helpText: null, type: "select", required: true, options: ["Не включается", "Не заряжает телефон", "Не хватает деталей", "Повреждение при доставке", "Вопрос по работе", "Другое"], order: 3 },
    { id: "dsf-5", label: "Подробнее", placeholder: "Опишите, что происходит", helpText: null, type: "textarea", required: false, options: null, order: 4 },
  ],
};

export const demoSellerCustomPages = [
  {
    id: "demo-seller-guide",
    menuItemLabel: "Инструкция",
    title: "Как пользоваться лампой Лучик Pro",
    content:
      "<h2>Подключение</h2><ol><li>Вставьте кабель USB-C в разъём на задней стороне основания.</li><li>Подключите блок питания 18 Вт или мощнее — слабый блок не потянет зарядку телефона.</li><li>Коснитесь сенсора на основании — лампа включится.</li></ol><h2>Режимы света</h2><ul><li>Короткое касание — включить и выключить.</li><li>Двойное касание — сменить оттенок: тёплый, нейтральный, холодный.</li><li>Удерживайте палец — плавно меняется яркость.</li></ul><h2>Беспроводная зарядка</h2><p>Положите телефон на подставку логотипом вниз, по центру. Индикатор загорится зелёным. Чехол толще 5 мм и магнитные держатели мешают зарядке.</p><h2>Если что-то не работает</h2><p>Проверьте блок питания и кабель из комплекта. Не помогло — нажмите «Проблема с товаром?» на этой странице, мы ответим в течение рабочего дня.</p>",
    type: "HTML",
    url: null,
    icon: "📘",
    enabled: true,
  },
  {
    id: "demo-seller-review-wb",
    menuItemLabel: "Оставить отзыв на Wildberries",
    title: "Оставить отзыв на Wildberries",
    content: "",
    type: "LINK",
    url: "https://www.wildberries.ru/",
    icon: "⭐",
    enabled: true,
  },
  {
    id: "demo-seller-review-ozon",
    menuItemLabel: "Оставить отзыв на Ozon",
    title: "Оставить отзыв на Ozon",
    content: "",
    type: "LINK",
    url: "https://www.ozon.ru/",
    icon: "⭐",
    enabled: true,
  },
  {
    id: "demo-seller-warranty",
    menuItemLabel: "Гарантия и возврат",
    title: "Гарантия 12 месяцев",
    content:
      "<p>На лампу действует гарантия 12 месяцев с даты получения заказа.</p><ul><li>Если лампа сломалась — напишите нам через «Проблема с товаром?», приложите номер заказа.</li><li>Заменим или вернём деньги через маркетплейс, сам товар везти никуда не нужно, пока мы не ответим.</li><li>Возврат в первые 14 дней — по правилам Wildberries и Ozon.</li></ul>",
    type: "HTML",
    url: null,
    icon: "🛡️",
    enabled: true,
  },
  {
    id: "demo-seller-store",
    menuItemLabel: "Наш магазин на Wildberries",
    title: "Наш магазин на Wildberries",
    content: "",
    type: "LINK",
    url: "https://www.wildberries.ru/",
    icon: "🛍️",
    enabled: true,
  },
];

export const demoSellerPageModules: PageModules = {
  menu: true,
  review: false,
  businessCard: false,
  wifi: false,
  tips: false,
};

export const demoSellerModuleIcons: ModuleIcons = {
  menu: "🛍️",
};

export const demoSellerModuleTypes: ModuleTypes = {
  [`form-${demoSellerForm.id}`]: { type: "form", instanceId: demoSellerForm.id },
};

export const demoSellerModuleOrder = [
  "custom-demo-seller-guide",
  `form-${demoSellerForm.id}`,
  "custom-demo-seller-review-wb",
  "custom-demo-seller-review-ozon",
  "menu",
  "custom-demo-seller-warranty",
  "custom-demo-seller-store",
] as const;

/** Часы работы поддержки продавца. */
export const demoSellerWorkingHours = {
  mon: { open: "10:00", close: "19:00" },
  tue: { open: "10:00", close: "19:00" },
  wed: { open: "10:00", close: "19:00" },
  thu: { open: "10:00", close: "19:00" },
  fri: { open: "10:00", close: "19:00" },
  sat: null,
  sun: null,
};
