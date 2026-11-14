"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  SETUP_GUIDE_DISMISS_KEY,
  isSetupRedirectExemptPath,
} from "@/lib/setup-wizard-path";

/** Клиентский редирект на мастер «первый запуск» — статус всегда с API, без устаревшего RSC-кэша layout. */
export default function SetupGuideRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isSetupRedirectExemptPath(pathname)) return;
    if (sessionStorage.getItem(SETUP_GUIDE_DISMISS_KEY) === "1") return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/setup/status", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const { needsSetup } = (await res.json()) as { needsSetup?: boolean };
        if (!needsSetup || cancelled || isSetupRedirectExemptPath(pathname)) return;
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
