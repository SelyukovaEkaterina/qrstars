import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getYandexConfig, YandexAuthError } from "@/lib/yandex-auth";

const YANDEX_STATE_COOKIE = "qrstars_yandex_oauth_state";

export async function GET() {
  try {
    const { clientId, redirectUri } = getYandexConfig();
    const state = randomBytes(32).toString("base64url");
    const authorizeUrl = new URL("https://oauth.yandex.ru/authorize");
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set({
      name: YANDEX_STATE_COOKIE,
      value: state,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/auth/yandex/callback",
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    const message =
      error instanceof YandexAuthError
        ? error.message
        : "Вход через Яндекс временно недоступен";
    const loginUrl = new URL(
      "/login",
      process.env.NEXTAUTH_URL || "http://localhost:3000"
    );
    loginUrl.searchParams.set("yandex_error", message);
    return NextResponse.redirect(loginUrl);
  }
}
