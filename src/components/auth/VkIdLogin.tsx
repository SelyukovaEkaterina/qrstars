"use client";

import { useEffect, useRef, useState } from "react";
import * as VKID from "@vkid/sdk";
import type { AuthResponse } from "@vkid/sdk";

const VK_PKCE_STORAGE_KEY = "qrstars_vk_code_verifier";
const VK_STATE_STORAGE_KEY = "qrstars_vk_state";
const PKCE_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const RAW_VK_APP_ID = process.env.NEXT_PUBLIC_VK_CLIENT_ID?.trim();
const VK_APP_ID = RAW_VK_APP_ID ? Number(RAW_VK_APP_ID) : Number.NaN;
const VK_IS_CONFIGURED = Number.isInteger(VK_APP_ID) && VK_APP_ID > 0;

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(
    VK_IS_CONFIGURED ? "" : "Вход через VK пока не настроен"
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const redirectUrl =
      process.env.NEXT_PUBLIC_VK_REDIRECT_URI?.trim() ||
      `${window.location.origin}/auth/vk/callback`;

    if (!VK_IS_CONFIGURED) return;
    if (!containerRef.current) return;

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
          width: Math.min(containerRef.current.clientWidth || 360, 360),
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
  }, []);

  return (
    <div className="space-y-3">
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
