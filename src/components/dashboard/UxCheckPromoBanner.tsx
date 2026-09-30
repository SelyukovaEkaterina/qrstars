"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ScanSearch, X } from "lucide-react";

const HIDE_UNTIL_KEY = "qrstars.uxcheckPromoHiddenUntil";
const SNOOZE_DAYS = 30;

const UXCHECK_URL =
  "https://uxcheck.ru/?utm_source=qrstars&utm_medium=referral&utm_campaign=qrstars_cross&utm_content=dashboard_banner";

/** Промо соседнего сервиса UXCheck — ИИ-аудит юзабилити сайта. Скрывается на 30 дней. */
export default function UxCheckPromoBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const hiddenUntil = Number(localStorage.getItem(HIDE_UNTIL_KEY) ?? 0);
      setVisible(!(hiddenUntil > Date.now()));
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;
  if (pathname === "/dashboard/subscription") return null;

  return (
    <div className="flex items-center gap-3 border-b border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-950">
      <ScanSearch className="h-4 w-4 shrink-0 text-emerald-600" />
      <p className="min-w-0 flex-1 leading-snug">
        <span className="font-semibold">Сайт теряет заявки?</span>{" "}
        <span className="text-emerald-900/80">
          Наш второй сервис UXCheck проходит сайт в реальном браузере и находит битые кнопки, трение
          в формах и слабые тексты. Первый аудит бесплатно, без карты.
        </span>{" "}
        <a
          href={UXCHECK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline"
        >
          Проверить сайт
        </a>
      </p>
      <button
        type="button"
        aria-label="Скрыть"
        className="shrink-0 rounded-md p-1 text-emerald-600 transition-colors hover:bg-emerald-100 hover:text-emerald-800"
        onClick={() => {
          setVisible(false);
          try {
            localStorage.setItem(
              HIDE_UNTIL_KEY,
              String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000),
            );
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
