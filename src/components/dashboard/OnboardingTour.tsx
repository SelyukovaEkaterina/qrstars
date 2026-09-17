"use client";

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import type { SetupProfile } from "@/lib/setup-guide";
import { isSetupWizardPath } from "@/lib/setup-wizard-path";

const popoverRight = { side: "right" as const };

function buildSteps(profile: SetupProfile | null): DriveStep[] {
  const isLanding = profile === "landing";
  const isReviews = profile === "reviews";
  const isRedirect = profile === "redirect";

  const welcomeDesc = isLanding
    ? "Проект, микросайт и QR уже созданы. Пройдём по левому меню — что где лежит и зачем."
    : isRedirect
      ? "QR с прямой ссылкой уже работает. Пройдём по левому меню — что где лежит и зачем."
      : isReviews
        ? "QR на сбор отзывов уже работает. Пройдём по левому меню — что где лежит и зачем."
        : "Пройдём по левому меню — что где лежит и зачем.";

  const finishDesc = isLanding
    ? "Оформите блоки в «Микросайт» и проверьте QR. Тур можно повторить кнопкой «Помощь» внизу меню."
    : isReviews
      ? "Подключите Telegram в каналах уведомлений и проверьте ссылки на карты в настройках проекта. Тур — через «Помощь» внизу меню."
      : "Настройте проект и QR под свою задачу. Тур можно повторить кнопкой «Помощь» внизу меню.";

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
        title: "Каналы уведомлений",
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

  const startTour = useCallback(() => {
    if (driverRef.current) {
      skipMarkCompleteRef.current = true;
      driverRef.current.destroy();
      skipMarkCompleteRef.current = false;
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

  return null;
}
