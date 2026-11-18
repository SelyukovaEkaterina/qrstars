"use client";

import { useEffect } from "react";

/**
 * Засчитывает заход на короткий адрес проекта (`{slug}.qrstars.ru`, `/a/{slug}`):
 * один раз на вкладку (sessionStorage). Сканы QR сюда не попадают — они идут через `/q/{code}`.
 */
export default function SiteVisitBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `qrstars_visit:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* приватный режим — считаем как есть */
    }
    const body = JSON.stringify({ slug });
    const url = "/api/site-visit";
    try {
      if (navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" }))) return;
    } catch {
      /* упадём в fetch */
    }
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }, [slug]);
  return null;
}
