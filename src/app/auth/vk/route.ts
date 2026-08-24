import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { authenticateWithVk, VkAuthError } from "@/lib/vk-auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

function configuredOrigins(request: Request): Set<string> {
  const values = [
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    request.url,
  ];
  const origins = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    try {
      origins.add(new URL(value).origin);
    } catch {
      // Некорректный env не должен ронять обработчик до понятной ошибки конфигурации.
    }
  }
  return origins;
}

function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return configuredOrigins(request).has(origin);
}

function isValidPkceVerifier(value: string): boolean {
  return /^[A-Za-z0-9_-]{43,128}$/.test(value);
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  }

  const ip = getClientIp(request);
  const limit = rateLimit(`vk-login:${ip}`, 20, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Слишком много попыток входа. Попробуйте позже." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const input = body as {
    code?: unknown;
    deviceId?: unknown;
    codeVerifier?: unknown;
    state?: unknown;
  };
  const code = typeof input.code === "string" ? input.code.trim() : "";
  const deviceId = typeof input.deviceId === "string" ? input.deviceId.trim() : "";
  const codeVerifier =
    typeof input.codeVerifier === "string" ? input.codeVerifier.trim() : "";
  const state = typeof input.state === "string" ? input.state.trim() : undefined;

  if (
    !code ||
    code.length > 2048 ||
    !deviceId ||
    deviceId.length > 512 ||
    !isValidPkceVerifier(codeVerifier) ||
    (state && state.length > 512)
  ) {
    return NextResponse.json(
      { error: "Некорректные параметры авторизации VK" },
      { status: 400 }
    );
  }

  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Сервис авторизации временно не настроен" },
      { status: 503 }
    );
  }

  try {
    const user = await authenticateWithVk({
      code,
      deviceId,
      codeVerifier,
      state,
    });
    const sessionToken = await encode({
      secret,
      maxAge: SESSION_MAX_AGE,
      token: {
        sub: user.id,
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    const secure =
      process.env.NEXTAUTH_URL?.startsWith("https://") ??
      process.env.NODE_ENV === "production";
    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: `${secure ? "__Secure-" : ""}next-auth.session-token`,
      value: sessionToken,
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    if (error instanceof VkAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("VK ID login failed:", error);
    return NextResponse.json(
      { error: "Не удалось выполнить вход через VK" },
      { status: 503 }
    );
  }
}
