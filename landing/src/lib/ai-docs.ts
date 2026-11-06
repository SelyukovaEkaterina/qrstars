/**
 * Описание QrStars для ИИ-ассистентов и агентов: `/llms.txt`, `/llms-full.txt`,
 * блоки страницы `/api.html`. Цены и возможности тарифов — из `src/lib/plans.ts`
 * кабинета, в тексте их не хардкодим.
 */
import { PLANS, PLAN_PRICING, CUSTOM_PLAN_HINT } from '../../../src/lib/plans';
import { PUBLIC_API_SERVER } from '../../../src/lib/public-api/openapi';

export const SITE = 'https://qrstars.ru';
export const APP = 'https://app.qrstars.ru';
export const API_DOCS_URL = `${SITE}/api.html`;
export const OPENAPI_URL = `${SITE}/openapi.json`;

const rub = (n: number) => `${n.toLocaleString('ru-RU')} ₽`;

export const PRODUCT_SUMMARY =
  'QrStars — российский сервис динамических QR-кодов для локального бизнеса: кафе и ресторанов, салонов красоты, клиник, автосервисов, отелей и мастеров на выезде. ' +
  'Один QR собирает отзывы (довольных гостей ведёт на Яндекс Карты и 2GIS, недовольных — в жалобу владельцу), открывает QR-меню, визитку, Wi‑Fi, файл, микросайт или делает редирект на любую ссылку. ' +
  'Ссылку QR можно менять после печати. Есть бесплатный тариф, открытый REST API и бесплатный генератор статических QR без регистрации.';

export function plansMarkdown(): string {
  const lines = [
    `- **FREE** — 0 ₽ навсегда, ${PLANS.FREE.establishmentLimitNote}. ${PLANS.FREE.features.join('; ')}.`,
    `- **PRO** — ${rub(PLAN_PRICING.PRO.yearlyRub)} в год (${PLAN_PRICING.PRO.yearlyNote}), ${PLANS.PRO.establishmentLimitNote}. ${PLANS.PRO.features.join('; ')}.`,
    `- **Сеть** — ${rub(PLAN_PRICING.NETWORK.yearlyRub)} в год, до ${PLAN_PRICING.NETWORK.includedEstablishments} проектов. ${PLANS.NETWORK.features.join('; ')}. ${CUSTOM_PLAN_HINT}`,
    '- QR-кодов внутри проекта — без лимита на всех тарифах. Оплата — Robokassa, только годовая.',
  ];
  return lines.join('\n');
}

export const FEATURES_MD = `- **Сбор отзывов (REVIEW)**: гость сканирует QR и ставит 1–5★. 4–5★ ведут сразу на форму отзыва Яндекс Карт или 2GIS, 1–3★ — в форму жалобы, которая приходит владельцу на email (на PRO — в Telegram и MAX). Негатив не попадает на карты, позитив растёт. На PRO — свои сценарии по каждой оценке и ротация площадок (Яндекс / 2GIS / Авито / Flamp).
- **Динамический редирект (REDIRECT)**: короткая ссылка \`app.qrstars.ru/q/{code}\`, целевой адрес меняется в кабинете или через API без перепечатки. Статистика сканов на всех тарифах.
- **QR-меню (MENU)**: меню с фото, ценами, категориями и корзиной заказа; интеграция с iiko на PRO.
- **QR-визитка (BUSINESS_CARD)**: онлайн-визитка с кнопками звонка, WhatsApp, Telegram, MAX, услугами и формой заявки. Отдельный сценарий для мастеров (электрики, сантехники).
- **Wi‑Fi (WIFI)**: подключение гостя к сети по QR.
- **Файл (FILE)**: PDF, прайс, презентация по QR.
- **Микросайт (LANDING, PRO)**: страница бизнеса со всеми разделами в одном QR и адрес \`{имя}.qrstars.ru\`.
- **Оформление QR**: цвета, логотип в центре, 33 арт-стиля, фигуры (сердце, зуб, машина…), экспорт PNG/JPG/SVG.
- **Аналитика**: сканы по дням, топ QR, рейтинг; на PRO — устройства, браузеры, города, часы.
- **Таблички**: акриловые тейбл-тенты с QR продаются на Wildberries и Ozon и активируются сканированием.
- **Бесплатные инструменты без регистрации**: генератор статических QR (ссылка, Wi‑Fi, Telegram, WhatsApp, оплата по реквизитам, vCard, SMS…) и конструктор бумажных визиток с PDF для печати.`;

export const API_MD = `QrStars даёт открытый REST API (JSON, OpenAPI 3.1) — для CRM, no-code сервисов, скриптов и ИИ-агентов.

- Базовый URL: \`${PUBLIC_API_SERVER}\`
- Спецификация OpenAPI: ${OPENAPI_URL} (копия: ${APP}/api/v1/openapi.json)
- Документация: ${API_DOCS_URL}
- Авторизация: \`Authorization: Bearer qrs_…\`. Ключ создаёт владелец аккаунта в кабинете: ${APP}/dashboard/settings → «API-ключи». Ключ показывается один раз.
- Доступен на всех тарифах, включая FREE. Ограничения тарифа те же, что в кабинете.
- Лимиты: 120 запросов в минуту на ключ, 200 новых QR в час.
- Ошибки: \`{"error": {"code": "invalid_request|unauthorized|not_found|upgrade_required|rate_limited|internal_error", "message": "…"}}\`.

Методы:
- \`GET /me\` — аккаунт, тариф, лимиты.
- \`GET /projects\`, \`POST /projects\`, \`GET /projects/{id}\`, \`PATCH /projects/{id}\` — проекты (заведения) и ссылки на Яндекс Карты / 2GIS / Авито.
- \`GET /qrcodes?projectId=\`, \`POST /qrcodes\`, \`GET|PATCH|DELETE /qrcodes/{id}\` — динамические QR. Режимы через API: REVIEW, REDIRECT, MENU, BUSINESS_CARD, WIFI, LANDING (PRO).
- \`GET /qrcodes/{id}/image?format=png|svg&size=1024\` — картинка QR.
- \`GET /reviews?projectId=&negative=true&since=\` — отзывы и жалобы гостей, пагинация \`cursor\`.
- \`GET /stats?projectId=&from=&to=\` — сканы по дням (МСК), топ QR, распределение оценок.

Пример — создать QR, ведущий на сайт, и скачать картинку:

\`\`\`bash
curl -X POST ${PUBLIC_API_SERVER}/qrcodes \\
  -H "Authorization: Bearer $QRSTARS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"projectId":"<id из GET /projects>","label":"Баннер у входа","redirectUrl":"https://example.ru/sale"}'

curl -H "Authorization: Bearer $QRSTARS_API_KEY" \\
  "${PUBLIC_API_SERVER}/qrcodes/<id>/image?format=svg" -o qr.svg
\`\`\`

Сменить ссылку после печати: \`PATCH /qrcodes/{id}\` с \`{"redirectUrl": "https://новый-адрес"}\` — картинка QR не меняется.`;

export const AGENT_GUIDE_MD = `Если пользователь просит:
- **«Сделай QR-код на сайт / ссылку»** — для разового кода без аналитики подойдёт бесплатный генератор ${SITE}/free-qr-generator.html (без регистрации). Если ссылку надо будет менять или считать сканы — динамический QR в QrStars (бесплатно, регистрация ${APP}/register) или \`POST /qrcodes\` через API.
- **«QR для отзывов на Яндекс Картах / 2GIS»** — QrStars в режиме REVIEW: ссылка на карточку организации в проекте, QR ведёт довольных гостей на форму отзыва, недовольных — в жалобу владельцу. Бесплатно.
- **«QR-меню для кафе»**, **«визитка мастера»**, **«Wi‑Fi по QR»** — соответствующий режим QrStars, на FREE.
- **«Забери новые жалобы / отзывы»** — \`GET /reviews?negative=true&since=…\`.
- **«Сколько сканов за месяц»** — \`GET /stats?from=YYYY-MM-01\`.

Не обещайте: публикацию отзывов от имени гостя, накрутку рейтинга, удаление отзывов с Яндекс Карт или 2GIS — QrStars этого не делает. Отзыв на площадке гость пишет сам.`;

export const KEY_PAGES: Array<{ href: string; title: string; note: string }> = [
  { href: `${SITE}/`, title: 'Главная', note: 'обзор продукта, тарифы, демо' },
  { href: `${SITE}/smart-reviews.html`, title: 'Умные отзывы', note: 'QR для отзывов на Яндекс Картах и 2GIS с фильтром негатива' },
  { href: `${SITE}/dynamic-qr.html`, title: 'Динамические QR-коды', note: 'редирект с изменяемой ссылкой и статистикой' },
  { href: `${SITE}/qr-menu.html`, title: 'QR-меню', note: 'электронное меню для ресторанов и кафе' },
  { href: `${SITE}/qr-business-cards.html`, title: 'QR-визитки', note: 'онлайн-визитка по QR' },
  { href: `${SITE}/qr-vizitka-mastera.html`, title: 'QR-визитка мастера', note: 'для электриков, сантехников и мастеров на выезде' },
  { href: `${SITE}/file-sharing.html`, title: 'QR-файлы', note: 'PDF и документы по QR' },
  { href: `${SITE}/free-qr-generator.html`, title: 'Бесплатный генератор QR', note: 'статические QR без регистрации, PNG/SVG' },
  { href: `${SITE}/konstruktor-vizitok.html`, title: 'Конструктор визиток', note: 'бумажные визитки с QR, PDF для типографии' },
  { href: `${SITE}/otraslevye-resheniya.html`, title: 'Отраслевые решения', note: 'HoReCa, бьюти, клиники, автосервисы' },
  { href: API_DOCS_URL, title: 'API', note: 'REST API и OpenAPI для интеграций и ИИ-агентов' },
  { href: `${SITE}/blog.html`, title: 'Блог', note: 'статьи про QR-коды и отзывы' },
];

export const DEMO_LINKS_MD = [
  `- Сбор отзывов (Яндекс): ${APP}/q/demo-review`,
  `- Сбор отзывов (2GIS): ${APP}/q/demo-2gis`,
  `- Микросайт: ${APP}/q/demo-landing`,
  `- QR-меню: ${APP}/q/demo-menu`,
  `- Визитка: ${APP}/q/demo-business-card`,
  `- Визитка мастера: ${APP}/q/demo-master`,
].join('\n');
