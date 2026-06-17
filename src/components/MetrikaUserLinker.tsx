"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";

const METRIKA_ID = Number(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID ?? "109307713");

/** Связывает userId аккаунта с ClientID Метрики для offline-конверсий. */
export default function MetrikaUserLinker() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user || typeof window === "undefined" || !window.ym) return;
    const userId = (session.user as Record<string, unknown>).id;
    if (typeof userId !== "string" || !userId) return;
    window.ym(METRIKA_ID, "setUserID", userId);
  }, [session]);

  return null;
}
