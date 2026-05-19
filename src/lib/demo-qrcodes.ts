import type { QRCodeMode } from "@/generated/prisma/client";
import { DEMO_MENU_ITEMS } from "@/lib/demo-menu-data";

/** Стабильные коды для лендинга: /scan/demo-review и т.д. Не хранятся в БД. */
export const DEMO_QR_PREFIX = "demo-" as const;

export type DemoQrSlug =
  | "demo-review"
  | "demo-redirect"
  | "demo-business-card"
  | "demo-wifi"
  | "demo-file"
  | "demo-menu";

export interface DemoQrCatalogItem {
  slug: DemoQrSlug;
  mode: QRCodeMode;
  title: string;
  description: string;
  emoji: string;
}

export const DEMO_QR_CATALOG: DemoQrCatalogItem[] = [
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
  theme: "minimal",
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

export const demoReviewScan = {
  establishmentName: "Кофейня «Бобр» (демо)",
  establishmentId: DEMO_ESTABLISHMENT_ID,
  qrCodeId: "demo-review" as DemoQrSlug,
  redirectUrl: "https://yandex.ru/maps/",
  watermarkEnabled: true,
  showPromo: true,
  promoCode: "DEMO10",
};

/** Куда уводит демо-редирект (безопасная публичная ссылка). */
export const demoRedirectUrl = "https://yandex.ru/maps/";
