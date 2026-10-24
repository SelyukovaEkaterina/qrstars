"use client";

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import type { SetupProfile } from "@/lib/setup-guide";
import { isSetupWizardPath } from "@/lib/setup-wizard-path";

const popoverRight = { side: "right" as const };

/** Сайдбар виден только на lg+; ниже — в закрытом drawer, поэтому якорный тур не работает. */
const MOBILE_QUERY = "(max-width: 1023.98px)";
/** Слушает DashboardChrome: открывает мобильное меню. */
const OPEN_DASHBOARD_MENU_EVENT = "qrstars:open-dashboard-menu";

function welcomeText(profile: SetupProfile | null, menuRef: string): string {
  const tail = `Пройдём по ${menuRef} — что где лежит и зачем.`;
  if (profile === "landing") return `Проект, микросайт и QR уже созданы. ${tail}`;
  if (profile === "redirect") return `QR с прямой ссылкой уже работает. ${tail}`;
  if (profile === "reviews") return `QR на сбор отзывов уже работает. ${tail}`;
  return tail;
}

function finishText(profile: SetupProfile | null, menuRef: string): string {
  if (profile === "landing") {
    return `Оформите блоки в «Микросайт» и проверьте QR. Тур можно повторить кнопкой «Помощь» внизу ${menuRef}.`;
  }
  if (profile === "reviews") {
    return `Подключите Telegram в «Аккаунт и уведомления» и проверьте ссылки на карты в настройках проекта. Тур — через «Помощь» внизу ${menuRef}.`;
  }
  return `Настройте проект и QR под свою задачу. Тур можно повторить кнопкой «Помощь» внизу ${menuRef}.`;
}

type MobileStep = { title: string; description: string; showMenuButton?: boolean };

/** Короткий тур для экранов < 1024px: без якорей, карточкой-шторкой снизу. */
function buildMobileSteps(profile: SetupProfile | null): MobileStep[] {
  const qrHint =
    profile === "landing"
      ? "В «QR-коды» — коды проекта для печати, в «Микросайт» — блоки страницы."
      : profile === "redirect"
        ? "В «QR-коды» — ваш QR с прямой ссылкой, можно добавить коды на микросайт, отзывы, меню или Wi-Fi."
        : "В «QR-коды» — ваш QR на сбор отзывов, можно добавить микросайт, меню, Wi-Fi или редирект.";
  return [
    {
      title: "Добро пожаловать в QrStars!",
      description: welcomeText(profile, "меню (☰)"),
    },
    {
      title: "Меню проекта",
      description: `Кнопка ☰ слева вверху открывает меню. В блоке «Проект»: Главная, QR-коды, Микросайт, Обратная связь, Статистика и Настройки проекта. ${qrHint}`,
      showMenuButton: true,
    },
    {
      title: "Аккаунт",
      description:
        "Ниже в меню: «Тариф и оплата», «Аккаунт и уведомления» (Telegram / MAX / email для жалоб и заявок), шаблоны оформления QR, партнёрская программа и поддержка.",
      showMenuButton: true,
    },
    {
      title: "Готово!",
      description: finishText(profile, "меню (☰)"),
    },
  ];
}

function buildSteps(profile: SetupProfile | null): DriveStep[] {
  const isLanding = profile === "landing";
  const isRedirect = profile === "redirect";

  const welcomeDesc = welcomeText(profile, "левому меню");
  const finishDesc = finishText(profile, "меню");

  return [
    {
      popover: {
        title: "Добро пожаловать в QrStars!",
        description: welcomeDesc,
      },
    },
    {
      element: "#tour-sidebar-logo",
      popover: {
        title: "Логотип",
        description:
          "Всегда возвращает на главную проекта: статус настройки, QR и свежая обратная связь.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-dashboard",
      popover: {
        title: "Главная",
        description:
          "Сводка по текущему проекту: сканы, оценки и подсказки, что настроить дальше.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-qrcodes",
      popover: {
        title: "QR-коды",
        description: isLanding
          ? "Список QR проекта: микросайт, быстрый раздел, редирект или файл. Скачайте PNG/SVG для печати или слайда."
          : isRedirect
            ? "Ваш QR ведёт по прямой ссылке. Можно добавить коды на микросайт, отзывы, меню или Wi-Fi."
            : "Ваш QR открывает сбор отзывов. Можно создать ещё коды: микросайт, меню, Wi-Fi, редирект.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-my-page",
      popover: {
        title: "Микросайт",
        description: isLanding
          ? "Единая мобильная страница из блоков: визитка, ссылки, меню, Wi-Fi, отзывы, чаевые и оформление."
          : "Контент, который видит человек после сканирования. QR только выбирает, какой раздел открыть.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-reviews",
      popover: {
        title: "Обратная связь",
        description: isLanding
          ? "Отзывы, оценки, заявки и вопросы с форм. Счётчик непрочитанных — в меню."
          : "Все оценки, тексты и заявки. 1–3★ — вам, 4–5★ — на площадки по вашим сценариям.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-analytics",
      popover: {
        title: "Статистика",
        description: isLanding
          ? "Сканирования QR и активность по дням. На PRO — расширенные графики и выгрузка CSV."
          : "Сканирования, оценки и динамика. На PRO — детальная статистика и CSV.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-establishments",
      popover: {
        title: "Настройки проекта",
        description:
          "Название, адрес, ссылки на Яндекс.Карты / 2GIS и доступ команды. Для сети — несколько проектов.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-settings",
      popover: {
        title: "Аккаунт и уведомления",
        description:
          "Профиль, пароль и подключение Telegram / MAX / email для жалоб, заявок и формы «Связь».",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-templates",
      popover: {
        title: "Шаблоны оформления",
        description:
          "Стили QR-кодов на уровне аккаунта: цвета, логотип и готовые пресеты. Привязка стиля — в карточке конкретного QR.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-partner",
      popover: {
        title: "Партнёрская программа",
        description:
          "Реферальная ссылка и статистика: 15% с оплат PRO рефералов через 30 дней.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-support",
      popover: {
        title: "Поддержка",
        description:
          "Переписка с командой QrStars: вопросы по тарифу, QR, интеграциям. Можно предложить идею.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-subscription",
      popover: {
        title: "Тариф и оплата",
        description:
          "Текущий план FREE / PRO / «Сеть», смена тарифа и оплата. PRO — умная ротация площадок, Telegram/MAX для жалоб, white-label и расширенная аналитика. «Сеть» — несколько проектов.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-help",
      popover: {
        title: "Помощь",
        description:
          "Повторно запустить этот тур по меню. Рядом — выход из аккаунта.",
        ...popoverRight,
      },
    },
    {
      popover: {
        title: "Готово!",
        description: finishDesc,
      },
    },
  ];
}

interface OnboardingTourProps {
  userId: string;
  completed: boolean;
  setupProfile?: SetupProfile | null;
}

/** Локальный fallback на userId: закрытие не зависит от устаревшего RSC-prop layout. */
function tourDismissedKey(userId: string) {
  return `qrstars_onboarding_tour_done:${userId}`;
}

function readTourDismissedLocal(userId: string): boolean {
  try {
    return localStorage.getItem(tourDismissedKey(userId)) === "1";
  } catch {
    return false;
  }
}

function writeTourDismissedLocal(userId: string) {
  try {
    localStorage.setItem(tourDismissedKey(userId), "1");
  } catch {
    /* private mode */
  }
}

export function OnboardingTour({
  userId,
  completed,
  setupProfile = null,
}: OnboardingTourProps) {
  const pathname = usePathname();
  const driverRef = useRef<Driver | null>(null);
  /** Не писать onboardingCompleted при programmatic destroy (рестарт тура). */
  const skipMarkCompleteRef = useRef(false);
  /** Автозапуск только один раз за жизнь компонента — иначе pathname/loading дают цикл. */
  const autoStartedRef = useRef(completed || readTourDismissedLocal(userId));
  const [dismissed, setDismissed] = useState(
    () => completed || readTourDismissedLocal(userId),
  );
  const steps = useMemo(() => buildSteps(setupProfile), [setupProfile]);
  const mobileSteps = useMemo(() => buildMobileSteps(setupProfile), [setupProfile]);
  /** Индекс шага мобильного тура; null — мобильный тур не показан. */
  const [mobileStep, setMobileStep] = useState<number | null>(null);

  const markTourClosed = useCallback(() => {
    setDismissed(true);
    autoStartedRef.current = true;
    writeTourDismissedLocal(userId);
    fetch("/api/user/onboarding", { method: "PATCH" }).catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (completed) {
      autoStartedRef.current = true;
      setDismissed(true);
      writeTourDismissedLocal(userId);
    }
  }, [completed, userId]);

  const closeMobileTour = useCallback(() => {
    setMobileStep(null);
    markTourClosed();
  }, [markTourClosed]);

  const startTour = useCallback(() => {
    if (driverRef.current) {
      skipMarkCompleteRef.current = true;
      driverRef.current.destroy();
      skipMarkCompleteRef.current = false;
    }

    if (window.matchMedia(MOBILE_QUERY).matches) {
      setMobileStep(0);
      return;
    }

    const d = driver({
      showProgress: true,
      showButtons: ["next", "previous", "close"],
      nextBtnText: "Далее",
      prevBtnText: "Назад",
      doneBtnText: "Готово",
      progressText: "{{current}} из {{total}}",
      popoverClass: "onboarding-popover",
      allowClose: true,
      // Иначе клик по подсвеченному логотипу (Link → /dashboard) уводит со страницы
      // и эффект ниже снова запускает тур — визуально «бесконечный» онбординг.
      disableActiveInteraction: true,
      onDestroyed: () => {
        driverRef.current = null;
        // Крестик, оверлей, Escape, «Готово» — всё через destroy → считаем тур закрытым.
        if (skipMarkCompleteRef.current) return;
        markTourClosed();
      },
      steps,
    });

    driverRef.current = d;
    d.drive();
  }, [steps, markTourClosed]);

  useEffect(() => {
    if (dismissed || completed || isSetupWizardPath(pathname)) return;
    if (autoStartedRef.current) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    /** Ждём стабильный Sidebar: на /qrcodes/new он монтируется дважды (loading → контент). */
    const tryStart = (attempt: number) => {
      if (cancelled || autoStartedRef.current) return;
      const logo = document.querySelector("#tour-sidebar-logo");
      if (!logo) {
        if (attempt < 25) retryTimer = setTimeout(() => tryStart(attempt + 1), 200);
        return;
      }
      retryTimer = setTimeout(() => {
        if (cancelled || autoStartedRef.current) return;
        if (!logo.isConnected) {
          tryStart(attempt + 1);
          return;
        }
        autoStartedRef.current = true;
        startTour();
      }, 500);
    };

    const initial = setTimeout(() => tryStart(0), 400);

    return () => {
      cancelled = true;
      clearTimeout(initial);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [completed, dismissed, pathname, startTour]);

  useEffect(() => {
    const handler = () => {
      // Ручной повтор из «Помощь» — не сбрасываем факт закрытия в БД/localStorage.
      setDismissed(false);
      startTour();
    };
    window.addEventListener("start-onboarding-tour", handler);
    return () => window.removeEventListener("start-onboarding-tour", handler);
  }, [startTour]);

  useEffect(() => {
    return () => {
      if (!driverRef.current) return;
      skipMarkCompleteRef.current = true;
      driverRef.current.destroy();
      skipMarkCompleteRef.current = false;
    };
  }, []);

  if (mobileStep === null || typeof document === "undefined") return null;

  return createPortal(
    <MobileTourSheet
      steps={mobileSteps}
      index={mobileStep}
      onChange={setMobileStep}
      onClose={closeMobileTour}
    />,
    document.body,
  );
}

function MobileTourSheet({
  steps,
  index,
  onChange,
  onClose,
}: {
  steps: MobileStep[];
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const step = steps[Math.min(index, steps.length - 1)];
  const isLast = index >= steps.length - 1;

  useEffect(() => {
    sheetRef.current?.focus({ preventScroll: true });
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="onboarding-sheet-title"
      tabIndex={-1}
      className="onboarding-sheet fixed inset-x-0 bottom-0 z-[70] rounded-t-2xl border-t border-gray-200 bg-white px-4 pt-4 shadow-[0_-12px_40px_rgba(0,0,0,0.15)] outline-none lg:hidden"
    >
      <div className="mx-auto max-w-lg">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-400">
              {index + 1} из {steps.length}
            </p>
            <h2 id="onboarding-sheet-title" className="mt-0.5 text-base font-bold text-gray-900">
              {step.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть тур"
            className="-mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{step.description}</p>
        <div className="mt-3 flex items-center gap-2">
          {step.showMenuButton && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event(OPEN_DASHBOARD_MENU_EVENT))}
              className="flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
            >
              <Menu className="h-4 w-4" />
              Открыть меню
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => onChange(index - 1)}
                className="h-10 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Назад
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? onClose() : onChange(index + 1))}
              className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {isLast ? "Готово" : "Далее"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
