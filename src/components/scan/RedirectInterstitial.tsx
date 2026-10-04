"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  REDIRECT_INTERSTITIAL_SECONDS,
  redirectInterstitialPromoUrl,
  redirectTargetLabel,
} from "@/lib/redirect-interstitial";

interface RedirectInterstitialProps {
  code: string;
  /** Уже нормализованный `toHeaderSafeUrl` адрес перехода. */
  target: string;
}

/** Экран QrStars перед внешним переходом на FREE (см. `src/lib/redirect-interstitial.ts`). */
export default function RedirectInterstitial({ code, target }: RedirectInterstitialProps) {
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_INTERSTITIAL_SECONDS);
  const [progressStarted, setProgressStarted] = useState(false);
  const targetLabel = redirectTargetLabel(target);

  useEffect(() => {
    // Полоска плавно заполняется за весь отсчёт, а не прыгает по секундам.
    const frame = requestAnimationFrame(() => setProgressStarted(true));
    const tick = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    const go = setTimeout(() => {
      window.location.replace(target);
    }, REDIRECT_INTERSTITIAL_SECONDS * 1000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(tick);
      clearTimeout(go);
    };
  }, [target]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-indigo-50 to-white px-6">
      {/* Запасной переход, если JS не загрузился. */}
      <meta httpEquiv="refresh" content={`${REDIRECT_INTERSTITIAL_SECONDS + 1};url=${target}`} />

      <div className="w-full max-w-sm text-center space-y-6">
        <img src="/logo.svg" alt="QrStars" className="mx-auto h-10 w-auto" />

        <div className="space-y-2">
          <p className="text-lg font-semibold text-gray-900">
            {targetLabel ? (
              <>
                Переходим на <span className="text-indigo-600">{targetLabel}</span>
              </>
            ) : (
              "Переходим по ссылке"
            )}
          </p>
          <p className="text-sm text-gray-500" aria-live="polite">
            {secondsLeft > 0 ? `через ${secondsLeft} сек…` : "открываем…"}
          </p>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-indigo-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-[width] ease-linear"
            style={{
              width: progressStarted ? "100%" : "0%",
              transitionDuration: `${REDIRECT_INTERSTITIAL_SECONDS}s`,
            }}
          />
        </div>

        <a
          href={target}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-base font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          Перейти сейчас
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>

      <div className="mt-12 w-full max-w-sm rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm text-gray-600">
        Этот QR-код создан в QrStars.{" "}
        <a
          href={redirectInterstitialPromoUrl(code)}
          target="_blank"
          rel="noopener"
          className="font-medium text-indigo-600 hover:text-indigo-800"
        >
          Создайте свой бесплатно
        </a>
      </div>
    </main>
  );
}
