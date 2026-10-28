"use client";

import { isAnalyticsDisabledClient } from "@/lib/analytics-exclusion";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

const METRIKA_ID = Number(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID ?? "109307713");

/** Связывает userId аккаунта с ClientID Метрики для offline-конверсий. */
export default function MetrikaUserLinker() {
  const { data: session } = useSession();

  useEffect(() => {
    if (isAnalyticsDisabledClient()) return;
    if (!session?.user || typeof window === "undefined") return;
    const userId = (session.user as Record<string, unknown>).id;
    if (typeof userId !== "string" || !userId) return;

    // tag.js грузится async: сессия часто приходит раньше, чем появляется window.ym.
    // Без UserID офлайн-конверсии (establishment_created, payment_success) не привязываются.
    let attempts = 0;
    let timer: number | undefined;
    const link = () => {
      if (window.ym) {
        window.ym(METRIKA_ID, "setUserID", userId);
        return;
      }
      if (++attempts < 50) timer = window.setTimeout(link, 200);
    };
    link();
    return () => window.clearTimeout(timer);
  }, [session]);

  return null;
}
