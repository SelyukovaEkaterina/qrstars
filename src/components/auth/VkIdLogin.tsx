"use client";

import { useEffect, useRef, useState } from "react";
import * as VKID from "@vkid/sdk";
import type { AuthResponse } from "@vkid/sdk";
import { rememberRegistrationUtm } from "@/lib/registration-utm";

const VK_PKCE_STORAGE_KEY = "qrstars_vk_code_verifier";
const VK_STATE_STORAGE_KEY = "qrstars_vk_state";
const PKCE_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const RAW_VK_APP_ID = process.env.NEXT_PUBLIC_VK_CLIENT_ID?.trim();
const VK_APP_ID = RAW_VK_APP_ID ? Number(RAW_VK_APP_ID) : Number.NaN;
const VK_IS_CONFIGURED = Number.isInteger(VK_APP_ID) && VK_APP_ID > 0;
// OneTap рендерится в iframe фиксированной ширины, допустимый диапазон — 200–400px.
const VK_MIN_WIDTH = 200;
const VK_MAX_WIDTH = 400;

function randomString(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => PKCE_CHARS[byte % PKCE_CHARS.length]).join("");
}

export async function finishVkIdLogin(
  auth: Pick<AuthResponse, "code" | "device_id" | "state">,
  codeVerifier: string
): Promise<void> {
  const response = await fetch("/auth/vk", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: auth.code,
      deviceId: auth.device_id,
      codeVerifier,
      state: auth.state,
    }),
  });
  const data = (await response.json().catch(() => null)) as
    | { success?: boolean; error?: string }
    | null;

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || "Не удалось войти через VK");
  }
}

export { VK_PKCE_STORAGE_KEY, VK_STATE_STORAGE_KEY };

export default function VkIdLogin() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [widgetWidth, setWidgetWidth] = useState<number | null>(null);
  const [error, setError] = useState(
    VK_IS_CONFIGURED ? "" : "Вход через VK пока не настроен"
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    rememberRegistrationUtm(window.location.search);
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!VK_IS_CONFIGURED || !wrapper) return;

    let debounce: ReturnType<typeof setTimeout> | undefined;
    const measure = () => {
      const available = Math.round(wrapper.clientWidth);
      if (!available) return;
      setWidgetWidth(
        Math.min(Math.max(available, VK_MIN_WIDTH), VK_MAX_WIDTH)
      );
    };

    measure();
    const observer = new ResizeObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(measure, 150);
    });
    observer.observe(wrapper);

    return () => {
      clearTimeout(debounce);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const redirectUrl =
      process.env.NEXT_PUBLIC_VK_REDIRECT_URI?.trim() ||
      `${window.location.origin}/auth/vk/callback`;

    if (!VK_IS_CONFIGURED) return;
    if (!containerRef.current || !widgetWidth) return;

    const state = randomString(48);
    const codeVerifier = randomString(64);
    sessionStorage.setItem(VK_STATE_STORAGE_KEY, state);
    sessionStorage.setItem(VK_PKCE_STORAGE_KEY, codeVerifier);

    VKID.Config.init({
      app: VK_APP_ID,
      redirectUrl,
      responseMode: VKID.ConfigResponseMode.Callback,
      scope: "email",
      state,
      codeVerifier,
    });

    const oneTap = new VKID.OneTap();
    const onSuccess = async (payload: AuthResponse) => {
      if (payload.state !== state) {
        setError("Не удалось проверить ответ VK. Попробуйте ещё раз.");
        return;
      }

      setLoading(true);
      setError("");
      try {
        await finishVkIdLogin(payload, codeVerifier);
        sessionStorage.removeItem(VK_STATE_STORAGE_KEY);
        sessionStorage.removeItem(VK_PKCE_STORAGE_KEY);
        // Полная перезагрузка: иначе клиентский кэш NextAuth остаётся на прежнем аккаунте.
        window.location.assign("/dashboard");
      } catch (loginError) {
        setError(
          loginError instanceof Error
            ? loginError.message
            : "Не удалось войти через VK"
        );
        setLoading(false);
      }
    };
    const onError = () => {
      setError(
        "VK ID не загрузился. Проверьте настройки домена приложения VK и обновите страницу."
      );
    };

    oneTap
      .render({
        container: containerRef.current,
        showAlternativeLogin: true,
        oauthList: [VKID.OAuthName.VK, VKID.OAuthName.OK, VKID.OAuthName.MAIL],
        styles: {
          width: widgetWidth,
          height: 44,
          borderRadius: 8,
        },
      })
      .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, onSuccess)
      .on(VKID.WidgetEvents.ERROR, onError);

    return () => {
      oneTap.off(VKID.OneTapInternalEvents.LOGIN_SUCCESS, onSuccess);
      oneTap.off(VKID.WidgetEvents.ERROR, onError);
      oneTap.close();
    };
  }, [widgetWidth]);

  return (
    <div ref={wrapperRef} className="space-y-3">
      <div
        ref={containerRef}
        className={loading ? "pointer-events-none opacity-60" : ""}
        aria-busy={loading}
      />
      {loading && (
        <p className="text-center text-sm text-gray-500">Входим через VK…</p>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
