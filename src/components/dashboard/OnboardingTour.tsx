"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
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
        title: "Моя страница",
        description: isLanding
          ? "Единый контент для гостей: меню, Wi‑Fi, визитка, сценарии отзывов, чаевые, оформление (цвет, обложка, светлая/тёмная тема). Включайте блоки тумблерами — QR только открывает нужный раздел."
          : "Меню, Wi‑Fi, визитка, отзывы, чаевые и брендинг страницы. Всё, что видит гость на микро-лендинге, редактируется здесь, а не в настройках QR.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-qrcodes",
      popover: {
        title: "Все коды",
        description: isLanding
          ? "Список QR: микро-лендинг, быстрый раздел (меню, отзывы, Wi‑Fi), редирект или файл. У каждого кода — своя маршрутизация; контент подтягивается с «Моя страница». Скачайте PNG/PDF для печати."
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
          ? "Жалобы и оценки появятся, когда включите блок «Сбор отзывов» на «Моя страница» и укажете ссылки на карты в заведении."
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
        title: "Шаблоны QR-кода",
        description:
          "Готовые оформления QR-кодов (цвет, логотип, фон) — применяйте к кодам одним кликом. Свои пресеты сохраняются для всех QR заведения.",
        ...popoverRight,
      },
    },
    {
      element: "#tour-nav-templates-table-tents",
      popover: {
        title: "Шаблоны табличек",
        description:
          "Макеты табличек и стикеров для печати с QR-кодом. Выберите готовый или создайте свой и привяжите к динамическому QR в настройках кода.",
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
  completed: boolean;
  setupProfile?: SetupProfile | null;
}

export function OnboardingTour({ completed, setupProfile = null }: OnboardingTourProps) {
  const pathname = usePathname();
  const driverRef = useRef<Driver | null>(null);
  const steps = useMemo(() => buildSteps(setupProfile), [setupProfile]);

  const startTour = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
    }

    const d = driver({
      showProgress: true,
      showButtons: ["next", "previous", "close"],
      nextBtnText: "Далее",
      prevBtnText: "Назад",
      doneBtnText: "Готово",
      progressText: "{{current}} из {{total}}",
      popoverClass: "onboarding-popover",
      onDestroyed: () => {
        fetch("/api/user/onboarding", { method: "PATCH" }).catch(() => {});
      },
      steps,
    });

    driverRef.current = d;
    d.drive();
  }, [steps]);

  useEffect(() => {
    if (completed || isSetupWizardPath(pathname)) return;

    const timer = setTimeout(() => {
      startTour();
    }, 800);

    return () => clearTimeout(timer);
  }, [completed, pathname, startTour]);

  useEffect(() => {
    const handler = () => startTour();
    window.addEventListener("start-onboarding-tour", handler);
    return () => window.removeEventListener("start-onboarding-tour", handler);
  }, [startTour]);

  return null;
}
