# ТЗ: биллинг подписок как в QrStars (Robokassa + рекуррент + 54-ФЗ)

Документ для агента-исполнителя. Задача — внедрить **тот же паттерн биллинга**, что в QrStars (`qrwin`), а не «любую оплату картой».

Референс (если есть доступ к репо QrStars): `src/lib/robokassa.ts`, `src/app/api/subscription/route.ts`, `src/app/api/webhook/robokassa/result/route.ts`, `src/lib/subscription-activate.ts`, `src/lib/subscription-renewal.ts`, `src/lib/plans.ts`, `e2e/test_subscription.py`, `e2e/test_subscription_renewal.py`.

---

## 1. Цель

Пользователь оформляет платную подписку (месяц / год), даёт **явное согласие на автосписания**, уходит на Robokassa, после успешной оплаты подписка активируется **только по ResultURL**, дальше cron сам продлевает карту через Recurring API, шлёт письма, считает партнёрку.

Без Robokassa (нет `ROBOKASSA_MERCHANT_LOGIN`) — **mock**: подписка включается сразу, заказ не создаётся. Нужно для e2e и локалки.

---

## 2. Что это НЕ должно быть

- Не активировать подписку по SuccessURL / «пользователь вернулся на сайт». Success/Fail — только редирект в ЛК с `?status=success|fail`. Истина — ResultURL.
- Не хранить карты. Рекуррент держит Robokassa по `PreviousInvoiceID` = **первый успешный InvId**.
- Не ходить в Robokassa GET-формой с длинным `Receipt` в query. Первый платёж: **сервер POST** на `Merchant/Index.aspx` → 302 → клиент на `location`. Fallback: POST-форма из браузера.
- Не хардкодить суммы. Цена всегда из конфига тарифов на момент списания (важно для «Сеть»: число точек могло вырасти).

---

## 3. Провайдер и кабинет Robokassa

Магазин: **QrStars**. Технология: Robokassa, рекуррентные платежи после согласования с ними.

URL кабинета (прод):

| Параметр | Значение |
|---|---|
| ResultURL | `https://app.qrstars.ru/api/webhook/robokassa/result` метод **GET** |
| SuccessURL | `https://app.qrstars.ru/api/payments/robokassa/success` |
| FailURL | `https://app.qrstars.ru/api/payments/robokassa/fail` |
| Алгоритм | MD5 |
| ResultURL ответ | **plain text** `OK{InvId}` (например `OK42`), `Content-Type: text/plain`. Не JSON. |

Эндпоинты Robokassa:

- Первый платёж: `POST https://auth.robokassa.ru/Merchant/Index.aspx` (`application/x-www-form-urlencoded`), ждать `Location` (относительный → `https://auth.robokassa.ru` + path).
- Продление: `POST https://auth.robokassa.ru/Merchant/Recurring`. Успех, если тело содержит `OK{InvId}` / `OK+{InvId}` / `OK:{InvId}` (без учёта регистра).

---

## 4. Env

```
ROBOKASSA_MERCHANT_LOGIN=          # если пусто → mock
ROBOKASSA_PASSWORD_1=
ROBOKASSA_PASSWORD_2=
ROBOKASSA_TEST_MODE=true|false     # при true брать TEST_PASSWORD_* если заданы, слать IsTest=1
ROBOKASSA_TEST_PASSWORD_1=
ROBOKASSA_TEST_PASSWORD_2=
ROBOKASSA_RECURRING=false          # только если надо выключить Recurring=true на первом платеже; по умолчанию включён
CRON_SECRET=                       # cron продления
NEXT_PUBLIC_BASE_URL=https://app.qrstars.ru
```

Password1 — подпись исходящих платежей. Password2 — проверка ResultURL. **Никогда не путать.**

---

## 5. Тарифы и сумма

Источник правды: `PLAN_PRICING` / `calcSubscriptionAmount(plan, billing, establishmentCount)`.

Периоды:

- `monthly` → 30 календарных дней
- `yearly` → 365 календарных дней

Сумма **Сеть** зависит от числа заведений владельца (`count` по `userId`, не члены команды): база + extra × цена точки. Год: extra × monthlyExtra × **10** (2 месяца в подарок, как база).

На продлении пересчитать сумму заново. Если она ≠ последнему `PaymentOrder` со статусом `PAID` — за 7 дней письмо «изменение суммы».

Формат суммы в Robokassa: `amount.toFixed(2)` (строка `"390.00"`). Сравнение: `|expected - parseFloat(OutSum)| < 0.01`.

---

## 6. Модель данных

### Subscription

- `status`: `ACTIVE` | `PAST_DUE` | `CANCELED`
- `plan`: `FREE` | `PRO` | `NETWORK`
- `invoiceId` — последний успешный InvId
- `parentInvoiceId` — **первый** успешный InvId (якорь Recurring). Если `null` — это mock/legacy, **не продлевать** автосписанием, по истечении периода → `CANCELED`
- `billing`: `monthly` | `yearly`
- `currentPeriodStart` / `currentPeriodEnd`
- `cancelAtPeriodEnd` — отмена без отключения до конца периода
- `renewalAttempts` — счётчик неудач (лимит 3)
- `renewalNoticeSentAt` — письмо «через 3 дня спишем»
- `priceChangeNoticeSentAt` — письмо «сумма изменилась»

Активная платная: `status=ACTIVE` и `plan` не `FREE`. Несколько записей возможны; брать свежую платную ACTIVE.

### PaymentOrder

- `invId` **SERIAL UNIQUE** — это InvId/InvoiceID в Robokassa. Создавать заказ **до** редиректа, InvId известен сразу.
- `kind`: `INITIAL` | `RENEWAL`
- `parentInvId` — для RENEWAL = `Subscription.parentInvoiceId`
- `userId`, `plan`, `billing`, `amount Decimal(10,2)`
- `status`: `PENDING` | `PAID` | `FAILED`
- `paidAt`, `consentLogId`, `createdAt`

Индексы: `(userId, status)`, `(status, kind)`.

### RecurringConsentLog (юридика автосписаний)

Писать **до** ухода на оплату, на каждый INITIAL:

- userId, plan, billing, amount
- `offerUrl`, `offerVersion` (сейчас оферта `https://qrstars.ru/publichnaya-oferta.html`, версия дата `YYYY-MM-DD`)
- ip (`x-forwarded-for` / `x-real-ip`), user-agent
- потом проставить `paymentOrderId`

Без `recurringConsent: true` в POST — 400, оплату не начинать.

### PartnerEarning (если есть партнёрка)

При каждой **успешной** оплате (INITIAL и RENEWAL): если у плательщика `referredById` — 15% от суммы, статус `PENDING`, `availableAt = now + 30 дней`, `paymentId = String(invId)`.

---

## 7. Подписи MD5

Все хеши — hex MD5, сравнение **case-insensitive**.

`shp_*` если есть: отсортировать ключи case-insensitive, дописать `:{k}={v}` по каждому. В QrStars shp на исходящем платеже **не используются**. На ResultURL всё равно собирать shp из query, если придут.

### Первый платёж и Recurring (Password1)

```
MD5(MerchantLogin:OutSum:InvId:ReceiptJson:Password1)
```

`ReceiptJson` — **сырой JSON как в поле Receipt**, без URL-encode внутри подписи.

### ResultURL (Password2)

```
MD5(OutSum:InvId:Password2[+ shp])
```

Receipt в ResultURL **не входит**.

Query aliases: `OutSum`/`outsum`, `InvId`/`invId`/`InvoiceID`, `SignatureValue`/`signaturevalue`.

---

## 8. Чек 54-ФЗ (Receipt)

Robokassa шлёт фискальный чек. СНО: УСН доходы.

```json
{
  "sno": "usn_income",
  "items": [{
    "name": "Podpiska QrStars PRO, 1 mes",
    "quantity": 1,
    "sum": 390.00,
    "payment_method": "full_payment",
    "payment_object": "service",
    "tax": "none"
  }]
}
```

- `sum` позиции = `OutSum`.
- `name` — **латиница**, ≤128 символов (кириллица в Receipt ломает подпись/кодировку). Шаблон: `Podpiska QrStars {PRO|Set}, {1 mes|1 god}`.
- `Description` платежа можно по-русски, ≤100: `QrStars PRO, подписка 1 месяц`.

Поля первого платежа:

```
MerchantLogin, OutSum, InvId, Description, Receipt, SignatureValue, Encoding=utf-8, Culture=ru
Recurring=true   (если не выключено env)
IsTest=1         (если test mode)
```

Recurring-поля:

```
MerchantLogin, OutSum, InvoiceID, PreviousInvoiceID, Description, Receipt, SignatureValue, Encoding=utf-8
[+ IsTest=1]
```

`PreviousInvoiceID` = `parentInvoiceId` (первый платёж), **не** последний `invoiceId`.

---

## 9. Потоки

### 9.1. GET `/api/subscription` (сессия)

Вернуть текущую/последнюю подписку, контекст тарифа (`plan`, лимиты заведений, `plans`), баннеры:

- за 7 дней до списания, если сумма ≠ последнему PAID — `renewalPriceChange`
- платформенное изменение тарифов из `PlatformMeta` (`tariff_change_effective_at` / `tariff_change_message`) — только если дата в будущем и ≤7 дней

### 9.2. POST `/api/subscription` `{ action: "subscribe", plan, billing, recurringConsent }`

1. Auth. `plan` только `PRO`|`NETWORK`. `billing` default `monthly`.
2. Обязателен `recurringConsent`.
3. Если уже есть активная платная:
   - тот же план (или NETWORK→PRO) → 400 «уже есть»;
   - апгрейд PRO→NETWORK → текущую ACTIVE пометить `CANCELED` и идти в оплату нового.
4. Посчитать amount.
5. **Mock**, если Robokassa не сконфигурирована: upsert подписки `id=mock-{userId}`, ACTIVE, период от now, без PaymentOrder. Вернуть `{ success, mode: "mock", plan, message }`.
6. Иначе: RecurringConsentLog → PaymentOrder INITIAL PENDING → связать consent → `buildPaymentRequest` → `resolvePaymentRedirectUrl`.
7. Уведомление в Telegram support: попытка оплаты (email, план, сумма, InvId).
8. Ответ: `{ paymentRedirectUrl, paymentPost: { action, fields }, paymentId: invId, amount }`.

Клиент: если есть `paymentRedirectUrl` — `window.location`. Иначе собрать hidden POST-форму на `paymentPost.action`.

Кнопки тарифов disabled, пока чекбокс согласия не включён. В чекбоксе ссылка на оферту и условия оплаты.

### 9.3. ResultURL GET `/api/webhook/robokassa/result`

Публичный, без сессии.

1. Нет конфига → 503.
2. Нет OutSum/InvId → 400.
3. Подпись Password2 неверна → 403.
4. Заказа нет → 404.
5. Сумма не совпала → 400.
6. Если ещё не `PAID` → `handlePaidPaymentOrder(invId)`.
7. Всегда (даже повтор) → `200` body `OK{invId}`.

Идемпотентность: повторный ResultURL не создаёт вторую подписку и не начисляет партнёрку дважды.

`handlePaidPaymentOrder`:

- PENDING→PAID + `paidAt`.
- INITIAL: если есть другая активная платная — отменить; `activateSubscription` (новая запись, `invoiceId = parentInvoiceId = invId`, период от now, сброс renewal/notice полей) + партнёрка.
- RENEWAL: найти подписку пользователя `ACTIVE|PAST_DUE` с тем же `parentInvoiceId`; продлить: `currentPeriodEnd += period` **от max(now, currentPeriodEnd)** (не терять оплаченные дни), `invoiceId = новый invId`, `parentInvoiceId` не менять, status ACTIVE, attempts=0, notice timestamps null + партнёрка.

### 9.4. Success / Fail

Редирект на `/dashboard/subscription?status=success|fail`. Текст: success — «активируется в течение минуты» (ResultURL может прийти с задержкой). Никакой активации здесь.

### 9.5. Cancel `{ action: "cancel" }`

`updateMany` ACTIVE → `cancelAtPeriodEnd=true`. Доступ остаётся до `currentPeriodEnd`. Cron в дату конца (если cancel или нет parentInvoiceId) ставит `CANCELED`.

### 9.6. История GET `/api/subscription/history`

Заказы пользователя, amount как number.

Админка: список платежей (`/api/admin/payments`).

---

## 10. Cron продления

`POST|GET /api/cron/renew-subscriptions`  
Auth: `Authorization: Bearer $CRON_SECRET` или `?secret=`. Без секрета — 401.

Прод: `deploy/renew-subscriptions.sh`, **ежедневно 06:00 МСК**.

Один батч `runSubscriptionRenewalBatch()`, по порядку:

1. **Expire.** ACTIVE и `currentPeriodEnd < now` и (`cancelAtPeriodEnd` **или** `parentInvoiceId is null`) → `CANCELED`.
2. **Платформенное изменение тарифа.** Если в `PlatformMeta` дата входа новых цен попадает в окно «через 6–8 дней» и письма по этой дате ещё не слали — всем ACTIVE платным с parentInvoiceId письмо, затем пометить sent.
3. **Изменение суммы (7±1 день до конца).** ACTIVE, не cancel, есть parent, `priceChangeNoticeSentAt is null`, новая сумма ≠ последний PAID → письмо, проставить timestamp.
4. **Напоминание (3±1 день).** Аналогично `renewalNoticeSentAt`, сумма актуальная. Тема/текст: дата списания, сумма, ссылка отменить.
5. **Списание.** `ACTIVE|PAST_DUE`, не cancel, есть parent, `currentPeriodEnd <= now+1 день`:
   - если уже есть PENDING RENEWAL с тем же `parentInvId` — skip (антидубль);
   - создать PENDING RENEWAL;
   - `createRecurringPayment`;
   - если Robokassa не OK → заказ FAILED, `handleRenewalFailure`;
   - если OK — ждать ResultURL (не активировать здесь).
6. **Зависшие PENDING RENEWAL старше 2 суток** → FAILED + `handleRenewalFailure`.

`handleRenewalFailure`: `renewalAttempts++`. Если ≥ 3 → `CANCELED` + письмо «не удалось продлить». Иначе → `PAST_DUE`.

Пока `PAST_DUE`, доступ платный лучше считать выключенным (`effectivePlan` смотрит только ACTIVE). Следующие дни cron снова попытается, пока attempts < 3.

---

## 11. UI ЛК `/dashboard/subscription`

- Переключатель месяц/год, три карточки FREE / PRO / Сеть, цены из API/`PLANS`.
- Для Сети подсказка: база + цена доп. точки; если точек > 2 — итоговая сумма.
- Чекбокс согласия на рекуррент **обязателен** до оплаты; ссылки на оферту и условия оплаты/возврата.
- Активный платный план: кнопка «Отменить автопродление» (confirm).
- Баннеры: смена суммы, платформенная смена тарифов.
- История заказов.
- Скриншоты референса: `docs/robokassa/subscription-checkout.png`, `subscription-cancel.png`.

---

## 12. Юридика (должно совпасть с офертой)

Оферта: периоды 30 / 365 дней, списание ~06:00 МСК, сумма = тариф **на момент списания**, Сеть пересчитывается от числа точек, отмена в ЛК сохраняет доступ до конца периода, рекуррент только карты РФ.

Версию оферты в `LEGAL_OFFER_VERSION` bumpать, когда меняется текст/цены в оферте.

---

## 13. Тесты (обязательны)

E2e pytest, как `e2e/test_subscription.py` и `e2e/test_subscription_renewal.py`.

Покрыть:

- GET subscription 200 + 401 без сессии
- subscribe без consent → 400
- mock subscribe (без login Robokassa) → PRO ACTIVE
- повторный subscribe того же плана → 400
- cancel → 200
- unknown action → 400
- если Robokassa сконфигурирована: ResultURL с верной MD5(Password2) → заказ PAID, подписка ACTIVE, история; кривая подпись → 403; повтор ResultURL идемпотентен
- cron без секрета → 401; с секретом → `{ ok: true, ...счётчики }`
- после cancel cron не шлёт renewal notice / не списывает

Хелпер подписи ResultURL — как `e2e/robokassa_helpers.py`.

---

## 14. Подводные камни (из продакшена)

1. ResultURL обязан ответить именно `OK{InvId}`, иначе Robokassa будет ретраить и считать оплату неподтверждённой.
2. InvId должен быть уникальным целым; SERIAL на заказе — правильный путь. Не использовать cuid.
3. Recurring всегда к **первому** InvId.
4. Receipt в подписи = exact JSON. Лишний пробел → отказ.
5. `Encoding=utf-8` + имена позиций латиницей.
6. Test mode: другие пароли и `IsTest=1`, иначе «неверная подпись».
7. Nginx не должен резать query ResultURL и не отдавать HTML-ошибку вместо текста.
8. Не списывать дважды: PENDING renewal lock + идемпотентный PAID.
9. Апгрейд PRO→NETWORK: старую подписку отменить **до** новой оплаты, иначе 400.
10. Mock-подписки без `parentInvoiceId` не должны уходить в Recurring.
11. Cron `currentPeriodEnd <= now+1d` — запас, чтобы списать в день окончания, не «после полуночи на сутки позже».
12. Продление прибавляет период к `currentPeriodEnd`, если он ещё в будущем — иначе накладываются дыры при позднем ResultURL.

---

## 15. Критерии готовности

- [ ] Checkout: согласие → заказ PENDING → редирект Robokassa
- [ ] ResultURL активирует подписку, SuccessURL нет
- [ ] Повтор ResultURL безопасен, ответ `OK{InvId}`
- [ ] Отмена = `cancelAtPeriodEnd`, доступ до конца периода
- [ ] Cron: письма за 7 и 3 дня, Recurring, PAST_DUE, отключение после 3 фейлов
- [ ] Сумма продления пересчитывается из актуальных цен и числа точек
- [ ] Чек УСН `tax: none` в каждом платеже
- [ ] Consent log с IP/офертой
- [ ] Mock без ключей
- [ ] E2e зелёные
- [ ] В ЛК Robokassa прописаны Result/Success/Fail URL

---

## 16. Карта файлов референса

| Файл | Роль |
|---|---|
| `src/lib/robokassa.ts` | конфиг, Receipt, подписи, POST Index, Recurring |
| `src/lib/plans.ts` | цены и `calcSubscriptionAmount` |
| `src/lib/subscription-utils.ts` | active/latest, effectivePlan |
| `src/lib/subscription-activate.ts` | PAID → activate/renew + партнёрка |
| `src/lib/subscription-renewal.ts` | cron-батч |
| `src/lib/subscription-billing-utils.ts` | окно 7 дней, сравнение сумм |
| `src/lib/subscription-renewal-emails.ts` | письма |
| `src/lib/tariff-change-notice.ts` | баннер/рассылка смены тарифов |
| `src/lib/legal-urls.ts` | оферта, версия |
| `src/app/api/subscription/route.ts` | GET/POST subscribe+cancel |
| `src/app/api/subscription/history/route.ts` | история |
| `src/app/api/webhook/robokassa/result/route.ts` | ResultURL |
| `src/app/api/payments/robokassa/success/fail` | редиректы |
| `src/app/api/cron/renew-subscriptions/route.ts` | cron |
| `src/app/dashboard/subscription/page.tsx` | UI |
| `deploy/renew-subscriptions.sh` | прод cron |
| `prisma/schema.prisma` | Subscription, PaymentOrder, RecurringConsentLog |
