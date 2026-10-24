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
   - **4–5★ с одной площадкой**: клик по звезде сразу уводит гостя на **форму отзыва** (`toPlatformReviewUrl` в `src/lib/review-platform-url.ts`: Яндекс `/maps/org/…/reviews/?add-review=1`, 2GIS `/firm/…/tab/reviews/addreview`). В БД хранится чистая ссылка карточки; если нормализация не удалась — открывается исходный URL. Отзыв пишется через `fetch` + `keepalive`. Промежуточный экран «Оставьте отзыв?» не показывается. Несколько площадок — выбор, затем тот же переход. Внутри iframe (демо на лендинге) — `window.open`, потому что Яндекс/2GIS не открываются во фрейме. Кнопка на шаге `thanks` — запасной путь, если редирект не случился.
   - **Контакт гостя (ПД)**: телефон / Telegram / email в жалобе, заявке и заказе из меню показываются **всегда**, без ИНН и юр. наименования. Согласие на ПД — при заполненном контакте; ссылка — политика заведения (`/privacy/{id}`), иначе платформенная `https://qrstars.ru/politika-konfidencialnosti.html`. Галочка **не блокирует** кнопку отправки (на смартфонах она уезжает под клавиатуру): при клике без согласия `useConsentGate` (`src/components/scan/use-consent-gate.ts`) убирает фокус с поля, скроллит к чекбоксу и подсвечивает его с подсказкой; отправка без галочки по-прежнему невозможна. Работает в форме жалобы (`ScanFlow`), заявке (`FormView`), визитке (`BusinessCardView`) и корзине меню (`MenuView`). Реквизиты в настройках проекта необязательны и нужны, чтобы реквизиты оператора попали в политику заведения. Решение: `legal/pd-guest-contacts.md`. Жалоба без контакта помечается в `/dashboard/reviews`.
   - **Email о жалобе**: `POST /api/reviews` шлёт письмо на все email-цели (`getEmailTargets`), при их отсутствии — на `user.email`; сбой SMTP логируется и не роняет запрос. Транспорт: Beget SMTP (`smtp.beget.com:465`, `noreply@qrstars.ru`). SMTP-accept **не** равен доставке: disposable (Mailinator) даёт bounce `retry timeout exceeded` на `noreply@`. Кнопка «Проверить» ждёт bounce ~8 с и показывает ошибку; в канале Email — статус последней отправки (`MessengerContact.lastEmail*`). Логи: `Email sent` (`response`/`accepted`/`rejected`/`messageId`) и `Email bounced`.

## Бизнес-модель

- **Продажа табличек** (разовый доход): себестоимость ~550 ₽, розница 1 200 ₽, чистая прибыль ~650 ₽. Продажа через Wildberries / Ozon.
- **Freemium SaaS** (рекуррентный доход): ядро FREE навсегда, платные тарифы PRO и «Сеть». Конфиг: `src/lib/plans.ts` — единственный источник цен, в UI/письмах суммы не хардкодить.

### Тарифы (актуально)

| Тариф | Цена | Заведения |
|---|---|---|
| **FREE** | 0 ₽ | 1 |
| **PRO** | 990 ₽/год (только год, ≈83 ₽/мес) | 1 |
| **Сеть** | 2 900 ₽/год (только год, с 2026-10-14) | до 5; больше — индивидуальный тариф через поддержку в ЛК (`CUSTOM_PLAN_HINT`) |

QR-кодов внутри заведения — **без лимита** на всех тарифах. Тарификация по числу заведений. Старые помесячные подписки «Сети» продолжают считаться по прежней схеме (600 ₽/мес + 150 ₽ за точку сверх 2, `calcLegacyNetworkMonthlyPrice`), новые — только годовые.

### Free vs Pro vs Сеть

| Функция | Free | Pro | Сеть |
|---|---|---|---|
| Маршрутизация 5★ | 1 площадка | Умная ротация (+ Flamp) | Как PRO на каждой точке |
| Жалобы (1–3★) | Email | Telegram + MAX | Как PRO |
| Вотермарка | QrStars | White Label | White Label сети |
| Микросайт (`LANDING`) | Нет (старые QR сохранены) | Да | Как PRO |
| Лояльность / чаевые | Нет | Да | Да |
| Аналитика | Базовая | Расширенная | Сводный дашборд сети + CSV |
| Заведения | 1 | 1 | до 5 |

## Путь пользователя

1. **Фабрика**: партия табличек с уникальными динамическими QR-кодами (`qr.site.ru/id001`), коды пока «пустые».
2. **Маркетплейс**: владелец покупает табличку на WB / Ozon.
3. **Активация**: владелец сканирует QR → форма (название заведения, email, ссылка на Яндекс.Карты) → код привязывается к заведению, на почту уходит пароль от личного кабинета.
4. **Саморегистрация (без таблички)**: `/register` → `/dashboard/start` (параметр `?plan=pro|network` с лендинга доезжает до мастера, на финальном экране — кнопка «Оформить PRO/Сеть» → `/dashboard/subscription`) — мастер «первый запуск» (`POST /api/setup/quick-start`: проект + QR; для `REVIEW` — ссылка Яндекс; intent `landing` — только PRO/«Сеть»). `?intent=redirect` сразу открывает форму прямой ссылки: спрашивает название проекта, метку QR и URL, создаёт проект и привязанный QR. Раздел `/dashboard/projects/unassigned/qrcodes` остаётся для старых кодов без проекта. Пока нет своего проекта и QR без проекта, остальные страницы дашборда редиректят на `/dashboard/start`.
5. **Использование**: гости сканируют QR на столе, система фильтрует трафик.

## Стек технологий

- **Фронтенд**: React / Next.js (этот репозиторий)
- **Бэкенд / API**: Node.js или Python (Django/FastAPI)
- **БД**: PostgreSQL / Supabase
- **Платежи**: Robokassa (рекуррентные подписки, 54-ФЗ через параметр `Receipt`)
- **Уведомления**: VK API, SMS-шлюз (SMS.ru)

## Ключевые сущности БД

- **User** (владелец заведения)
- **Business** (заведение)
- **QRCode** (уникальный QR, привязывается к Business при активации)
- **Review** (отзыв / жалоба)

## Продакшен

- **Приложение**: https://app.qrstars.ru (VPS `109.69.17.233`, Docker: `/opt/qrstars/deploy`)
- **Лендинг**: https://qrstars.ru / https://www.qrstars.ru — nginx отдаёт статику с диска VPS `/var/www/qrstars` (не из S3). Деплой: `cd landing && npx astro build && rsync -az dist/ root@109.69.17.233:/var/www/qrstars/` (без `--delete`, чтобы старые URL жили). Копия в S3-бакете `1919a3d97e3e-website` на сайт не влияет. `/q|scan|activate/` на qrstars.ru проксируются в апстрим `qrstars_app` (`deploy/nginx/qrstars.ru.conf`; `deploy.sh` этот файл не ставит — копировать вручную)
- **Файлы (логотипы, загрузки)**: https://s3.qrstars.ru (Beget S3, бакет `1919a3d97e3e-qrstarsru`)
- **Деплой**: `./deploy/deploy.sh` с локальной машины. В `Dockerfile` apk берёт пакеты с `mirror.yandex.ru/mirrors/alpine`: dl-cdn.alpinelinux.org с VPS отвечает десятки секунд, и сборка зависала на `apk add`
- **SSL**: certbot systemd timer (`certbot.timer`, 2× в сутки) + hook `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh`
- **TLS**: только **TLS 1.2** (1.3 выключен 2026-10-14: у части клиентов в РФ его режет ТСПУ). Nginx берёт `ssl_protocols` из default server на `:443` (`app.qrstars.ru`), поэтому настройка действует на все сайты VPS (в т.ч. uxcheck.ru, praktikaai.ru). На каждом домене два сертификата: ECDSA + RSA (`app.qrstars.ru-rsa`, `qrstars.ru-rsa`, `qrstars.ru-wildcard-rsa`) для старых клиентов без ECDSA. `qrstars.ru.conf` не подключает `options-ssl-nginx.conf`, TLS-параметры прописаны явно. Wildcard `*.qrstars.ru` — DNS-01 через Beget без API: `deploy/acme-dns-wait.sh` пишет значение TXT в `/root/acme-challenge.txt` и ждёт, пока запись `_acme-challenge.qrstars.ru` добавят вручную

## Правила разработки

- **Автотесты**: при добавлении нового крупного функционала (новый режим QR-кода, новая фича в дашборде, новый API-эндпоинт) необходимо писать e2e-тесты (pytest, папка `e2e/`). Тесты должны покрывать позитивные и негативные сценарии.
- **Проверка на сервере**: после каждого деплоя (`./deploy/deploy.sh`) обязательно проверить ключевые эндпоинты продакшена (`https://app.qrstars.ru`), чтобы убедиться, что приложение запустилось корректно:
  1. Проверить health/load главной страницы: `curl -s -o /dev/null -w "%{http_code}" https://app.qrstars.ru/`
  2. Проверить API: `curl -s -o /dev/null -w "%{http_code}" https://app.qrstars.ru/api/auth/csrf`
  3. Проверить демо-скан: `curl -s -o /dev/null -w "%{http_code}" https://app.qrstars.ru/scan/demo-review`
  4. Если какой-то эндпоинт вернул не 200 — посмотреть логи контейнера: `ssh root@109.69.17.233 "docker logs deploy-app-1 --tail 50"`

## Архитектура контента и QR-маршрутизации

- **Контент проекта** (меню, визитка, Wi-Fi, сценарии отзывов) хранится на уровне `Establishment` и в кабинете редактируется как **микросайт** (`/dashboard/projects/[projectId]/page`). Старые URL `/dashboard/my-page` редиректят сюда. Тумблеры `pageModules` управляют блоками. **Оформление**: `brandColor` (7 пресетов + свой HEX), `pageAppearance` (`light` / `dark`), `coverUrl`, `logoUrl` — палитра UI генерируется в `src/lib/brand-theme.ts`; акцент визитки синхронизируется с `brandColor`. Стандартные обложки — файлы `public/covers/` (`src/lib/standard-covers.ts`), в БД путь вида `/covers/coffee.jpg`. Внешние CDN (Unsplash) не используются; миграция `20261014090000_local_standard_covers` переписывает старые ссылки. В Open Graph относительный путь дополняется до `https://app.qrstars.ru/covers/…` (`absolutePublicUrl`).
- **QR-код** (`/dashboard/projects/[projectId]/qrcodes/[qrId]`, старые `/dashboard/qrcodes/[id]` редиректят) — только **маршрутизация**: 4 группы — **микросайт** (`LANDING`, PRO/«Сеть»; QR, которые были `LANDING` до перевода в платный тариф, сохраняют показ и редактирование на FREE через `landingGrandfathered`), **быстрый доступ к разделу** (`MENU` / `REVIEW` / `BUSINESS_CARD` / `WIFI`), **прямой редирект** (`REDIRECT`), **скачать файл** (`FILE`, файл привязан к QR). Новый `LANDING` и переключение в него на FREE — `403`. Отдельные REVIEW, меню, визитка, Wi‑Fi и редирект остаются бесплатными. На FREE карточка «Микросайт» не задизейблена: клик открывает paywall-модалку `src/components/dashboard/LandingProPaywall.tsx` (что такое микросайт, зачем нужен, остальные возможности PRO из `PLANS.PRO.features`, цена из `PLAN_PRICING.PRO`, кнопки «Подключить PRO» → `/dashboard/subscription` и демо `/q/demo-landing`). Удаление: кнопка «Удалить» в списке QR и в карточке, `DELETE /api/qrcodes?id=`. Доступ как у редактирования (владелец и участник). Отзывы, заказы и заявки остаются без кода. Ссылка `/q/{code}` после удаления показывает заглушку «QR-код не активирован».
- При сканировании контент подставляется с заведения (fallback — старые FK на QR для обратной совместимости). API: `GET/PUT /api/establishments/[id]/page`.
- **Пробный PRO удалён 2026-10-04** (решение владельца: ни триала, ни замены). Новые триалы не создаются: `src/lib/pro-trial.ts`, `/api/subscription/trial`, `ProTrialBanner`, trial-карточки в мастере/paywall/`/dashboard/subscription` удалены. Legacy оставлен намеренно: колонки `User.proTrialStartedAt` и `Subscription.isTrial` (без деструктивной миграции), миграция `20260917000000_pro_trial`, а также логика гашения уже выданных активных триалов в `subscription-renewal.ts` (`CANCELED` по `currentPeriodEnd`, письма `sendTrialEndingEmail` / `sendTrialEndedEmail`).
- **После окончания платного доступа микросайт не выключается**: `User.firstPaidAccessAt` (ставится при первой оплате (и при старте ранее выданных триалов), бэкфилл в миграции `20260917000000_pro_trial` по существующим PRO/NETWORK-подпискам) держит страницу опубликованной, чтобы напечатанные таблички работали. Правки при этом заморожены: `isMicrositeFrozen` в `src/lib/qr-mode-access.ts`, `PUT /api/establishments/[id]/page` отдаёт `403` (`MICROSITE_FROZEN_ERROR`) на поля состава плиток и оформления, контент разделов (меню, визитка, Wi-Fi, отзывы) правится как обычно. Внизу такого микросайта — блок-ссылка на qrstars.ru (`micrositePromo` в `MicroLandingView`). Legacy-микросайты (`landingGrandfathered`) не замораживаются и остаются со скромной подписью, в демо подписи нет.
- **Внешние редиректы** (`REDIRECT`, `CUSTOM_SECTION` типа `LINK`): URL прогоняется через `toHeaderSafeUrl` (`src/lib/redirect-url.ts`) — percent-кодирование не-ASCII (кириллица в ссылках Яндекс.Карт), punycode для домена, вырезание управляющих символов. Заголовок `Location` допускает только ASCII, иначе `TypeError: Invalid character in header content`. Нормализация применяется и при чтении (legacy-записи), и при сохранении в `POST/PUT /api/qrcodes`. Невалидный URL → заглушка «Ссылка указана неверно» вместо 500.
- **Отдача загруженных файлов**: при загрузке MIME определяется по заголовку браузера, иначе по расширению (`normalizeContentType`), и в S3 пишется `Content-Disposition` (`buildContentDisposition` в `src/lib/file-assets.ts`). Картинки, текст, PDF, видео/аудио → `inline` (открываются в браузере), остальное → `attachment`. Активные типы (`text/html`, `image/svg+xml`, XML) всегда `attachment`: файлы отдаются с `/storage/` того же origin, что и сессия. Nginx на `/storage/` шлёт `X-Content-Type-Options: nosniff`. `FileDownloadView` для inline-типов делает основной кнопкой «Открыть» (для картинок — превью), скачивание — вторичной ссылкой.

## Ключевые маршруты фронтенда

- `/scan/:id` — страница-роутер: активация, микросайт, быстрый раздел, редирект, файл или сбор отзывов
- **Адрес микросайта**: короткое имя проекта (`Establishment.shortSlug`, поле в редакторе микросайта) открывает страницу как `https://{slug}.qrstars.ru` и по-прежнему как `/a/{slug}`. Поддомен только у корня `/`, QR остаются на `app.qrstars.ru/q/{code}`. Имя: 2–32 символа, латиница, цифры, дефис; `app`, `www`, `s3` и другие служебные заняты (`src/lib/microsite-host.ts`). Nginx `deploy/nginx/wildcard.qrstars.ru.conf` включается, когда выпущен сертификат `/etc/letsencrypt/live/qrstars.ru-wildcard/`. DNS: A `*.qrstars.ru` → VPS.
- **Кабинет проектов** (UI «Проект» = `Establishment`):
  - `/dashboard` → последний или единственный проект
  - `/dashboard/projects` — список проектов
  - `/dashboard/projects/[projectId]` — главная проекта
  - `/dashboard/projects/[projectId]/page` — микросайт (бывш. `/dashboard/my-page`)
  - `/dashboard/projects/[projectId]/card` — редактор QR-визитки (пункт сайдбара «Визитка», если у проекта есть визитка)
  - `/dashboard/projects/[projectId]/qrcodes` — QR-коды проекта
  - `/dashboard/projects/[projectId]/inbox` — обратная связь (отзывы и заявки)
  - `/dashboard/projects/[projectId]/stats` — статистика
  - `/dashboard/projects/[projectId]/settings` — настройки проекта
  - `/dashboard/network` — «Сводка по сети»: кросс-проектная аналитика для тарифа «Сеть» (на других тарифах — апсейл). Пункт в сайдбаре виден только на NETWORK
  - Старые URL `/dashboard/my-page`, `/dashboard/qrcodes`, `/dashboard/establishments`, `/dashboard/reviews`, `/dashboard/submissions`, `/dashboard/analytics` редиректят в проект
- **Шаблоны оформления** (`/dashboard/settings/templates`, аккаунт): стили QR-кодов для всех проектов. Старые `/dashboard/templates`, `/dashboard/templates/qr` редиректят сюда. Привязка стиля — в карточке QR.
- **Общий движок QR** (`src/lib/qr-engine/`, без зависимостей и `@/`-алиасов): отрисовка в базовых координатах (код = 600, масштаб через `ctx.scale` — превью, PNG любого размера и SVG совпадают), `SvgContext` (настоящий векторный SVG той же отрисовкой; фото и логотипы — вложенные data-URL), `palette.ts` (случайные палитры с контрастом ≥ 4.5), `payload.ts` (данные статических QR с проверкой), `scan.ts` (`checkScanLevel` — проверка декодером, `jsQR` передаётся снаружи). Им пользуются и кабинет (`src/lib/qr-free-generator.ts` → `renderQRTemplate`/`renderQRTemplateSvg` в `qr-code-templates.ts`), и лендинг (импорт `../../../src/lib/qr-engine`, для dev-сервера `vite.server.fs.allow: ['..']` в `landing/astro.config.mjs`). Библиотеку `qrcode` каждая сторона подключает сама. Юнит-тесты: `src/lib/qr-engine/payload.test.ts`.
- **Арт-режимы QR** (`src/lib/qr-engine/art.ts` + `render.ts`, юнит-тесты `art.test.ts`): формы точек `dots`, `diamond`, `liquid` (перетекающие модули с вогнутыми скруглениями), `splash` (жидкие у логотипа, точки дальше), `halftone` (растр 3×3 на модуль); `photoStyle: "halftone"` — фото-гравюра (Флойд — Стейнберг, центр модуля 3/7 клетки принудительно, светлое кольцо в модуль вокруг кода — без него тёмный дизеринг ломает поисковые узоры); `silhouette` — код во вписанном квадрате фигуры (пресеты-пути 100×100 или своя картинка `silhouetteDataUrl`: прозрачный PNG или тёмный силуэт), остальная фигура засыпается модулями; `rotate45` — ромб, логотип ровный, проверка jsQR поворачивает картинку обратно (jsQR плохо читает 45°, камеры — нормально); `inkShift` — сдвинутые голубой/жёлтый слои. В «точечных» стилях выравнивающие узоры рисуются сплошными — иначе jsQR теряет сетку. С силуэтом и ромбом рамка не рисуется. SVG поддерживает `translate/rotate` (атрибут `transform`). **Совместимость**: все арт-поля необязательные, `normalizeQRTemplateConfig` их не дописывает, `classic`/`rounded` рисуются как раньше; фото-режим `overlay` повторяет продовый (белая/чёрная подложка 0.6, сплошная дырка глазков). Арт-стили в один клик — общий список `src/lib/qr-engine/art-presets.ts` (33 стиля по аудиториям: арт, мастера, медицина, авто, красота и спорт, еда и магазины): лендинг показывает их блоком «Арт-стили» с фильтром (на десктопе сначала 2 ряда), кабинет — разделом «Арт-стили» в «Готовых стилях» (`QRTemplatePreset.art`, id `qr-preset-{id}`) и одноимённым разделом в редакторе стиля (категории, сначала 2 ряда; свой загруженный логотип и фото при смене стиля сохраняются). Фигуры: сердце, зуб, кот, облако, чат, щит, капля, дом, чашка, круг, шестерёнка, метка, крест, машина, пакет, футболка, лапа, звезда, соты, корона. **Совместимость**: `id` стилей и фигур хранятся в QR — не переименовывать, вид существующих не менять, новые — в конец; новые эмодзи-логотипы — только в конец `LOGO_PRESETS`/`FREE_LOGO_PRESETS` (на лендинге в `#lp=` хранится номер). Тест `art.test.ts` проверяет уникальность id и контраст цветов ≥ 4.5. Стили с фигурой не стоит делать на `rounded` — зазоры смешивают код с узором, jsQR его теряет. `ensureQrStylePresets(id)` при привязке к QR апсертит только выбранный пресет. Цели Метрики `qr_art_preset`, `qr_art_category`. **Галерея на главной лендинга** (`landing/src/components/QrGallery.astro`, сразу после полосы доверия): 12 статичных WebP в `landing/public/images/qr-gallery/{id}.webp`, отрисованных движком на `https://qrstars.ru` (камера с экрана открывает сайт); клик → `/free-qr-generator.html?art={id}`, генератор применяет стиль, если в ссылке нет `#hash`. Поменяли вид стиля — перегенерировать картинку. Цель Метрики `qr_gallery_click`. **Меню оформления** (лендинг и редактор кабинета): сразу открыты только «Арт-стили» и «Цвет» (в кабинете ещё «Содержимое»), остальные разделы свёрнуты с текущим значением в заголовке. «Узор вокруг кода» и фигуры объединены в раздел «Форма кода»: «Квадрат / Фигура / Узор вокруг» (фигура важнее узора; поля `scatter*` и `silhouette*` не менялись, старые ссылки открываются в нужном режиме). Фигуры — сеткой силуэтов (`renderSilhouettePreview`). Логотипы на десктопе — два ряда и «+N», выбранный не прячется.
- **Бесплатный генератор на лендинге** (`landing/src/pages/free-qr-generator.astro`, свои модули — `landing/src/lib/qr-generator/style-transfer.ts`, `deliver.ts`): статические QR без регистрации — ссылка, Wi‑Fi, Telegram, WhatsApp, оплата по реквизитам (ГОСТ Р 56042, `ST00012`, это не QR СБП), карточка Яндекс Карт / 2ГИС (с блоком про QR для отзывов), текст, телефон, email, vCard, SMS. В центре — логотип или текст до 3 строк. Экспорт: PNG и JPG 600/1200/2000 px (ширина всей картинки), SVG. Сканируемость проверяет jsQR в фоне (через 400 мс после ввода). «Случайное оформление» перепроверяет результат декодером. На телефоне «Сохранить» открывает системное «Поделиться», превью по тапу — полноэкранный просмотр с макетами (табличка, визитка, витрина). После первого скачивания показывается карточка про динамический QR. Настройки (кроме загруженных картинок) живут в `#hash`.
- **Редактор стиля QR в кабинете** (`src/components/dashboard/QRTemplateEditor.tsx`, макеты — `QRMockupDialog.tsx`): тот же движок. Секции сворачиваются; на <1024px редактор во весь экран, внизу панель с миниатюрой (тап — крупный просмотр и все форматы), «Сохранить» и PNG. Скачивание: PNG / PNG без фона / JPG на 600–2400 px (ширина картинки) и векторный SVG. Предупреждение о сканировании — jsQR в фоне. «Случайный дизайн» перебирает до 5 вариантов, пока декодер читает код. Логотип или текст в центре поднимают коррекцию до H. «Сохранить» **не** привязывает стиль к QR сам: только при открытии из карточки QR (`bindQrId`) или по явной галочке «Применить к QR». Ошибки сохранения/привязки показываются в редакторе. Фото-режим сохраняется в шаблоне (`photoSrc` — пресет, `photoDataUrl` — загруженное фото, JPEG ≤1200 px); свой логотип ужимается до 512 px PNG. Закрытие с несохранёнными изменениями спрашивает подтверждение, Esc закрывает. Скачивание из карточки и списка QR (`src/lib/qr-download.ts`) тоже даёт векторный SVG.
- **API стилей**: `PUT /api/qrcodes` принимает `qrStyleTemplateId` только встроенного (публичного) стиля или своего — пользователя либо владельца QR; иначе 400. `POST/PUT /api/templates` игнорируют `isPublic` (публичные — только встроенные пресеты) и отклоняют `layout` больше 1,5 МБ (`src/lib/template-layout.ts`). E2E: `e2e/test_qr_style_templates.py`.
- **Перенос дизайна из генератора в кабинет**: если на лендинге меняли оформление или скачивали код, клик по ссылке `app.qrstars.ru/register…` добавляет `?qr_style=` (base64url JSON, формат — `src/lib/generator-style.ts`). `/register` запоминает его в `localStorage` (переживает вход через VK / Яндекс). Уже залогиненного пользователя `/register` редиректит на `/dashboard/settings/templates?qr_style=`. `GeneratorStyleImporter` в `dashboard/layout.tsx` вызывает `POST /api/templates/from-generator`: шаблон «Мой стиль из генератора», `layout.source = "free-generator"`, тот же дизайн повторно не создаётся, максимум 10 таких шаблонов. `POST /api/setup/quick-start` ставит этот стиль на **первый** QR пользователя вместо отраслевого пресета. Свой загруженный логотип и фото не переносятся (только эмодзи-пресеты и логотип QrStars). E2E: `e2e/test_generator_style_import.py`.
- **Демо QR (без БД)**: коды с префиксом `demo-` (`demo-landing`, `demo-review`, `demo-2gis`, `demo-redirect`, `demo-business-card`, `demo-wifi`, `demo-file`, `demo-menu`) — конфиг в `src/lib/demo-qrcodes.ts`, рендер в `src/lib/render-demo-scan.tsx`. `demo-review` направляет 4–5★ на Яндекс, `demo-2gis` — в 2GIS. `demo-landing` — полный микросайт со всеми разделами. На лендинге секция «Попробуйте демо». Префикс `demo-` нельзя занять при создании QR в API.
- **QR-визитка — «Связь» (опционально)**: в `/dashboard/settings` (блок «Каналы для уведомлений») email регистрации создаётся как канал по умолчанию (`ensureDefaultEmailContact`, тумблеры «Отзывы»/«Заявки» включены). Владелец **один раз** подключает Telegram (`/start link_mc_{userId}` или код `MC-{userId}`) или MAX; можно добавить другой email. В настройках **заведения** — галочки типов уведомлений; в конструкторе визитки — выбор канала для формы «Оставить заявку». Гость указывает имя, сообщение и (необязательно) телефон — согласие на ПД появляется, когда телефон заполнен; владелец получает в выбранный канал: название QR (label или code), IP, регион, браузер, устройство и текст. API: `GET/POST/DELETE /api/messenger-contacts`, `POST /api/business-cards/contact`.
- **QR-визитка мастера** (гипотеза: электрики, сантехники, мастера на час; трафик от блогеров): `intent=card` в мастере `/dashboard/start` — один экран (имя, профессия, телефон, «есть WhatsApp», Telegram, район) → `POST /api/setup/quick-start` создаёт проект (имя = имя человека), `BusinessCard` (привязана к проекту и к QR) и QR `BUSINESS_CARD`. Форма заявки включается сразу на лучший канал владельца (Telegram > MAX > email регистрации). Синонимы `?intent=business_card|vizitka`. Поля визитки: `whatsapp`, `telegram`, `maxUrl` (крупные кнопки; старые WhatsApp/Telegram из `socialLinks` тоже поднимаются в кнопки), `services` (`[{name, price}]`, ≤30), `serviceArea`, `workHours`, `reviewsUrl` («Отзывы обо мне»). Общая логика — `src/lib/business-card.ts` (`toPublicBusinessCard`, нормализация, `wa.me`/`t.me`/`tel:`, отсечение не-http ссылок, vCard с экранированием). Редактор — `/dashboard/projects/[id]/card` (`ProjectCardEditor`, живое превью; фото грузится через `/api/file-assets/upload` с ужатием до 512 px), пункт «Визитка» в сайдбаре — только у проектов с визиткой. `POST /api/business-cards/contact` берёт визитку как страница скана: проекта, иначе FK QR. OG у `/q/{code}` в режиме визитки — имя, профессия и аватар человека. Отрасль `SERVICES` («Мастер / услуги на выезде») выводится из UTM (`master`, `электрик`, `ремонт`…). Лендинг: `landing/src/pages/qr-vizitka-mastera.astro` (CTA `cardRegisterUrl`, кампания `master_card`), демо `/q/demo-master`. Цель Метрики `setup_completed_card`. E2E: `e2e/test_business_card_master.py`.
- **Активация набора табличек** (`POST /api/activate-batch`): привязка к существующему проекту — только залогиненным с доступом к проекту (`establishmentAccessWhere`, иначе 401/404); без сессии на существующий email — только с верным паролем (иначе 401); при создании проекта проверяется лимит тарифа (403 `upgradeRequired`).
- **Мобильная вёрстка кабинета**: страницы оборачивают контент в `<main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">` (без `min-w-0` flex-ребёнок не сужается и таблицы обрезаются). Поля ввода на <640px — 16px (глобальное правило в `globals.css`, иначе iOS зумит). На <1024px онбординг-тур — короткая нижняя карточка, баннер UXCheck — только на главной проекта. После создания/удаления проекта — `window.dispatchEvent(new Event("qrstars:projects-changed"))`, сайдбар перечитывает список.
- **Личный кабинет владельца** (`/dashboard/*`): активация таблички, дашборд статистики, смена ссылок, оплата Pro-тарифа. Оболочка кабинета — `src/components/dashboard/DashboardChrome.tsx` (рендерится в `dashboard/layout.tsx`): сайдбар один на все страницы, на &lt;1024px скрыт в drawer с гамбургером. Отдельные страницы `Sidebar` **не** импортируют. `/dashboard/start` (мастер) — без сайдбара. 404 внутри кабинета — `src/app/dashboard/not-found.tsx`.
- **Ссылка на Яндекс.Карты**: короткие `yandex.ru/maps/-/…` не сохраняются вслепую (могут вести на чужую организацию). `POST /api/yandex-maps/preview` резолвит редиректы (только yandex-хосты, таймаут 6 с) и возвращает название + канонический `/maps/org/…`; generic-заголовок главной Яндекс.Карт / org без карточки — ошибка, подтвердить нельзя. UI — `YandexMapsOrgConfirm` в мастере `/dashboard/start` и настройках заведения. В мастере отзывов: сначала «Проверить ссылку», после «Да, это мы» QR создаётся сразу. `PUT /api/settings` валидирует `yandexMapsUrl`. Поиск (`/maps/search/`) — по-прежнему ошибка.
- **Отрасль проекта**: опциональное поле `Establishment.industry` (`HORECA`, `BEAUTY`, `AUTO`, `CLINIC`, `HOTEL`, `SERVICES`, `OTHER`) выбирается на шаге сценариев `/dashboard/start`, может предзаполняться из UTM и редактируется в настройках проекта. `OTHER` в UI — «Спикер / мероприятие / другое». Отрасль задаёт дефолтный QR-стиль и тексты формы отзыва; для не-HoReCa QR-меню уходит в конец списка.
- **Настройки аккаунта** (`/dashboard/settings`): каналы уведомлений, шаблоны оформления QR (`/dashboard/settings/templates`), пароль (OAuth-пользователь может создать первый пароль), удаление аккаунта как идемпотентный запрос в поддержку. У email-канала есть защищённая кнопка тестового письма; адрес берётся только из принадлежащего пользователю `MessengerContact`.
- **Личный кабинет администратора** (`/admin/*`): обзор платформы (статистика, рост), управление пользователями (поиск, смена роли/тарифа), подписки и платежи, все отзывы, все заведения. Вход: `/admin/login`, доступ только с ролью `ADMIN` в БД. API-роуты: `/api/admin/*` (защищены `requireAdmin()`). Доступы тестового админа: `admin@smartreview.ru` / `admin1234`

## Вход через VK ID

- На `/login` используется OneTap из `@vkid/sdk` 2.x с `scope: email`; старый `oauth.vk.com` не используется.
- Фронт получает `code` и `device_id`, а серверный `POST /auth/vk` обменивает код через `https://id.vk.ru/oauth2/auth`, читает профиль через `/oauth2/user_info`, связывает пользователя сначала по `vkId`, затем по email и выдаёт JWT-cookie NextAuth.
- Новому VK-пользователю пароль не создаётся; выполняются стандартные post-registration действия (email-канал, pending-инвайты, Telegram-уведомление, welcome email).
- Redirect URL: `https://app.qrstars.ru/auth/vk/callback`. В кабинете VK ID базовый домен должен быть `app.qrstars.ru`, иначе SDK получит CORS/code 8.
- ID приложения: `54734947`.
- Env: серверные `VK_CLIENT_ID`, `VK_SERVICE_TOKEN`, `VK_REDIRECT_URI`; build-time публичные `NEXT_PUBLIC_VK_CLIENT_ID`, `NEXT_PUBLIC_VK_REDIRECT_URI`. `VK_CLIENT_SECRET` может храниться в env приложения, но текущий OAuth 2.1 flow использует service token и не передаёт секреты во фронт.
- E2E: `e2e/test_vk_auth.py`, mock VK ID API — `e2e/vk_id_mock.py`.

## Вход через Яндекс ID

- На `/login` кнопка ведёт в серверный OAuth-flow: `GET /auth/yandex` → Яндекс → `GET /auth/yandex/callback`. `clientSecret` во фронт не передаётся.
- Callback проверяет `state` из HttpOnly-cookie, обменивает код на токен через `https://oauth.yandex.ru/token`, читает профиль через `https://login.yandex.ru/info`, связывает пользователя сначала по `yandexId`, затем по email и выдаёт JWT-cookie NextAuth.
- Новому Яндекс-пользователю пароль не создаётся; выполняются стандартные post-registration действия (email-канал, pending-инвайты, Telegram-уведомление, welcome email).
- Redirect URL: `https://app.qrstars.ru/auth/yandex/callback`.
- Env: `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`, `YANDEX_REDIRECT_URI`. Секрет хранится только в env приложения.
- E2E: `e2e/test_yandex_auth.py`, mock Яндекс ID API — `e2e/yandex_id_mock.py`.

## Партнёрская программа

- **Страница**: `/dashboard/partner` — партнёрская ссылка, статистика, рефералы, история начислений, заявки на вывод
- **Регистрация по рефке**: `/register?ref=CODE` — реферальный код передаётся в API регистрации, пользователь привязывается к партнёру навсегда (`referredById`). При входе через VK / Яндекс код переживает OAuth в cookie `qrstars_reg_ref` (как UTM). Лендинг пробрасывает `?ref=` в ссылки `/register` и помнит его 30 дней (`localStorage`, скрипт в `landing/src/layouts/Layout.astro`), так что блогер может давать ссылку на любую страницу qrstars.ru
- **Комиссия**: 15% от каждого платежа реферала (подписка PRO). Начисление через 30 дней после оплаты (холд). API: `GET /api/partner`, `POST /api/partner/withdraw`
- **Вывод средств**: от 10 000 ₽ на расчётный счёт ИП/ООО. Заявка на вывод (`PartnerWithdrawal`) отправляет email админам. Админы обрабатывают вручную.
- **Модели БД**: `PartnerEarning` (начисления, статусы: PENDING → AVAILABLE → WITHDRAWN), `PartnerWithdrawal` (заявки на вывод, статусы: PENDING → APPROVED/REJECTED → PAID). Поля `referralCode` и `referredById` в модели `User`.
- **Webhook Robokassa** (`GET /api/webhook/robokassa/result`): при успешной оплате активирует/продлевает подписку; проверяется `referredById` → `PartnerEarning` (15%, холд 30 дней)

## Поддержка (Support)

- **Клиенты** пишут в `/dashboard/support` → API `GET/POST /api/support`, тикеты в БД (`SupportTicket`, `SupportMessage`). Вложения (до 20 МБ): изображения, PDF, документы, аудио/видео — в S3 (`support/{ticketId}/…`), двусторонний обмен с Telegram-форумом (`sendPhoto`/`sendDocument` и приём `photo`/`document`/…).
- **Оператор** отвечает в **Telegram-форуме** (супергруппа с темами): бот `@QrStarsSupportBot`, webhook `/api/telegram/support-webhook`, одна тема = один тикет. Ответ сохраняется в ЛК (`/dashboard/support`) и дублируется на email пользователя (`sendSupportStaffReplyEmail`).
- **Админка**: `/admin/support` — список тикетов, ссылки на темы, закрытие тикета.
- **Env**: `TELEGRAM_SUPPORT_BOT_TOKEN`, `TELEGRAM_SUPPORT_GROUP_ID` (ID супергруппы, например `-1001234567890`). Опционально `MAX_SUPPORT_ADMIN_USER_ID` — зеркало новых сообщений в MAX (ответы только из Telegram).
- **Уведомления об отзывах / привязка аккаунта** — бот `@QrStarsBot` (`TELEGRAM_BOT_TOKEN`, webhook `/api/telegram/webhook`), не смешивать с support.
- **Новая регистрация** (`POST /api/auth/register`) — на **production** отправляется сообщение в общий канал `general` (без создания отдельной темы под пользователя) с email и ссылкой на админку; локально не шлётся.
- **BotFather**: для support-бота обязательно `/setprivacy` → **Disable**, иначе бот не получает обычные сообщения в группе (только /команды и reply на бота).

## Отчёты админу (Telegram)

### Дневной

- **Что приходит**: сканирования, регистрации, новые заведения, **новые QR-коды**, отзывы, онбординг, PRO/Сеть, заказы меню, тикеты поддержки; топ заведений/QR/регионов — **только за вчера**, без сравнения с предыдущим периодом.
- **Период**: вчерашний календарный день (МСК).
- **API**: `POST /api/cron/daily-report` с заголовком `Authorization: Bearer $CRON_SECRET` (или `?secret=`).
- **Cron на VPS**: `deploy/daily-report.sh` — ежедневно 09:00 МСК: `0 6 * * * /opt/qrstars/deploy/daily-report.sh`.
- **Env**: `CRON_SECRET` (обязательно), `TELEGRAM_SUPPORT_GROUP_ID` — по умолчанию туда же, что регистрации. Опционально `ADMIN_DAILY_REPORT_TELEGRAM_CHAT_ID` (иначе `ADMIN_WEEKLY_REPORT_TELEGRAM_CHAT_ID`, иначе support-группа).

### Недельный

- **Что приходит**: те же метрики + итоги платформы (MRR); сравнение с позапрошлой неделей.
- **Период**: прошлая календарная неделя (пн–вс, МСК), с сравнением к позапрошлой.
- **API**: `POST /api/cron/weekly-report` с заголовком `Authorization: Bearer $CRON_SECRET` (или `?secret=`).
- **Cron на VPS**: `deploy/weekly-report.sh` — понедельник 09:00 МСК: `0 6 * * 1 /opt/qrstars/deploy/weekly-report.sh`.
- **Env**: `CRON_SECRET` (обязательно), `TELEGRAM_SUPPORT_GROUP_ID`. Опционально `ADMIN_WEEKLY_REPORT_TELEGRAM_CHAT_ID` для другого chat_id.

## Алерты об исключениях (Telegram)

Алерты в Telegram при необработанных исключениях в продакшене, с защитой от переспама.

- **Что ловится**: ошибки в App Router (`onRequestError` в `src/instrumentation.ts` — Server Components / Route Handlers / Server Actions / proxy) + фоновые `process.on('unhandledRejection' / 'uncaughtException')` (cron, scan-flush воркер, незакрытые промисы).
- **Что игнорируется**: `NEXT_REDIRECT`, `NEXT_NOT_FOUND`, 4xx `NEXT_HTTP_ERROR` — это не сбои.
- **Транспорт**: `TELEGRAM_SUPPORT_BOT_TOKEN` (fallback `TELEGRAM_BOT_TOKEN`).
- **Канал**: `ADMIN_ALERTS_TELEGRAM_CHAT_ID` (отдельный chat_id), иначе `TELEGRAM_SUPPORT_GROUP_ID`.
- **Защита от переспама** (в `src/lib/error-alerts.ts`):
  1. Дедуп по fingerprint ошибки (`name + message + routePath + digest`) — первое срабатывание в окне `ALERTS_COOLDOWN_SEC` (по умолч. 300 c).
  2. Глобальный rate-limit — не более `ALERTS_MAX_PER_MIN` (по умолч. 10) алертов в минуту.
  3. In-memory fallback, если Redis недоступен (Map с TTL, чистка раз в 2 мин).
- **Никогда не бросает**: сбой отправки не роняет запрос.
- **Код**: `src/lib/error-alerts.ts` (`notifyException(error, ctx?)`), `src/instrumentation.ts`.
- **Env** (в `/opt/qrstars/.env`): `ADMIN_ALERTS_TELEGRAM_CHAT_ID` (опц.), `ALERTS_COOLDOWN_SEC` (опц., default 300), `ALERTS_MAX_PER_MIN` (опц., default 10). Без `TELEGRAM_SUPPORT_BOT_TOKEN`/`TELEGRAM_SUPPORT_GROUP_ID` алерты молча отключены.

## Производительность сканирования (batched stats + GeoIP)

Оптимизации hot path при сканировании QR (`/q/[code]`):

### Redis-очередь статистики
- При скане `enqueueScan()` (через `recordQrScan`) ставит данные в Redis вместо прямой записи в БД:
  - `INCR scan:count:{qrCodeId}` — атомарный счётчик
  - `LPUSH scan:queue {entry}` — detail-запись для PRO (IP, UA, timestamp)
- **PRO-статус** кэшируется в Redis (`pro:est:{estId}` / `pro:qr:{qrCodeId}`, TTL 5 мин) — не проверяется при каждом скане.
- **Fallback**: если Redis недоступен (`REDIS_URL` не задан), используется синхронная запись в БД (старое поведение). Работает в e2e-тестах без Valkey.
- **Батчевый flush**: `POST /api/cron/flush-scans` (с `Authorization: Bearer $CRON_SECRET`) читает счётчики и очередь из Redis, пишет в БД батчами (`UPDATE scansCount`, `INSERT QRScan`, `UPDATE firstScanAt`). Redis-лок предотвращает дубль-flush.
- **In-process flush**: `startScanFlushInterval()` запускает `setInterval` (default 30с, env `SCAN_FLUSH_INTERVAL_MS`) как дополнение к cron.
- **Cron на VPS**: `deploy/flush-scans.sh` — каждую минуту: `* * * * * /opt/qrstars/deploy/flush-scans.sh`.

### Дневные снапшоты сканов (DailyScanStat)
- **Зачем**: детальные логи `QRScan` пишутся **только PRO/Сеть** (`shouldLogDetailedScan`), а `scansCount` — кумулятивный счётчик без timestamp. Агрегаты отчётов за период (число сканов, топ заведений/QR) считались по `QRScan` → на FREE показывали 0. Теперь берутся из `DailyScanStat`.
- **Модель**: `DailyScanStat(qrCodeId, date, count, snapshot, establishmentId)`, unique `(qrCodeId, date)`. `date` — полночь МСК дня; `count` — дельта сканов за день; `snapshot` — абсолют `scansCount` на конец дня (для расчёта следующей дельты).
- **Алгоритм** (`src/lib/daily-scan-snapshot.ts`, `takeDailyScanSnapshot`): для каждого QR, существовавшего на конец вчера, `count = max(0, scansCount − snapshot предыдущего дня)`. При отсутствии предыдущего снапшота: QR создан вчера → `count = scansCount` (позавчера не существовал); иначе (legacy-QR при первом деплое) → `count = 0` (baseline — корректные дельты со следующего дня). Идемпотентен.
- **Отчёты**: агрегаты/топы в `src/lib/admin-weekly-report.ts` (`collectWeeklyReportMetrics`) берутся из `DailyScanStat` (`aggregate _sum count` / `groupBy`). Топ регионов остаётся на `QRScan` (регионы PRO-only).
- **Аналитика в ЛК** (`GET /api/analytics`): объёмные метрики (всего сканов, график по дням, сравнение с прошлым периодом, разбивка по режимам, топ QR/заведений, конверсия, дни недели) считаются через `collectScanPeriodStats` (`src/lib/scan-period-stats.ts`) — `DailyScanStat` за период **плюс живая дельта за сегодня** (`scansCount − последний snapshot`), т.к. снапшот текущего дня появляется только в 04:00 МСК. `QRScan` остаётся источником только для PRO-детализации: устройства, браузеры, регионы, разбивка по часам и лента сканов. Дни графика сканов — по календарю **МСК** (ключ `mskDateKey`), в отличие от графика отзывов (локальная TZ сервера).
- **API**: `POST /api/cron/snapshot-scans` с `Authorization: Bearer $CRON_SECRET` (или `?secret=`). Опц. `?referenceDate=ISO` для бэкфилла.
- **Cron на VPS**: `deploy/snapshot-scans.sh` — ежедневно **04:00 МСК** (после flush-scans и pg-backup, до дневного отчёта 09:00): `0 1 * * * /opt/qrstars/deploy/snapshot-scans.sh`.
- **Первый запуск после деплоя**: отчёт за день деплоя покажет 0 сканов (baseline); со следующего дня — корректные дельты для всех тарифов.

### Режимные include (#3)
- При cache miss сначала идёт минимальный `SELECT` (скаляры, индекс по `code`) → определяет mode/isActive.
- REDIRECT — **второго запроса нет**: сразу `redirect()`.
- Остальные режимы — второй `findUnique` с include только нужных связей (WIFI → `wifiConfig`; MENU → `menu.items`; LANDING → полный include).
- LANDING extra-запросы (multi-menu/card/wifi) кэшируются внутри `scan:{code}` payload.

### generateMetadata (#1)
- `generateMetadata` читает `getScanCache(code)` первым делом — при cache hit DB-запрос не нужен.

### GeoIP (MaxMind GeoLite2)
- Локальный лукуп через `.mmdb` файл вместо внешнего HTTP к `ip-api.com`.
- **Код**: `src/lib/geoip.ts` (`maxmind` npm). Lazy-init, singleton reader.
- **Путь к БД**: env `GEOIP_DB_PATH` (default `data/GeoLite2-City.mmdb`). Если файл отсутствует — регион = «Не определён».
- **Скачать БД**: `scripts/download-geoip-db.sh` (MaxMind с ключом, или `--provider dbip` без ключа).
- В hot path сканирования geo не вызывается — только в flush-воркере / в form-submit роутах (`collectClientInfo`).
- **Env**: `GEOIP_DB_PATH` (опционально), `MAXMIND_LICENSE_KEY` (для автообновления, опционально).

## Бэкап PostgreSQL (S3)

Ежедневный `pg_dump` с прода в приватный S3-бакет Beget с GFS-ротацией.

- **Скрипт**: `deploy/pg-backup.sh` — дамп через `docker compose exec db pg_dump`, gzip, загрузка через `amazon/aws-cli` в Docker.
- **Структура в бакете** (`BACKUP_S3_PREFIX`, default `postgres/`):
  - `daily/YYYY-MM-DD.sql.gz` — каждый день, хранить **7** (`BACKUP_RETENTION_DAILY`)
  - `weekly/YYYY-MM-DD.sql.gz` — по воскресеньям, хранить **5** (`BACKUP_RETENTION_WEEKLY`)
  - `monthly/YYYY-MM.sql.gz` — 1-го числа, хранить **12** (`BACKUP_RETENTION_MONTHLY`)
  - `latest/latest.sql.gz` — всегда последний дамп (для быстрого restore)
- **Восстановление**: `deploy/pg-restore.sh [ключ]` — по умолчанию `latest/latest.sql.gz`; интерактивное подтверждение `RESTORE`.
- **Первичная настройка на VPS**: `bash deploy/pg-backup-setup.sh` (cron + шаблон env).
- **Cron на VPS**: ежедневно **03:00 МСК**: `0 0 * * * /opt/qrstars/deploy/pg-backup.sh >> /var/log/qrstars-pg-backup.log 2>&1`
- **Env** (в `/opt/qrstars/.env`, не в git): `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY`, `BACKUP_S3_SECRET_KEY`; опционально `BACKUP_S3_REGION` (default `ru1`), `BACKUP_S3_PREFIX`, `BACKUP_RETENTION_*`.

## Lifecycle emails (onboarding-цепочка)

Поведенческая email-рассылка для владельцев после самoregистрации (`/register`).

- **Welcome (T+0)**: сразу после регистрации — обзор фич, CTA «Создать первый QR».
- **Nudge по этапам** (cron, 10:00 МСК): нет заведения (T+1, T+3) · нет QR (T+1, T+4 после заведения) · нет сканов (T+2, T+5 после QR) · нет отзывов (T+3 после первого скана) · подключить Telegram (T+2 после скана).
- **Feedback NPS (T+7)**: всем пользователям — форма `/feedback?token=…` (0–10, комментарий, опционально интервью).
- **Feedback T+90**: активным пользователям (≥1 отзыв или ≥5 сканов lifetime / детальный лог за 90 д) — другой текст опроса, тот же `/feedback`.
- **Feedback T+365**: аккаунт ≥1 года + активность за последние 90 д — годовой check-in, опционально кейс.
- **PRO hint (T+14)**: FREE-пользователям с активностью (≥3 скана, ≥1 отзыв). Не уходит, если человек уже попадает под персональную цену PRO или уже получил это письмо.
- **Персональная цена PRO** (`pro_offer_d14`, cron lifecycle): FREE, свой QR, ≥3 скана, с первого скана (`User.firstScanAt`) прошло ≥14 календарных дней МСК. Верхней границы нет: кто запустил QR позже, получает письмо в день, когда условия впервые выполнились. Первый скан раньше отсечки `PlatformMeta.pro_offer_campaign_started_at` (19 октября 2026, 00:00 МСК) письмо не получает. Цена первого года: `PRO_INTRO_OFFER.yearlyRub` (690 ₽ вместо 990 ₽, −30% с округлением до 10 ₽). Персональный код `START30-…` в `SubscriptionIntroOffer`, срок 7 дней с отправки, одно использование, только годовой PRO этого аккаунта. На странице тарифов цена подставляется сама. Со следующего года списание по каталогу. Напоминание `pro_offer_reminder` за 2 дня до конца, если код не использован и тариф всё ещё FREE. Текст и тема обоих писем подстраиваются под режим самого сканируемого активного QR-кода владельца (`topQrMode` → `resolveProOfferQrProfile`): `REVIEW` (жалобы в Telegram/MAX за секунду, ротация площадок), `REDIRECT` (мгновенный переход без 3-секундного экрана QrStars, детальная аналитика по дням/городам/устройствам) и контентные режимы `MENU`/`BUSINESS_CARD`/`WIFI`/`FILE`/`LANDING` (микросайт со всеми разделами в одном QR, White Label без вотермарки, заявки в мессенджер). Оба письма вместе: не больше `PRO_INTRO_OFFER.maxPerDay` (5) за календарный день МСК. Напоминания отправляются раньше новых офферов. Кто не попал в лимит, получает письмо на следующем запуске cron.

**Отмена письма**: пользователь «перерос» этап (например, создал QR → не шлём «нет заведения»). **Отписка**: one-click в footer → `GET /api/unsubscribe?token=…` (только onboarding; transactional — жалобы, сброс пароля — всегда).

**Модели БД**: `UserLifecycleEmail` (idempotent по `userId + campaignKey`), `UserFeedback` (unique по `userId + surveyKind`: `d7`, `d90`, `d365`), `SubscriptionIntroOffer` (персональный код PRO, unique по `userId + campaignKey`), поля `User.marketingEmailsEnabled`, `User.registrationSource`, `User.firstScanAt`.

**Код**: `src/lib/lifecycle-emails.ts`, `src/lib/lifecycle-email-campaigns.ts`, `src/lib/lifecycle-email-templates.ts`, `src/lib/email-layout.ts`, `src/lib/signed-user-token.ts`.

**API**: `POST /api/cron/lifecycle-emails` с `Authorization: Bearer $CRON_SECRET` (или `?secret=`).

**Cron на VPS**: `deploy/lifecycle-emails.sh` — ежедневно 10:00 МСК: `0 7 * * * /opt/qrstars/deploy/lifecycle-emails.sh`.

**E2E**: `e2e/test_lifecycle_emails.py`.

**Legacy-выливка (существующая база)**:
- Миграция `20260609160000_lifecycle_legacy_backfill`: в `PlatformMeta` пишется `lifecycle_legacy_cutoff`, всем юзерам до cutoff проставляются «отправлено» для всех nudge-кампаний (без feedback).
- После деплоя: `deploy/feedback-launch.sh` → `POST /api/cron/feedback-launch` — **одно** письмо с опросом legacy-юзерам; затем помечаются `feedback_launch`, `feedback_d7`, `feedback_d90`, `feedback_d365` (cron не догонит).
- Новые юзеры после cutoff — обычная цепочка с нуля.
- `deploy/deploy.sh` вызывает feedback-launch автоматически (идемпотентно).


## Ежемесячный отчёт владельцу (email / Telegram / MAX)

Ежемесячная сводка по сканированиям, отзывам и заказам для владельца заведений, со сравнением с прошлым месяцем (MoM). Адаптивные секции — только по тем типам QR, которые есть у владельца; промо-блоки кросс-селла («а ещё у нас есть отзывы/меню», upsell PRO).

- **Период**: прошлый календарный месяц (МСК), сравнение MoM с позапрошлым. Опц. `?periodMonth=YYYY-MM` для бэкфилла.
- **Кому**: всем владельцам с заведением и активностью (≥1 скан/отзыв/QR **за отчётный период** — старые QR без сканов «нулевые» отчёты не генерят). FREE — упрощённая версия, PRO/Сеть — полная (per-mode секции, конверсия, заказы, разбивка по точкам).
- **Каналы**: owner-level тумблеры на `User` (`reportsEmailEnabled` / `reportsTelegramEnabled` / `reportsMaxEnabled`), цели — `MessengerContact` владельца (+ email-fallback на `user.email` если `marketingEmailsEnabled`). Настраиваются в `/dashboard/settings` (блок «📋 Ежемесячный отчёт»).
- **Отписка из письма-отчёта**: footer содержит «Отписаться от отчётов» → `GET /api/unsubscribe?token=…&type=reports` ставит `reportsEmailEnabled=false` (onboarding-отписка без `type` по-прежнему глушит только `marketingEmailsEnabled`). `?periodMonth=` невалидного месяца → 400 (`INVALID_PERIOD_MONTH`).
- **Идемпотентность**: `UserLifecycleEmail(userId, campaignKey = "monthly_report_YYYY_MM")`. Повторный cron / гонка (unique constraint P2002) → skip `already_sent`.
- **Источник сканов по режимам**: `DailyScanStat` JOIN `QRCode.mode` (raw SQL, все тарифы). Отзывы — `Review` (count/avg/`isNegative`/распределение [1–5★]). Заказы меню — `MenuOrder` (count/`total`/конверсия) при наличии MENU-QR. Сеть — разбивка по точкам.
- **Код**: `src/lib/owner-monthly-report.ts` (`collectOwnerMonthlyMetrics`, `renderOwnerMonthlyReportEmail`, `renderOwnerMonthlyReportMessenger`, `sendOwnerMonthlyReports`), `src/lib/report-formatting.ts` (общие хелперы: `deltaLine`, `formatMskMonthHuman`, и т.д. — шарятся с `admin-weekly-report.ts`), `src/lib/owner-messenger-notify.ts` (`getReportEmailTargets` / `getReportTelegramTargets` / `getReportMaxTargets`).
- **API**: `POST /api/cron/monthly-report` с `Authorization: Bearer $CRON_SECRET` (или `?secret=`); опц. `?periodMonth=`, `?userId=`, `?force=1`. Admin-only превью для дебага/e2e: `GET /api/admin/users/[id]/monthly-report-preview?periodMonth=` (метрики + emailHtml + messengerParts).
- **Cron на VPS**: `deploy/monthly-report.sh` — 1-го числа каждого месяца 10:00 МСК: `0 7 1 * * /opt/qrstars/deploy/monthly-report.sh`. Запускать ПОСЛЕ `snapshot-scans` (04:00 МСК — снапшот за последний день прошлого месяца готов).
- **E2E**: `e2e/test_owner_monthly_report.py` (cron auth, идемпотентность, FREE vs PRO контент, бэкфилл, Сеть, тумблеры настроек).


## Реальный стек (фактический, не aspirational)

| Слой | Технология |
|---|---|
| Фреймворк | **Next.js 16.2.6** (App Router), React 19, TypeScript 5 |
| Стили | **Tailwind CSS v4** (`@tailwindcss/postcss`), globals в `src/app/globals.css` |
| ORM / БД | **Prisma 7** (`@prisma/adapter-pg`) + PostgreSQL (прямое подключение через `pg`) |
| Аутентификация | **NextAuth v4** (`next-auth`) + `@next-auth/prisma-adapter` |
| Хранилище файлов | **Beget S3** (AWS SDK v3: `@aws-sdk/client-s3`), бакет `1919a3d97e3e-qrstarsru` |
| Платежи | **Robokassa** (`src/lib/robokassa.ts`), ResultURL `/api/webhook/robokassa/result`, cron `/api/cron/renew-subscriptions` |
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
      webhook/robokassa # ResultURL Robokassa
      … ещё ~20 роутов
    admin/            # UI: панель администратора
    dashboard/        # UI: ЛК владельца (проекты: /dashboard/projects/[id]/…)
    dashboard/projects/  # Главная, микросайт, QR, обратная связь, статистика, настройки
    scan/[id]/        # UI: публичная страница при сканировании
    activate/[id]/    # UI: форма активации новой таблички
  components/
    ui/               # Базовые компоненты (Button, Input, Card, Badge…)
    dashboard/        # Редакторы + project/ (MicrositeEditor, QR-коды, список проектов)
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
    robokassa.ts      # Robokassa API (платёж + recurring)
    subscription-activate.ts
    subscription-renewal.ts
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

`User` · `Establishment` · `EstablishmentMember` · `QRCode` · `Review` · `BusinessCard` · `CustomPage` · `FileAsset` · `QRMenu` · `QRMenuItem` · `WifiConfig` · `Template` · `MessengerContact` · `Subscription` · `PromoCode` · `PartnerEarning` · `PartnerWithdrawal` · `PasswordResetToken` · `DailyScanStat`

> Центральная сущность — `Establishment` (не `Business`, как в старых комментариях). Весь контент (меню, визитка, Wi-Fi, сценарии отзывов, брендинг) принадлежит заведению.

### Совместный доступ к заведению

- **Модель**: `EstablishmentMember` (`PENDING` / `ACTIVE`), уникальность `(establishmentId, email)`.
- **Владелец** приглашает по email в `/dashboard/projects/[id]/settings` (секция «Доступ команды»). API: `GET/POST /api/establishments/[id]/members`, `DELETE .../members/[memberId]`.
- **Зарегистрированный пользователь** → сразу `ACTIVE` + письмо о доступе. **Новый email** → `PENDING` + письмо со ссылкой `/register?establishmentInvite={token}`; превью: `GET /api/establishments/invite-preview?token=`.
- **Участник**: полный edit (контент, QR, настройки, аналитика). **Только владелец**: удаление заведения, управление участниками.
- **Лимиты**: 10 инвайтов/час на владельца, 5/час на заведение, макс. 10 участников. Чужие заведения не входят в лимит тарифа участника (`countUserEstablishments` — только `userId`).
- **PRO-фичи** заведения — по подписке **владельца** (`establishmentHasPaidFeatures` в `src/lib/establishment-access.ts`). Проверки доступа — `establishmentAccessWhere(userId)`.

### Меню iiko (PRO / Сеть)

- **Режим источника** `QRMenu.source`: `MANUAL` (редактор позиций) или `IIKO` (внешнее меню из iiko Cloud).
- **Настройка**: микросайт проекта → меню → переключатель **iiko**, API-login, «Проверить подключение» → `POST /api/menus/iiko/discover`. Позиции редактируются в **iikoWeb → Внешние меню** (типичное имя: «Сайт/приложение»).
- **Публичный показ**: при скане `/q/[code]` меню подгружается через `POST /api/2/menu/by_id` (кэш Redis 5 мин), рендер в `MenuView`.
- **Корзина + iiko**: при `cartEnabled` заказ уходит в iiko (`POST /api/1/deliveries/create`, типы заказов «Доставка самовывоз» / «Доставка Сайт», оплата `SITE`) и дублируется владельцу (email/Telegram/MAX). В форме гостя: самовывоз/доставка, телефон обязателен.
- **API**: `POST /api/menus/iiko/discover`, `POST /api/menus/iiko/preview`; поля iiko в `POST/PUT /api/menus`. API-login хранится зашифрованным (`IIKO_ENCRYPTION_KEY` или `NEXTAUTH_SECRET`), клиенту не отдаётся.
- **Категории в QR**: после предпросмотра — чекбоксы «Категории в QR-меню»; скрытые id в `QRMenu.iikoHiddenCategoryIds` (blacklist), фильтр при показе и в заказе.
- **Env**: `IIKO_API_BASE_URL` (default `https://api-ru.iiko.services`), опционально `IIKO_ENCRYPTION_KEY`.
- **Код**: `src/lib/iiko/`. E2E на отправку заказов в iiko не пишем (тестовые ключи без создания заказов).

## Платежи Robokassa (подписки PRO / Сеть)

- **Клиент**: `src/lib/robokassa.ts` — MD5-подписи, `Receipt` (УСН, `tax: none`), первый платёж `Recurring=true`, продление `POST /Merchant/Recurring`.
- **Checkout**: `POST /api/subscription` (обязателен `recurringConsent`) → `PaymentOrder` + `RecurringConsentLog` → redirect Robokassa.
- **ResultURL**: `GET /api/webhook/robokassa/result` → `OK{InvId}` (plain text).
- **Success/Fail**: `/api/payments/robokassa/success|fail` → `/dashboard/subscription`.
- **Cron**: `POST /api/cron/renew-subscriptions` — `deploy/renew-subscriptions.sh` (ежедневно 06:00 МСК): email за 7 дней при изменении суммы, за 3 дня — напоминание, списание, истечение при отмене. Баннер в `/dashboard/subscription`. Плановое изменение тарифов: `PlatformMeta` `tariff_change_effective_at` (+ опц. `tariff_change_message`).
- **Юридика**: `https://qrstars.ru/publichnaya-oferta.html` и др. (репо `qrwin-landing`); чекбокс автосписаний в `/dashboard/subscription`.
- **Env**: `ROBOKASSA_MERCHANT_LOGIN`, `ROBOKASSA_PASSWORD_1`, `ROBOKASSA_PASSWORD_2`; опц. `ROBOKASSA_TEST_MODE`. Без login — mock (e2e).
- **ЛК** (магазин `QrStars`): ResultURL `https://app.qrstars.ru/api/webhook/robokassa/result`. Рекуррентные — после согласования с Robokassa.

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