"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ScanSearch, X } from "lucide-react";

const HIDE_UNTIL_KEY = "qrstars.uxcheckPromoHiddenUntil";
const SNOOZE_DAYS = 30;

const UXCHECK_URL =
  "https://uxcheck.ru/?utm_source=qrstars&utm_medium=referral&utm_campaign=qrstars_cross&utm_content=dashboard_banner";

/** Только главная проекта: /dashboard/projects/[id] (без вложенных разделов и «Без проекта»). */
const PROJECT_HOME_RE = /^\/dashboard\/projects\/(?!unassigned$)[^/]+\/?$/;

/**
 * Промо соседнего сервиса UXCheck — ИИ-аудит юзабилити сайта. Скрывается на 30 дней.
 * Показывается только на главной проекта; на мобильном — одна-две строки.
 */
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
  if (!pathname || !PROJECT_HOME_RE.test(pathname)) return null;

  return (
    <div className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 py-1.5 pl-4 pr-1 text-xs text-emerald-950 sm:gap-3 sm:py-2.5 sm:pr-4 sm:text-sm">
      <ScanSearch className="hidden h-4 w-4 shrink-0 text-emerald-600 sm:block" />
      <p className="min-w-0 flex-1 leading-snug">
        <span className="font-semibold">Сайт теряет заявки?</span>{" "}
        <span className="text-emerald-900/80 sm:hidden">UXCheck найдёт ошибки, первый аудит бесплатно.</span>
        <span className="hidden text-emerald-900/80 sm:inline">
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
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-emerald-600 sm:h-auto sm:w-auto sm:p-1 transition-colors hover:bg-emerald-100 hover:text-emerald-800"
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
