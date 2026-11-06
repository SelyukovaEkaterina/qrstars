/**
 * OpenAPI 3.1 открытого API QrStars. Единственный источник описания:
 * отдаётся как `https://app.qrstars.ru/api/v1/openapi.json` и собирается
 * в `https://qrstars.ru/openapi.json` лендингом. Без `@/`-импортов — модуль
 * импортирует и Astro.
 */

export const PUBLIC_API_VERSION = "1.0.0";
export const PUBLIC_API_SERVER = "https://app.qrstars.ru/api/v1";

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

const idParam = (description: string) => ({
  name: "id",
  in: "path",
  required: true,
  description,
  schema: { type: "string" },
});

const limitParam = {
  name: "limit",
  in: "query",
  description: "Размер страницы, 1–200 (по умолчанию 50)",
  schema: { type: "integer", minimum: 1, maximum: 200, default: 50 },
};

const cursorParam = {
  name: "cursor",
  in: "query",
  description: "Значение nextCursor из предыдущего ответа",
  schema: { type: "string" },
};

const common = {
  "401": errorResponse("Нет ключа, ключ неверный или отозван"),
  "429": errorResponse("Превышен лимит запросов, см. заголовок Retry-After"),
};

const WRITABLE_MODES = ["REVIEW", "REDIRECT", "MENU", "BUSINESS_CARD", "WIFI", "LANDING"];
const ALL_MODES = [...WRITABLE_MODES, "FILE", "CUSTOM_SECTION", "FORM", "TIPS"];
const INDUSTRIES = ["HORECA", "BEAUTY", "AUTO", "CLINIC", "HOTEL", "SERVICES", "OTHER"];

export function buildOpenApiSpec() {
  return {
    openapi: "3.1.0",
    info: {
      title: "QrStars API",
      version: PUBLIC_API_VERSION,
      summary: "Динамические QR-коды, сбор отзывов и статистика сканирований для бизнеса",
      description: [
        "REST API сервиса QrStars (qrstars.ru): создание и изменение динамических QR-кодов,",
        "проекты (заведения), отзывы и жалобы гостей, статистика сканирований.",
        "",
        "**Авторизация**: заголовок `Authorization: Bearer qrs_…`. Ключ создаётся в кабинете",
        "https://app.qrstars.ru/dashboard/settings → «API-ключи» и показывается один раз.",
        "API доступен на всех тарифах, ограничения тарифа (число проектов, микросайт на PRO) действуют так же, как в кабинете.",
        "",
        "**Лимиты**: 120 запросов в минуту на ключ, 200 новых QR-кодов в час на аккаунт.",
        "",
        "**Ошибки**: `{ \"error\": { \"code\": \"…\", \"message\": \"…\" } }`, текст сообщения — на русском.",
        "",
        "**Динамический QR**: картинка кодирует постоянную ссылку `https://app.qrstars.ru/q/{code}`,",
        "а куда она ведёт (отзывы, редирект, меню, визитка…) меняется через `PATCH /qrcodes/{id}` без перепечатки.",
      ].join("\n"),
      contact: { name: "Поддержка QrStars", url: "https://app.qrstars.ru/dashboard/support" },
      termsOfService: "https://qrstars.ru/polzovatelskoe-soglashenie.html",
    },
    externalDocs: { description: "Документация", url: "https://qrstars.ru/api.html" },
    servers: [{ url: PUBLIC_API_SERVER }],
    security: [{ apiKey: [] }],
    tags: [
      { name: "Аккаунт" },
      { name: "Проекты", description: "Проект — заведение или бизнес; ему принадлежат QR-коды, контент и отзывы" },
      { name: "QR-коды" },
      { name: "Отзывы" },
      { name: "Статистика" },
    ],
    paths: {
      "/me": {
        get: {
          tags: ["Аккаунт"],
          operationId: "getMe",
          summary: "Аккаунт, тариф и лимиты",
          responses: {
            "200": {
              description: "OK",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Me" } } },
            },
            ...common,
          },
        },
      },
      "/projects": {
        get: {
          tags: ["Проекты"],
          operationId: "listProjects",
          summary: "Список проектов (свои и те, куда пригласили)",
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { projects: { type: "array", items: { $ref: "#/components/schemas/Project" } } },
                  },
                },
              },
            },
            ...common,
          },
        },
        post: {
          tags: ["Проекты"],
          operationId: "createProject",
          summary: "Создать проект",
          description: "На FREE и PRO — 1 проект, на «Сети» — до 5. При превышении — 403 upgrade_required.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ProjectInput" }], required: ["name"] } } },
          },
          responses: {
            "201": {
              description: "Создан",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { project: { $ref: "#/components/schemas/Project" } } },
                },
              },
            },
            "400": errorResponse("Некорректные поля"),
            "403": errorResponse("Лимит проектов тарифа (upgrade_required)"),
            ...common,
          },
        },
      },
      "/projects/{id}": {
        get: {
          tags: ["Проекты"],
          operationId: "getProject",
          summary: "Проект",
          parameters: [idParam("ID проекта")],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { project: { $ref: "#/components/schemas/Project" } } },
                },
              },
            },
            "404": errorResponse("Не найден"),
            ...common,
          },
        },
        patch: {
          tags: ["Проекты"],
          operationId: "updateProject",
          summary: "Изменить проект (название, ссылки на Яндекс Карты / 2GIS / Авито…)",
          description:
            "Ссылка на Яндекс Карты — только карточка организации (`/maps/org/…`), короткие `maps/-/…` и поиск отклоняются. 2GIS — карточка `…/firm/{id}` или `go.2gis.com/…`. `null` очищает поле.",
          parameters: [idParam("ID проекта")],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/ProjectInput" } } },
          },
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { project: { $ref: "#/components/schemas/Project" } } },
                },
              },
            },
            "400": errorResponse("Некорректные поля"),
            "404": errorResponse("Не найден"),
            ...common,
          },
        },
      },
      "/qrcodes": {
        get: {
          tags: ["QR-коды"],
          operationId: "listQrCodes",
          summary: "Список QR-кодов",
          parameters: [
            { name: "projectId", in: "query", description: "Только QR этого проекта", schema: { type: "string" } },
            limitParam,
            cursorParam,
          ],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      qrcodes: { type: "array", items: { $ref: "#/components/schemas/QrCode" } },
                      nextCursor: { type: ["string", "null"] },
                    },
                  },
                },
              },
            },
            ...common,
          },
        },
        post: {
          tags: ["QR-коды"],
          operationId: "createQrCode",
          summary: "Создать динамический QR-код",
          description:
            "Если `mode` не указан: с `redirectUrl` — REDIRECT, без — REVIEW (сбор отзывов). LANDING (микросайт) — только PRO/«Сеть». Контент режимов MENU, BUSINESS_CARD, WIFI берётся из проекта и настраивается в кабинете.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/QrCodeCreate" } } },
          },
          responses: {
            "201": {
              description: "Создан",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { qrcode: { $ref: "#/components/schemas/QrCode" } } },
                },
              },
            },
            "400": errorResponse("Некорректные поля"),
            "403": errorResponse("Режим недоступен на тарифе (upgrade_required)"),
            "404": errorResponse("Проект не найден"),
            ...common,
          },
        },
      },
      "/qrcodes/{id}": {
        get: {
          tags: ["QR-коды"],
          operationId: "getQrCode",
          summary: "QR-код",
          parameters: [idParam("ID QR-кода")],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { qrcode: { $ref: "#/components/schemas/QrCode" } } },
                },
              },
            },
            "404": errorResponse("Не найден"),
            ...common,
          },
        },
        patch: {
          tags: ["QR-коды"],
          operationId: "updateQrCode",
          summary: "Сменить назначение QR без перепечатки",
          parameters: [idParam("ID QR-кода")],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/QrCodeUpdate" } } },
          },
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { qrcode: { $ref: "#/components/schemas/QrCode" } } },
                },
              },
            },
            "400": errorResponse("Некорректные поля"),
            "403": errorResponse("Режим недоступен на тарифе (upgrade_required)"),
            "404": errorResponse("Не найден"),
            ...common,
          },
        },
        delete: {
          tags: ["QR-коды"],
          operationId: "deleteQrCode",
          summary: "Удалить QR-код",
          description: "Напечатанный код после удаления показывает «QR-код не активирован». Отзывы остаются.",
          parameters: [idParam("ID QR-кода")],
          responses: {
            "200": {
              description: "Удалён",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { deleted: { type: "boolean" }, id: { type: "string" } },
                  },
                },
              },
            },
            "404": errorResponse("Не найден"),
            ...common,
          },
        },
      },
      "/qrcodes/{id}/image": {
        get: {
          tags: ["QR-коды"],
          operationId: "getQrCodeImage",
          summary: "Картинка QR-кода (PNG или SVG)",
          description:
            "Чёрно-белый код со ссылкой `scanUrl`. Оформленные стили (цвета, логотип, арт-формы) скачиваются из кабинета.",
          parameters: [
            idParam("ID QR-кода"),
            { name: "format", in: "query", schema: { type: "string", enum: ["png", "svg"], default: "png" } },
            {
              name: "size",
              in: "query",
              description: "Ширина в пикселях",
              schema: { type: "integer", minimum: 128, maximum: 2048, default: 1024 },
            },
          ],
          responses: {
            "200": {
              description: "Картинка",
              content: {
                "image/png": { schema: { type: "string", format: "binary" } },
                "image/svg+xml": { schema: { type: "string" } },
              },
            },
            "400": errorResponse("Некорректные параметры"),
            "404": errorResponse("Не найден"),
            ...common,
          },
        },
      },
      "/reviews": {
        get: {
          tags: ["Отзывы"],
          operationId: "listReviews",
          summary: "Отзывы и жалобы гостей",
          description:
            "Оценки 1–5★, оставленные через QR. Жалобы (`isNegative: true`) владелец видит раньше публичных площадок. `guestContact` — телефон, Telegram или email гостя, если он его оставил.",
          parameters: [
            { name: "projectId", in: "query", schema: { type: "string" } },
            { name: "qrCodeId", in: "query", schema: { type: "string" } },
            { name: "negative", in: "query", description: "Только жалобы / только позитив", schema: { type: "boolean" } },
            { name: "since", in: "query", description: "Не раньше даты (ISO 8601)", schema: { type: "string", format: "date-time" } },
            limitParam,
            cursorParam,
          ],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      reviews: { type: "array", items: { $ref: "#/components/schemas/Review" } },
                      nextCursor: { type: ["string", "null"] },
                    },
                  },
                },
              },
            },
            "400": errorResponse("Некорректные параметры"),
            ...common,
          },
        },
      },
      "/stats": {
        get: {
          tags: ["Статистика"],
          operationId: "getStats",
          summary: "Сканирования и отзывы за период",
          description: "По умолчанию — последние 30 дней. Дни считаются по МСК. Период — не больше 366 дней.",
          parameters: [
            { name: "projectId", in: "query", schema: { type: "string" } },
            { name: "qrCodeId", in: "query", schema: { type: "string" } },
            { name: "from", in: "query", schema: { type: "string", format: "date" } },
            { name: "to", in: "query", schema: { type: "string", format: "date" } },
          ],
          responses: {
            "200": {
              description: "OK",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Stats" } } },
            },
            "400": errorResponse("Некорректные параметры"),
            "404": errorResponse("Проект или QR не найден"),
            ...common,
          },
        },
      },
    },
    components: {
      securitySchemes: {
        apiKey: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "qrs_…",
          description: "API-ключ из кабинета: Настройки → API-ключи",
        },
      },
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: {
                  type: "string",
                  enum: [
                    "unauthorized",
                    "rate_limited",
                    "invalid_request",
                    "not_found",
                    "upgrade_required",
                    "internal_error",
                  ],
                },
                message: { type: "string" },
                requiredPlan: { type: ["string", "null"], description: "Для upgrade_required" },
              },
            },
          },
        },
        Me: {
          type: "object",
          properties: {
            user: {
              type: "object",
              properties: { id: { type: "string" }, email: { type: "string" }, name: { type: ["string", "null"] } },
            },
            plan: {
              type: "object",
              properties: {
                id: { type: "string", enum: ["FREE", "PRO", "NETWORK"] },
                label: { type: "string" },
                paidFeatures: { type: "boolean" },
                currentPeriodEnd: { type: ["string", "null"], format: "date-time" },
              },
            },
            limits: {
              type: "object",
              properties: {
                projects: { type: ["integer", "null"], description: "null — без лимита" },
                projectsUsed: { type: "integer" },
                qrCodesPerProject: { type: "null", description: "QR-кодов — без лимита" },
                requestsPerMinute: { type: "integer" },
              },
            },
          },
        },
        ProjectInput: {
          type: "object",
          properties: {
            name: { type: "string", maxLength: 120 },
            industry: { type: ["string", "null"], enum: [...INDUSTRIES, null] },
            address: { type: ["string", "null"], maxLength: 300 },
            phone: { type: ["string", "null"], maxLength: 40 },
            yandexMapsUrl: { type: ["string", "null"], description: "Карточка организации на Яндекс Картах" },
            twoGisUrl: { type: ["string", "null"], description: "Карточка фирмы в 2GIS" },
            avitoUrl: { type: ["string", "null"] },
          },
        },
        Project: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            industry: { type: ["string", "null"], enum: [...INDUSTRIES, null] },
            address: { type: ["string", "null"] },
            phone: { type: ["string", "null"] },
            yandexMapsUrl: { type: ["string", "null"] },
            twoGisUrl: { type: ["string", "null"] },
            avitoUrl: { type: ["string", "null"] },
            micrositeUrl: { type: ["string", "null"] },
            role: { type: "string", enum: ["owner", "member"] },
            qrcodes: { type: "integer" },
            reviews: { type: "integer" },
            totalScans: { type: "integer" },
            createdAt: { type: "string", format: "date-time" },
            dashboardUrl: { type: "string" },
          },
        },
        QrCode: {
          type: "object",
          properties: {
            id: { type: "string" },
            code: { type: "string", description: "Короткий код в ссылке /q/{code}" },
            label: { type: ["string", "null"] },
            mode: { type: "string", enum: ALL_MODES },
            redirectUrl: { type: ["string", "null"] },
            isActive: { type: "boolean" },
            projectId: { type: ["string", "null"] },
            scanUrl: { type: "string", description: "Ссылка, зашитая в картинку QR" },
            imageUrl: { type: "string", description: "PNG/SVG, нужен тот же API-ключ" },
            scansCount: { type: "integer", description: "Сканирований за всё время" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        QrCodeCreate: {
          type: "object",
          required: ["projectId"],
          properties: {
            projectId: { type: "string" },
            label: { type: "string", maxLength: 120, description: "Подпись для себя: «Стол 5», «Витрина»" },
            mode: {
              type: "string",
              enum: WRITABLE_MODES,
              description:
                "REVIEW — сбор отзывов (4–5★ на Яндекс/2GIS, 1–3★ жалоба владельцу); REDIRECT — переход по ссылке; MENU, BUSINESS_CARD, WIFI — раздел проекта; LANDING — микросайт (PRO)",
            },
            redirectUrl: { type: "string", description: "Обязателен для REDIRECT" },
          },
        },
        QrCodeUpdate: {
          type: "object",
          properties: {
            label: { type: ["string", "null"], maxLength: 120 },
            mode: { type: "string", enum: WRITABLE_MODES },
            redirectUrl: { type: ["string", "null"] },
          },
        },
        Review: {
          type: "object",
          properties: {
            id: { type: "string" },
            rating: { type: "integer", minimum: 1, maximum: 5 },
            comment: { type: ["string", "null"] },
            guestName: { type: ["string", "null"] },
            guestContact: { type: ["string", "null"] },
            isNegative: { type: "boolean", description: "Жалоба (по умолчанию 1–3★)" },
            isProcessed: { type: "boolean" },
            projectId: { type: "string" },
            qrCodeId: { type: ["string", "null"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Stats: {
          type: "object",
          properties: {
            period: {
              type: "object",
              properties: {
                from: { type: "string", format: "date-time" },
                to: { type: "string", format: "date-time" },
                timezone: { type: "string" },
              },
            },
            scans: {
              type: "object",
              properties: {
                total: { type: "integer" },
                daily: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { date: { type: "string", format: "date" }, scans: { type: "integer" } },
                  },
                },
                topQrCodes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      qrCodeId: { type: "string" },
                      code: { type: "string" },
                      label: { type: ["string", "null"] },
                      scans: { type: "integer" },
                    },
                  },
                },
              },
            },
            reviews: {
              type: "object",
              properties: {
                total: { type: "integer" },
                negative: { type: "integer" },
                averageRating: { type: ["number", "null"] },
                byRating: { type: "object", additionalProperties: { type: "integer" } },
              },
            },
          },
        },
      },
    },
  };
}
