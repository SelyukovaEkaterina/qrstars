# QA-режим: исключение ручных тестов из аналитики

Ручные проверки (регистрация, онбординг, клики) не должны попадать в Яндекс.Метрику, админ-воронку и offline-конверсии.

## Как включить

### Bookmarklet (prod)

Сохраните в закладки браузера:

```javascript
javascript:(function(){document.cookie='qrstars_no_analytics=1;path=/;max-age=31536000;domain=.qrstars.ru';document.cookie='qrstars_no_analytics=1;path=/;max-age=31536000';alert('QA mode ON');})();
```

### Query-параметр

Откройте любую страницу с `?no_analytics=1` — middleware выставит cookie `qrstars_no_analytics=1` (на `.qrstars.ru`, 1 год) и уберёт параметр из URL.

Пример: `https://app.qrstars.ru/register?no_analytics=1`

### Локально

Тот же query-параметр или bookmarklet без `domain` (cookie только для текущего хоста).

## Что происходит в QA-режиме

| Область | Поведение |
|---|---|
| Яндекс.Метрika | Скрипт не грузится, `reachGoal` / `setUserID` / `hit` не вызываются |
| Регистрация | `registrationSource = internal_test` (UTM сохраняются) |
| Email `+test` / домены из `INTERNAL_TEST_EMAIL_DOMAINS` | Тоже `internal_test`, даже без cookie |
| UserEvent (`POST /api/events`) | События пишутся; в `props` добавляется `qa: true` |
| `/admin/funnel`, Telegram-отчёты, `/api/admin/stats` | Пользователи с `internal_test` не учитываются |
| Offline-конверсии (заведения) | Не отправляются для `internal_test` |

В дашборде показывается полоска **«Режим QA: статистика не учитывается»** со ссылкой «Выключить».

## Протокол ручного тестирования

1. Включите QA-режим (bookmarklet или `?no_analytics=1`).
2. Убедитесь, что полоска в дашборде видна.
3. Пройдите сценарий (регистрация → онбординг → клики).
4. Проверки:
   - DevTools → Network: нет запросов к `mc.yandex.ru` / нет `ym(..., 'init'`.
   - В админке `/admin/funnel` тестовый email не попадает в cohort.
   - При необходимости в БД: `User.registrationSource = 'internal_test'`.
5. После теста нажмите **«Выключить»** в полоске или удалите cookie `qrstars_no_analytics`.

## Env

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `INTERNAL_TEST_EMAIL_DOMAINS` | `test.qrstars.ru,example.com` | Домены email, автоматически помечаемые как тест |

## Код

- `src/lib/analytics-exclusion.ts` — cookie, email-паттерны, Prisma-фильтр cohort
- `src/middleware.ts` — обработка `?no_analytics=1`
