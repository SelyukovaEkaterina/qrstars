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
    ? "Страница заведения и QR уже созданы. Пройдём по левому меню — что где лежит и зачем."
    : isRedirect
      ? "QR с прямой ссылкой уже работает. Пройдём по левому меню — что где лежит и зачем."
      : isReviews
        ? "QR на сбор отзывов уже работает. Пройдём по левому меню — что где лежит и зачем."
        : "Пройдём по левому меню — что где лежит и зачем.";

  const finishDesc = isLanding
    ? "Оформите блоки в «Моя страница» и проверьте QR «Открыть как гость». Тур можно повторить кнопкой «Помощь» внизу меню."
    : isReviews
      ? "Подключите Telegram в настройках для жалоб и проверьте ссылки на карты в «Заведения». Тур — через «Помощь» внизу меню."
      : "Настройте заведение и QR под свою задачу. Тур можно повторить кнопкой «Помощь» внизу меню.";

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
          "Всегда возвращает на главную — сводку по заведению: сканы, оценки и быстрые действия.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-dashboard",
      popover: {
        title: "Сводка",
        description:
          "Главная дашборда: ключевые цифры за период, последние отзывы и подсказки, что настроить дальше. Сюда удобно заходить каждый день.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-analytics",
      popover: {
        title: "Аналитика",
        description: isLanding
          ? "Сканирования QR и активность гостей по дням. На PRO — расширенные графики и выгрузка CSV для сети."
          : "Сканирования, оценки, отзывы и динамика по дням. На PRO — детальная аналитика и CSV для сети заведений.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-establishments",
      popover: {
        title: "Заведения",
        description: isLanding
          ? "Название, адрес, телефон и ссылки на Яндекс.Карты / 2GIS / Авито — нужны для маршрутизации отзывов и отображения на странице. На тарифе «Сеть» — несколько точек."
          : "Карточка заведения: контакты и ссылки на площадки — сюда попадут гости с оценками 4–5★. Доступ команды и лимиты по тарифу — тоже здесь.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-my-page",
      popover: {
        title: "Страницы заведений",
        description: isLanding
          ? "Единый контент для гостей: меню, Wi‑Fi, визитка, сценарии отзывов, чаевые, оформление (цвет, обложка, светлая/тёмная тема). Включайте блоки тумблерами — QR только открывает нужный раздел."
          : "Меню, Wi‑Fi, визитка, отзывы, чаевые и брендинг страницы. Всё, что видит гость на микро-лендинге, редактируется здесь, а не в настройках QR.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-qrcodes",
      popover: {
        title: "QR-коды",
        description: isLanding
          ? "Список QR: микро-лендинг, быстрый раздел (меню, отзывы, Wi‑Fi), редирект или файл. У каждого кода — своя маршрутизация; контент подтягивается со страницы «Моя страница». Скачайте PNG/SVG для печати."
          : isRedirect
            ? "Ваш QR ведёт по прямой ссылке. Можно добавить коды на лендинг, сбор отзывов, меню или Wi‑Fi — у каждого своя маршрутизация при скане."
            : "Ваш QR открывает сбор отзывов. Можно создать ещё коды: лендинг, меню, Wi‑Fi, редирект. Стили QR и скачивание для печати — в карточке кода.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-reviews",
      popover: {
        title: "Отзывы",
        description: isLanding
          ? "Жалобы и оценки появятся, когда включите блок «Сбор отзывов» в разделе «Моя страница» и укажете ссылки на карты в заведении."
          : "Все оценки и тексты от гостей. 1–3★ — жалобы вам (email на FREE, Telegram/MAX на PRO), 4–5★ — на Яндекс, 2GIS и др. по вашим сценариям.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-submissions",
      popover: {
        title: "Заявки",
        description:
          "Сообщения с форм «Написать» на визитке и других форм на странице. Счётчик непрочитанных — в меню; открывайте заявки и отвечайте гостям.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-templates-qr",
      popover: {
        title: "Шаблоны QR-кодов",
        description:
          "Готовые оформления QR-кодов (цвет, логотип, фон) — применяйте к кодам одним кликом. Свои пресеты сохраняются для всех QR заведения.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-settings",
      popover: {
        title: "Настройки",
        description:
          "Профиль и пароль, каналы уведомлений (Telegram, MAX, email). Сюда же — подключение мессенджеров для жалоб и формы «Связь» на визитке.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-partner",
      popover: {
        title: "Партнёрка",
        description:
          "Реферальная ссылка и статистика: 15% с оплат PRO рефералов через 30 дней. История начислений и заявки на вывод от 10 000 ₽.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-support",
      popover: {
        title: "Поддержка",
        description:
          "Переписка с командой QrStars: вопросы по тарифу, QR, интеграциям. Можно прикреплять файлы; ответы приходят в этот раздел и на почту.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-subscription",
      popover: {
        title: "Тариф",
        description:
          "Текущий план FREE / PRO / «Сеть». PRO — умная ротация площадок, Telegram/MAX для жалоб, white-label и расширенная аналитика. «Сеть» — несколько заведений и сводный дашборд.",
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
