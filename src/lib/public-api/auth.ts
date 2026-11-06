import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notifyException } from "@/lib/error-alerts";
import { rateLimit } from "@/lib/rate-limit";
import { hashApiKey, looksLikeApiKey } from "@/lib/public-api/keys";

/** Запросов в минуту на один ключ. */
export const API_RATE_LIMIT_PER_MIN = 120;
/** lastUsedAt пишем не чаще раза в минуту на ключ. */
const LAST_USED_THROTTLE_MS = 60_000;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export type ApiErrorCode =
  | "unauthorized"
  | "rate_limited"
  | "invalid_request"
  | "not_found"
  | "upgrade_required"
  | "internal_error";

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  extra?: Record<string, unknown>,
  headers?: Record<string, string>
): NextResponse {
  return withApiHeaders(
    NextResponse.json({ error: { code, message, ...extra } }, { status, headers })
  );
}

export function apiJson(data: unknown, init?: { status?: number }): NextResponse {
  return withApiHeaders(NextResponse.json(data, init));
}

export function withApiHeaders<T extends Response>(response: T): T {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function apiOptions(): NextResponse {
  return withApiHeaders(new NextResponse(null, { status: 204 }));
}

export interface ApiAuth {
  userId: string;
  keyId: string;
}

function extractKey(request: Request): string | null {
  const auth = request.headers.get("authorization");
  const match = auth?.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

/** Проверяет `Authorization: Bearer qrs_…` и лимит запросов. Кабинетная cookie-сессия здесь не принимается. */
export async function authenticateApiRequest(
  request: Request
): Promise<{ ok: true; auth: ApiAuth } | { ok: false; response: NextResponse }> {
  const key = extractKey(request);
  if (!key || !looksLikeApiKey(key)) {
    return {
      ok: false,
      response: apiError(
        401,
        "unauthorized",
        "Передайте API-ключ в заголовке Authorization: Bearer qrs_… Ключ создаётся в кабинете: Настройки → API-ключи."
      ),
    };
  }

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(key) },
    select: { id: true, userId: true, revokedAt: true, lastUsedAt: true },
  });
  if (!apiKey || apiKey.revokedAt) {
    return {
      ok: false,
      response: apiError(401, "unauthorized", "API-ключ не найден или отозван"),
    };
  }

  const limited = rateLimit(`api-v1:${apiKey.id}`, API_RATE_LIMIT_PER_MIN, 60_000);
  if (!limited.ok) {
    return {
      ok: false,
      response: apiError(
        429,
        "rate_limited",
        `Не больше ${API_RATE_LIMIT_PER_MIN} запросов в минуту на ключ`,
        undefined,
        { "Retry-After": String(limited.retryAfterSeconds) }
      ),
    };
  }

  const now = Date.now();
  if (!apiKey.lastUsedAt || now - apiKey.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
    prisma.apiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date(now) } })
      .catch(() => {});
  }

  return { ok: true, auth: { userId: apiKey.userId, keyId: apiKey.id } };
}

/** Тело запроса как объект; `null` — не JSON или не объект. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Обёртка роута: авторизация + перехват непредвиденных ошибок в JSON-ответ. */
export function withApiAuth<C>(
  handler: (request: Request, auth: ApiAuth, context: C) => Promise<Response>
) {
  return async (request: Request, context: C): Promise<Response> => {
    const result = await authenticateApiRequest(request);
    if (!result.ok) return result.response;
    try {
      return await handler(request, result.auth, context);
    } catch (e) {
      const path = new URL(request.url).pathname;
      console.error("[api-v1]", request.method, path, e);
      notifyException(e, { origin: "request", path, method: request.method, routeType: "route" }).catch(() => {});
      return apiError(500, "internal_error", "Внутренняя ошибка сервера");
    }
  };
}
