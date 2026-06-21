"use client";

import { isAnalyticsDisabledClient } from "@/lib/analytics-exclusion";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const METRIKA_ID = Number(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID ?? "109307713");

export default function YandexMetrikaTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isAnalyticsDisabledClient()) return;
    const query = searchParams.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    window.ym?.(METRIKA_ID, "hit", url);
  }, [pathname, searchParams]);

  return null;
}
