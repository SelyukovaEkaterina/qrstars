"use client";

import { useSyncExternalStore } from "react";

const WIDE_QUERY = "(min-width: 1024px)";

function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Экран ≥1024 px — показываем сайт для компьютера. null — до гидрации (сервер не знает ширину). */
export function useWideScreen(): boolean | null {
  return useSyncExternalStore<boolean | null>(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => null
  );
}

const noopSubscribe = () => () => {};

/** Параметры адреса на момент открытия (на сервере — пусто). */
export function useInitialSearch(): string {
  return useSyncExternalStore(noopSubscribe, () => window.location.search, () => "");
}
