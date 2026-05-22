import type { QRCodeMode } from "@/generated/prisma/client";
import { DEMO_MENU_ITEMS } from "@/lib/demo-menu-data";
import { DEMO_TIRE_MENU_ITEMS } from "@/lib/demo-tire-menu-data";
import { DEMO_DENTAL_MENU_ITEMS } from "@/lib/demo-dental-menu-data";
import { type PageModules, type ModuleIcons } from "@/lib/page-modules";
import { DEFAULT_REVIEW_ROUTING, reviewRoutingToJson } from "@/lib/review-routing";

/** Стабильные коды для лендинга: /scan/demo-review и т.д. Не хранятся в БД. */
export const DEMO_QR_PREFIX = "demo-" as const;

export type DemoQrSlug =
  | "demo-landing"
  | "demo-review"
  | "demo-redirect"
  | "demo-business-card"
  | "demo-wifi"
  | "demo-file"
  | "demo-menu"
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
  | "demo3-menu";

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
    title: "Микро-лендинг",
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
    slug: "demo2-landing",
    mode: "LANDING",
    title: "Микро-лендинг — шиномонтаж",
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
    title: "Микро-лендинг — стоматология",
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
  return `/scan/${slug}`;
}

/** ID заведения для демо-режима отзывов (не пишется в БД). */
export const DEMO_ESTABLISHMENT_ID = "demo";

export const demoBusinessCard = {
  id: "demo-bc",
  fullName: "Анна Иванова",
  title: "Управляющая",
  company: "Кофейня «Бобр» (демо)",
  phone: "+7 (495) 123-45-67",
  email: "anna@demo.qrstars.ru",
  website: "https://qrstars.ru",
  address: "г. Москва, ул. Примерная, 42",
  about:
    "Демо-визитка QrStars.ru. Отсканируйте QR на столе — гости увидят такой же экран с вашими контактами.",
  avatarUrl: null,
  socialLinks: [
    { type: "telegram", url: "https://t.me/qrstars_demo" },
    { type: "vk", url: "https://vk.com" },
  ],
  accentColor: "#4f46e5",
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
  title: "Меню напитков (демо)",
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
};

export const demoModuleIcons: ModuleIcons = {
  menu: "☕",
  review: "⭐",
  businessCard: "📇",
  wifi: "📶",
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
  establishmentName: "Кофейня «Бобр» (демо)",
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

/** Куда уводит демо-редирект (безопасная публичная ссылка). */
export const demoRedirectUrl = "https://yandex.ru/maps/";

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
  company: "Шиномонтаж «Колесо» (демо)",
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
  title: "Полный прайс-лист (демо)",
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
  {
    id: "demo2-custom-link-1",
    menuItemLabel: "Запись онлайн",
    title: "Запись онлайн",
    content: "",
    type: "LINK",
    url: "https://qrstars.ru",
    icon: "📅",
    enabled: true,
  },
];

export const demo2ReviewScan = {
  establishmentName: "Шиномонтаж «Колесо» (демо)",
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
  company: "Стоматология «ДентаЛюкс» (демо)",
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
  title: "Полный прайс-лист (демо)",
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
  {
    id: "demo3-custom-link-1",
    menuItemLabel: "Онлайн-запись",
    title: "Онлайн-запись",
    content: "",
    type: "LINK",
    url: "https://qrstars.ru",
    icon: "📅",
    enabled: true,
  },
];

export const demo3ReviewScan = {
  establishmentName: "Стоматология «ДентаЛюкс» (демо)",
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
