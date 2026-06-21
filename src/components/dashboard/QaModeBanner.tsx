"use client";

import { useEffect, useState } from "react";
import {
  clearAnalyticsExclusionCookie,
  isAnalyticsDisabledClient,
} from "@/lib/analytics-exclusion";

export default function QaModeBanner() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isAnalyticsDisabledClient());
  }, []);

  if (!active) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-[100] border-b border-amber-300/60 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-950"
    >
      <span>Режим QA: статистика не учитывается</span>
      {" · "}
      <button
        type="button"
        className="underline underline-offset-2 hover:text-amber-900"
        onClick={() => {
          clearAnalyticsExclusionCookie();
          setActive(false);
          window.location.reload();
        }}
      >
        Выключить
      </button>
    </div>
  );
}
