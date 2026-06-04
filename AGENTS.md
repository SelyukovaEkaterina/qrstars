<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Проект: SmartReview («Умный QR-отзывик»)

## Суть продукта

**Phygital-продукт** (физический товар + SaaS) для локального бизнеса РФ (HoReCa, бьюти, автосервисы, клиники).

Локальный бизнес теряет клиентов из-за негативных отзывов на Яндекс Картах / 2GIS. SmartReview решает это:

1. **Физическая табличка** (акриловый тейбл-тент) на стол с QR-кодом «Наведите камеру».
2. **Гость сканирует QR** → ставит оценку 1–5 звёзд:
   - **По каждой оценке 1–5★** — настраиваемое действие (жалоба владельцу, отзыв на Яндекс / 2GIS / Авито, только благодарность) и свои тексты до/после отправки. На FREE — стандарт: 1–3★ жалоба, 4–5★ Яндекс; на PRO — свои сценарии в настройках QR «Сбор отзывов». Ссылки на площадки — в настройках заведения (`/dashboard/establishments/[id]`).

## Бизнес-модель

- **Продажа табличек** (разовый доход): себестоимость ~550 ₽, розница 1 200 ₽, чистая прибыль ~650 ₽. Продажа через Wildberries / Ozon.
- **Freemium SaaS** (рекуррентный доход): ядро FREE навсегда, платные тарифы PRO и «Сеть». Конфиг: `src/lib/plans.ts`.

### Тарифы (актуально)

| Тариф | Цена | Заведения |
|---|---|---|
| **FREE** | 0 ₽ | 1 |
| **PRO** | 690 ₽/мес (6 900 ₽/год) | 1 |
| **Сеть** | 1 490 ₽/мес + 350 ₽/точка сверх 2 (14 900 ₽/год база) | 2 в базе, далее per-point |

QR-кодов внутри заведения — **без лимита** на всех тарифах. Тарификация по числу заведений.

### Free vs Pro vs Сеть

| Функция | Free | Pro | Сеть |
|---|---|---|---|
| Маршрутизация 5★ | 1 площадка | Умная ротация (+ Flamp) | Как PRO на каждой точке |
| Жалобы (1–3★) | Email | Telegram + MAX | Как PRO |
| Вотермарка | QrStars | White Label | White Label сети |
| Лояльность / чаевые | Нет | Да | Да |
| Аналитика | Базовая | Расширенная | Сводный дашборд сети + CSV |
| Заведения | 1 | 1 | 2+ (per-point) |

## Путь пользователя

1. **Фабрика**: партия табличек с уникальными динамическими QR-кодами (`qr.site.ru/id001`), коды пока «пустые».
2. **Маркетплейс**: владелец покупает табличку на WB / Ozon.
3. **Активация**: владелец сканирует QR → форма (название заведения, email, ссылка на Яндекс.Карты) → код привязывается к заведению, на почту уходит пароль от личного кабинета.
4. **Саморегистрация (без таблички)**: `/register` → `/dashboard/start` — мастер «первый запуск» (`POST /api/setup/quick-start`: заведение + QR `LANDING` + ссылка Яндекс). Пока нет своего заведения, остальные страницы дашборда редиректят на `/dashboard/start`.
5. **Использование**: гости сканируют QR на столе, система фильтрует трафик.

## Стек технологий

- **Фронтенд**: React / Next.js (этот репозиторий)
- **Бэкенд / API**: Node.js или Python (Django/FastAPI)
- **БД**: PostgreSQL / Supabase
- **Платежи**: ЮKassa (рекуррентные платежи, 54-ФЗ)
- **Уведомления**: VK API, SMS-шлюз (SMS.ru)

## Ключевые сущности БД

- **User** (владелец заведения)
- **Business** (заведение)
- **QRCode** (уникальный QR, привязывается к Business при активации)
- **Review** (отзыв / жалоба)

## Продакшен

- **Приложение**: https://app.qrstars.ru (VPS `109.69.17.233`, Docker: `/opt/qrstars/deploy`)
- **Лендинг**: https://qrstars.ru / https://www.qrstars.ru → S3-бакет `1919a3d97e3e-website` (nginx proxy)
- **Файлы (логотипы, загрузки)**: https://s3.qrstars.ru (Beget S3, бакет `1919a3d97e3e-qrstarsru`)
- **Деплой**: `./deploy/deploy.sh` с локальной машины
- **SSL**: certbot systemd timer (`certbot.timer`, 2× в сутки) + hook `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh`

## Правила разработки

- **Автотесты**: при добавлении нового крупного функционала (новый режим QR-кода, новая фича в дашборде, новый API-эндпоинт) необходимо писать e2e-тесты (pytest, папка `e2e/`). Тесты должны покрывать позитивные и негативные сценарии.
- **Проверка на сервере**: после каждого деплоя (`./deploy/deploy.sh`) обязательно проверить ключевые эндпоинты продакшена (`https://app.qrstars.ru`), чтобы убедиться, что приложение запустилось корректно:
  1. Проверить health/load главной страницы: `curl -s -o /dev/null -w "%{http_code}" https://app.qrstars.ru/`
  2. Проверить API: `curl -s -o /dev/null -w "%{http_code}" https://app.qrstars.ru/api/auth/csrf`
  3. Проверить демо-скан: `curl -s -o /dev/null -w "%{http_code}" https://app.qrstars.ru/scan/demo-review`
  4. Если какой-то эндпоинт вернул не 200 — посмотреть логи контейнера: `ssh root@109.69.17.233 "docker logs deploy-app-1 --tail 50"`

## Архитектура контента и QR-маршрутизации

- **Контент заведения** (меню, визитка, Wi-Fi, сценарии отзывов) хранится на уровне `Establishment` и редактируется в **`/dashboard/my-page`** («Моя страница»). Тумблеры `pageModules` управляют блоками микро-лендинга. **Оформление**: `brandColor` (7 пресетов + свой HEX), `pageAppearance` (`light` / `dark`), `coverUrl`, `logoUrl` — палитра UI генерируется в `src/lib/brand-theme.ts`; акцент визитки синхронизируется с `brandColor`.
- **QR-код** (`/dashboard/qrcodes/[id]`) — только **маршрутизация**: 4 группы — **микро-лендинг** (`LANDING`), **быстрый доступ к разделу** (`MENU` / `REVIEW` / `BUSINESS_CARD` / `WIFI`), **прямой редирект** (`REDIRECT`), **скачать файл** (`FILE`, файл привязан к QR).
- При сканировании контент подставляется с заведения (fallback — старые FK на QR для обратной совместимости). API: `GET/PUT /api/establishments/[id]/page`.

## Ключевые маршруты фронтенда

- `/scan/:id` — страница-роутер: активация, микро-лендинг, быстрый раздел, редирект, файл или сбор отзывов
- `/dashboard/my-page` — единый контент заведения (меню, отзывы, визитка, Wi-Fi)
- **Демо QR (без БД)**: коды с префиксом `demo-` (`demo-landing`, `demo-review`, `demo-redirect`, `demo-business-card`, `demo-wifi`, `demo-file`, `demo-menu`) — конфиг в `src/lib/demo-qrcodes.ts`, рендер в `src/lib/render-demo-scan.tsx`. `demo-landing` — полный микро-лендинг со всеми разделами. На лендинге секция «Попробуйте демо». Префикс `demo-` нельзя занять при создании QR в API.
- **QR-визитка — «Связь» (опционально)**: в `/dashboard/settings` (блок «Каналы для уведомлений») владелец подключает Telegram (`/start link_mc_{userId}`), MAX (код `MC-{userId}`) или email; можно несколько каналов. В конструкторе визитки включается форма «Написать человеку» и выбирается канал. Гость указывает имя и сообщение; владелец получает в выбранный канал: название QR (label или code), IP, регион, браузер, устройство и текст. API: `GET/POST/DELETE /api/messenger-contacts`, `POST /api/business-cards/contact`.
- **Личный кабинет владельца** (`/dashboard/*`): активация таблички, дашборд статистики, смена ссылок, оплата Pro-тарифа
- **Личный кабинет администратора** (`/admin/*`): обзор платформы (статистика, рост), управление пользователями (поиск, смена роли/тарифа), подписки и платежи, все отзывы, все заведения. Вход: `/admin/login`, доступ только с ролью `ADMIN` в БД. API-роуты: `/api/admin/*` (защищены `requireAdmin()`). Доступы тестового админа: `admin@smartreview.ru` / `admin1234`

## Партнёрская программа

- **Страница**: `/dashboard/partner` — партнёрская ссылка, статистика, рефералы, история начислений, заявки на вывод
- **Регистрация по рефке**: `/register?ref=CODE` — реферальный код передаётся в API регистрации, пользователь привязывается к партнёру навсегда (`referredById`)
- **Комиссия**: 15% от каждого платежа реферала (подписка PRO). Начисление через 30 дней после оплаты (холд). API: `GET /api/partner`, `POST /api/partner/withdraw`
- **Вывод средств**: от 10 000 ₽ на расчётный счёт ИП/ООО. Заявка на вывод (`PartnerWithdrawal`) отправляет email админам. Админы обрабатывают вручную.
- **Модели БД**: `PartnerEarning` (начисления, статусы: PENDING → AVAILABLE → WITHDRAWN), `PartnerWithdrawal` (заявки на вывод, статусы: PENDING → APPROVED/REJECTED → PAID). Поля `referralCode` и `referredById` в модели `User`.
- **Webhook ЮKassa**: при успешной оплате подписки проверяется `referredById` платящего пользователя, создаётся `PartnerEarning` с `availableAt = now + 30 дней`

## Поддержка (Support)

- **Клиенты** пишут в `/dashboard/support` → API `GET/POST /api/support`, тикеты в БД (`SupportTicket`, `SupportMessage`). Вложения (до 20 МБ): изображения, PDF, документы, аудио/видео — в S3 (`support/{ticketId}/…`), двусторонний обмен с Telegram-форумом (`sendPhoto`/`sendDocument` и приём `photo`/`document`/…).
- **Оператор** отвечает в **Telegram-форуме** (супергруппа с темами): бот `@QrStarsSupportBot`, webhook `/api/telegram/support-webhook`, одна тема = один тикет.
- **Админка**: `/admin/support` — список тикетов, ссылки на темы, закрытие тикета.
- **Env**: `TELEGRAM_SUPPORT_BOT_TOKEN`, `TELEGRAM_SUPPORT_GROUP_ID` (ID супергруппы, например `-1001234567890`). Опционально `MAX_SUPPORT_ADMIN_USER_ID` — зеркало новых сообщений в MAX (ответы только из Telegram).
- **Уведомления об отзывах** — отдельный бот (`TELEGRAM_BOT_TOKEN`), не смешивать с support.
- **Новая регистрация** (`POST /api/auth/register`) — на **production** отправляется сообщение в общий канал `general` (без создания отдельной темы под пользователя) с email и ссылкой на админку; локально не шлётся.
- **BotFather**: для support-бота обязательно `/setprivacy` → **Disable**, иначе бот не получает обычные сообщения в группе (только /команды и reply на бота).


## Реальный стек (фактический, не aspirational)

| Слой | Технология |
|---|---|
| Фреймворк | **Next.js 16.2.6** (App Router), React 19, TypeScript 5 |
| Стили | **Tailwind CSS v4** (`@tailwindcss/postcss`), globals в `src/app/globals.css` |
| ORM / БД | **Prisma 7** (`@prisma/adapter-pg`) + PostgreSQL (прямое подключение через `pg`) |
| Аутентификация | **NextAuth v4** (`next-auth`) + `@next-auth/prisma-adapter` |
| Хранилище файлов | **Beget S3** (AWS SDK v3: `@aws-sdk/client-s3`), бакет `1919a3d97e3e-qrstarsru` |
| Платежи | **ЮKassa** (`src/lib/yookassa.ts`), webhook `/api/webhook/yookassa` |
| Email | **Nodemailer** (`src/lib/mailer.ts`) |
| Мессенджеры | Telegram Bot API (`src/lib/telegram.ts`), VK MAX (`src/lib/max.ts`) |
| Генерация QR | `qrcode` npm + `src/lib/qr-generator.ts` |
| PDF | `jspdf` (`src/lib/pdf-generator.ts`) |
| Rich-text | **Tiptap v3** (дашборд, меню, кастомные страницы) |
| Иконки | `lucide-react` |
| Графики | `recharts` (аналитика) |
| Валидация | `zod` v4 |
| E2E-тесты | **pytest** (`e2e/`, `conftest.py`, 20+ файлов) |
| Контейнеризация | Docker + docker-compose, продовый конфиг `deploy/docker-compose.prod.yml` |

> **Важно**: бэкенд — это **Next.js API-роуты** (`src/app/api/**`), никакого отдельного Python/Django нет.

## Структура проекта

```
src/
  app/
    api/              # Все API-эндпоинты (Next.js Route Handlers)
      activate/[id]/  # Активация QR-таблички
      admin/          # Защищённые роуты (requireAdmin)
      auth/           # NextAuth + регистрация + сброс пароля
      establishments/ # CRUD заведений + страница контента
      qrcodes/        # CRUD QR-кодов
      scan/[id]/      # Роутер при сканировании
      webhook/yookassa # Входящий webhook платежей
      … ещё ~20 роутов
    admin/            # UI: панель администратора
    dashboard/        # UI: ЛК владельца
    scan/[id]/        # UI: публичная страница при сканировании
    activate/[id]/    # UI: форма активации новой таблички
  components/
    ui/               # Базовые компоненты (Button, Input, Card, Badge…)
    dashboard/        # Редакторы (Menu, BusinessCard, ReviewRouting, WifiConfig…)
    scan/             # Публичные вьюшки (MicroLanding, MenuView, BusinessCardView…)
    admin/            # Сайдбар и компоненты админки
    activate/         # Форма активации
  lib/                # Вся бизнес-логика и утилиты
    auth.ts           # NextAuth config
    prisma.ts         # Singleton Prisma Client
    brand-theme.ts    # Генерация CSS-палитры по brandColor
    review-routing.ts # Логика маршрутизации отзывов (FREE/PRO)
    qr-routing.ts     # Логика роутинга при сканировании
    demo-qrcodes.ts   # Конфиг demo-* кодов (без БД)
    render-demo-scan.tsx # Рендер демо-сканирования
    yookassa.ts       # ЮKassa API
    telegram.ts / max.ts # Уведомления в мессенджеры
    s3.ts             # Работа с Beget S3
    mailer.ts         # Nodemailer
    … ещё ~15 утилит
  generated/prisma/   # Сгенерированный Prisma Client (не редактировать вручную)
  types/              # Глобальные TypeScript-типы

prisma/
  schema.prisma       # Схема БД (29 миграций)
  seed.ts             # Сид тестовых данных
  migrations/         # История миграций

e2e/                  # pytest e2e-тесты (запускаются через docker-compose.test.yml)
deploy/               # Скрипты деплоя, nginx-конфиг, docker-compose.prod.yml
public/               # Статика (изображения, стандартные обложки)
```

## Полный список моделей Prisma

`User` · `Establishment` · `EstablishmentMember` · `QRCode` · `Review` · `BusinessCard` · `CustomPage` · `FileAsset` · `QRMenu` · `QRMenuItem` · `WifiConfig` · `Template` · `MessengerContact` · `Subscription` · `PromoCode` · `PartnerEarning` · `PartnerWithdrawal` · `PasswordResetToken`

> Центральная сущность — `Establishment` (не `Business`, как в старых комментариях). Весь контент (меню, визитка, Wi-Fi, сценарии отзывов, брендинг) принадлежит заведению.

### Совместный доступ к заведению

- **Модель**: `EstablishmentMember` (`PENDING` / `ACTIVE`), уникальность `(establishmentId, email)`.
- **Владелец** приглашает по email в `/dashboard/establishments/[id]` (секция «Доступ команды»). API: `GET/POST /api/establishments/[id]/members`, `DELETE .../members/[memberId]`.
- **Зарегистрированный пользователь** → сразу `ACTIVE` + письмо о доступе. **Новый email** → `PENDING` + письмо со ссылкой `/register?establishmentInvite={token}`; превью: `GET /api/establishments/invite-preview?token=`.
- **Участник**: полный edit (контент, QR, настройки, аналитика). **Только владелец**: удаление заведения, управление участниками.
- **Лимиты**: 10 инвайтов/час на владельца, 5/час на заведение, макс. 10 участников. Чужие заведения не входят в лимит тарифа участника (`countUserEstablishments` — только `userId`).
- **PRO-фичи** заведения — по подписке **владельца** (`establishmentHasPaidFeatures` в `src/lib/establishment-access.ts`). Проверки доступа — `establishmentAccessWhere(userId)`.

### Меню iiko (PRO / Сеть)

- **Режим источника** `QRMenu.source`: `MANUAL` (редактор позиций) или `IIKO` (внешнее меню из iiko Cloud).
- **Настройка**: `/dashboard/my-page` → меню → переключатель **iiko**, API-login, «Проверить подключение» → `POST /api/menus/iiko/discover`. Позиции редактируются в **iikoWeb → Внешние меню** (типичное имя: «Сайт/приложение»).
- **Публичный показ**: при скане `/q/[code]` меню подгружается через `POST /api/2/menu/by_id` (кэш Redis 5 мин), рендер в `MenuView`.
- **Корзина + iiko**: при `cartEnabled` заказ уходит в iiko (`POST /api/1/deliveries/create`, типы заказов «Доставка самовывоз» / «Доставка Сайт», оплата `SITE`) и дублируется владельцу (email/Telegram/MAX). В форме гостя: самовывоз/доставка, телефон обязателен.
- **API**: `POST /api/menus/iiko/discover`, `POST /api/menus/iiko/preview`; поля iiko в `POST/PUT /api/menus`. API-login хранится зашифрованным (`IIKO_ENCRYPTION_KEY` или `NEXTAUTH_SECRET`), клиенту не отдаётся.
- **Категории в QR**: после предпросмотра — чекбоксы «Категории в QR-меню»; скрытые id в `QRMenu.iikoHiddenCategoryIds` (blacklist), фильтр при показе и в заказе.
- **Env**: `IIKO_API_BASE_URL` (default `https://api-ru.iiko.services`), опционально `IIKO_ENCRYPTION_KEY`.
- **Код**: `src/lib/iiko/`. E2E на отправку заказов в iiko не пишем (тестовые ключи без создания заказов).

## Команды разработки

```bash
npm run dev          # Запуск локального сервера (Next.js)
npm run build        # Продовая сборка
npx prisma migrate dev   # Применить новые миграции локально
npx prisma generate      # Перегенерировать Prisma Client после изменений схемы
npx prisma db seed       # Засидить тестовые данные
./deploy/deploy.sh       # Деплой на VPS (собирает образ, пушит, перезапускает)
```

E2E-тесты запускаются через `docker-compose.test.yml` (поднимает тестовую БД и само приложение).

---

Вноси изменения в этот файл при появлении новых фич или изменениях старых