"use client";

import { useEffect, useState } from "react";
import {
  clearAnalyticsExclusionCookie,
  isAnalyticsDisabledClient,
} from "@/lib/analytics-exclusion";

/** Класс на <html>: globals.css выставляет --qa-banner-h, и хедер/контент кабинета сдвигаются вниз. */
const QA_HTML_CLASS = "qa-mode";

export default function QaModeBanner() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isAnalyticsDisabledClient());
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (active) root.classList.add(QA_HTML_CLASS);
    else root.classList.remove(QA_HTML_CLASS);
    return () => root.classList.remove(QA_HTML_CLASS);
  }, [active]);

  if (!active) return null;

  return (
    <div
      role="status"
      className="dash-qa-banner fixed inset-x-0 top-0 z-[60] bg-amber-50 shadow-[0_1px_0_rgb(252_211_77_/_0.6)] text-amber-950"
    >
      <div className="flex h-7 items-center justify-center gap-1 truncate px-4 text-xs">
        <span className="truncate">Режим QA: статистика не учитывается</span>
        <span aria-hidden>·</span>
        <button
          type="button"
          className="shrink-0 underline underline-offset-2 hover:text-amber-900"
          onClick={() => {
            clearAnalyticsExclusionCookie();
            setActive(false);
            window.location.reload();
          }}
        >
          Выключить
        </button>
      </div>
    </div>
  );
}
