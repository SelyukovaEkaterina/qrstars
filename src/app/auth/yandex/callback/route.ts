import { timingSafeEqual } from "node:crypto";
import { encode } from "next-auth/jwt";
import { type NextRequest, NextResponse } from "next/server";
import {
  authenticateWithYandex,
  YandexAuthError,
} from "@/lib/yandex-auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const YANDEX_STATE_COOKIE = "qrstars_yandex_oauth_state";

function clearStateCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: YANDEX_STATE_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth/yandex/callback",
    maxAge: 0,
  });
  return response;
}

function loginError(request: NextRequest, message: string): NextResponse {
  const url = new URL("/login", request.url);
  url.searchParams.set("yandex_error", message);
  return clearStateCookie(NextResponse.redirect(url));
}

function stateMatches(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = rateLimit(`yandex-login:${ip}`, 20, 10 * 60_000);
  if (!limit.ok) {
    return loginError(
      request,
      "Слишком много попыток входа. Попробуйте позже."
    );
  }

  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) {
    return loginError(request, "Вход через Яндекс отменён");
  }

  const code = request.nextUrl.searchParams.get("code")?.trim() || "";
  const state = request.nextUrl.searchParams.get("state")?.trim() || "";
  const expectedState = request.cookies.get(YANDEX_STATE_COOKIE)?.value || "";
  if (
    !code ||
    code.length > 2048 ||
    !state ||
    !expectedState ||
    !stateMatches(state, expectedState)
  ) {
    return loginError(
      request,
      "Не удалось проверить ответ Яндекса. Попробуйте ещё раз."
    );
  }

  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    return loginError(request, "Сервис авторизации временно не настроен");
  }

  try {
    const user = await authenticateWithYandex(code);
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

    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    const secure =
      process.env.NEXTAUTH_URL?.startsWith("https://") ??
      process.env.NODE_ENV === "production";
    response.cookies.set({
      name: `${secure ? "__Secure-" : ""}next-auth.session-token`,
      value: sessionToken,
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return clearStateCookie(response);
  } catch (error) {
    if (error instanceof YandexAuthError) {
      return loginError(request, error.message);
    }
    console.error("Yandex ID login failed:", error);
    return loginError(request, "Не удалось выполнить вход через Яндекс");
  }
}
