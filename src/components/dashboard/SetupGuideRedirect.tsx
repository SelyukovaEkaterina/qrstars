"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const EXEMPT_PREFIXES = ["/dashboard/start"];

function isExempt(pathname: string | null): boolean {
  if (!pathname) return false;
  return EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Клиентский редирект на мастер «первый запуск» — статус всегда с API, без устаревшего RSC-кэша layout. */
export default function SetupGuideRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isExempt(pathname)) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/setup/status", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const { needsSetup } = (await res.json()) as { needsSetup?: boolean };
        if (!needsSetup || cancelled || isExempt(pathname)) return;
        router.replace("/dashboard/start");
      } catch {
        /* сеть — не редиректим вслепую */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
