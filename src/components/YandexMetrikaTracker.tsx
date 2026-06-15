"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const METRIKA_ID = Number(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID ?? "109307713");

declare global {
  interface Window {
    ym?: (id: number, action: string, ...args: unknown[]) => void;
  }
}

export default function YandexMetrikaTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    window.ym?.(METRIKA_ID, "hit", url);
  }, [pathname, searchParams]);

  return null;
}
