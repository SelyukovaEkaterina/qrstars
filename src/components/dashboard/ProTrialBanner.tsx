"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, X } from "lucide-react";

const DISMISS_KEY = "qrstars.proTrialBannerDismissed";

/** Полоса «идёт пробный PRO» со счётчиком дней — во всех разделах кабинета. */
export default function ProTrialBanner() {
  const pathname = usePathname();
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/subscription/trial", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { active?: boolean; daysLeft?: number | null };
        if (!data.active || cancelled) return;
        setDaysLeft(data.daysLeft ?? null);
        setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
      } catch {
        /* нет сети — баннер просто не показываем */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (daysLeft === null || dismissed) return null;
  if (pathname === "/dashboard/subscription") return null;

  return (
    <div className="flex items-center gap-3 border-b border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm text-indigo-950">
      <Crown className="h-4 w-4 shrink-0 text-indigo-600" />
      <p className="min-w-0 flex-1 leading-snug">
        <span className="font-semibold">Пробный PRO: осталось {daysLeft} дн.</span>{" "}
        <span className="text-indigo-900/80">
          Списаний не будет — после окончания тариф вернётся на FREE.
        </span>{" "}
        <Link href="/dashboard/subscription" className="font-medium underline">
          Подключить PRO
        </Link>
      </p>
      <button
        type="button"
        aria-label="Скрыть"
        className="shrink-0 rounded-md p-1 text-indigo-500 transition-colors hover:bg-indigo-100 hover:text-indigo-700"
        onClick={() => {
          setDismissed(true);
          try {
            sessionStorage.setItem(DISMISS_KEY, "1");
          } catch {
            /* приватный режим */
          }
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
