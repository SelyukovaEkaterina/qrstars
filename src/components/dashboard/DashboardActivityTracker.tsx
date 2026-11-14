"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/track-event";
import { dashboardSection, isSubscriptionHref } from "@/lib/dashboard-section";

const SEEN_KEY = "qrstars_sections_seen_v1";

/** Календарный день МСК — как в отчётах. */
function mskDay(): string {
  return new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
}

function readSeen(day: string): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { d?: string; s?: unknown };
    if (parsed.d !== day || !Array.isArray(parsed.s)) return [];
    return parsed.s.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

function writeSeen(day: string, sections: string[]) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify({ d: day, s: sections }));
  } catch {
    // приватный режим — событие уйдёт повторно, не страшно
  }
}

/**
 * Аналитика пути к оплате (UserEvent):
 * - `dash.section_viewed` — какие разделы кабинета человек открывает и в какие дни
 *   возвращается (один раз в день на раздел);
 * - `dash.upgrade_clicked` — клик по любой ссылке на «Тариф и оплата», с разделом
 *   и текстом ссылки, чтобы видеть, какой апселл работает.
 */
export default function DashboardActivityTracker({ plan }: { plan: string }) {
  const pathname = usePathname();
  const sectionRef = useRef<string | null>(null);

  useEffect(() => {
    const section = dashboardSection(pathname);
    sectionRef.current = section;
    if (!section) return;
    const day = mskDay();
    const seen = readSeen(day);
    if (seen.includes(section)) return;
    writeSeen(day, [...seen, section]);
    trackEvent("dash.section_viewed", {
      section,
      plan,
      firstToday: seen.length === 0,
    });
  }, [pathname, plan]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!link) return;
      if (!isSubscriptionHref(link.getAttribute("href"))) return;
      const from = sectionRef.current;
      if (from === "subscription") return;
      trackEvent("dash.upgrade_clicked", {
        from,
        plan,
        text: (link.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
        place: link.closest("[data-upsell]")?.getAttribute("data-upsell") ?? null,
        nav: Boolean(link.closest("nav, aside")),
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [plan]);

  return null;
}
