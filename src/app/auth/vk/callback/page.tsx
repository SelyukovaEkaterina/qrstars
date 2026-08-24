"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  finishVkIdLogin,
  VK_PKCE_STORAGE_KEY,
  VK_STATE_STORAGE_KEY,
} from "@/components/auth/VkIdLogin";

function VkCallbackContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const completeLogin = async () => {
      await Promise.resolve();
      const code = searchParams.get("code");
      const deviceId = searchParams.get("device_id");
      const state = searchParams.get("state") || "";
      const expectedState = sessionStorage.getItem(VK_STATE_STORAGE_KEY);
      const codeVerifier = sessionStorage.getItem(VK_PKCE_STORAGE_KEY);

      if (!code || !deviceId || !codeVerifier || !expectedState || state !== expectedState) {
        if (!cancelled) {
          setError("Не удалось проверить ответ VK. Вернитесь на страницу входа.");
        }
        return;
      }

      try {
        await finishVkIdLogin({ code, device_id: deviceId, state }, codeVerifier);
        if (cancelled) return;
        sessionStorage.removeItem(VK_STATE_STORAGE_KEY);
        sessionStorage.removeItem(VK_PKCE_STORAGE_KEY);
        if (window.opener && !window.opener.closed) {
          window.opener.location.href = "/dashboard";
          window.close();
          return;
        }
        window.location.replace("/dashboard");
      } catch (loginError) {
        if (!cancelled) {
          setError(
            loginError instanceof Error
              ? loginError.message
              : "Не удалось войти через VK"
          );
        }
      }
    };

    void completeLogin();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-indigo-50 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Вход через VK</h1>
        {error ? (
          <>
            <p className="mt-3 text-sm text-red-700">{error}</p>
            <a
              href="/login"
              className="mt-5 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              Вернуться ко входу
            </a>
          </>
        ) : (
          <p className="mt-3 text-sm text-gray-500">Завершаем авторизацию…</p>
        )}
      </div>
    </main>
  );
}

export default function VkCallbackPage() {
  return (
    <Suspense>
      <VkCallbackContent />
    </Suspense>
  );
}
