import type { QRCodeMode } from "@/generated/prisma/client";
import { DEMO_MENU_ITEMS } from "@/lib/demo-menu-data";
import { DEMO_TIRE_MENU_ITEMS } from "@/lib/demo-tire-menu-data";
import { DEMO_DENTAL_MENU_ITEMS } from "@/lib/demo-dental-menu-data";
import { type PageModules, type ModuleIcons, type ModuleTypes } from "@/lib/page-modules";
import type { FormViewData } from "@/components/scan/FormView";
import { DEFAULT_REVIEW_ROUTING, reviewRoutingToJson } from "@/lib/review-routing";

/** Стабильные коды для лендинга: /q/demo-review и т.д. Не хранятся в БД. */
export const DEMO_QR_PREFIX = "demo-" as const;

export type DemoQrSlug =
  | "demo-landing"
  | "demo-review"
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
  | "demo-tips";

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
