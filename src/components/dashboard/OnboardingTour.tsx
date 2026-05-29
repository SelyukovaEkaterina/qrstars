"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import type { SetupProfile } from "@/lib/setup-guide";

function buildSteps(profile: SetupProfile | null): DriveStep[] {
  const isLanding = profile === "landing";

  return [
    {
      popover: {
        title: "Добро пожаловать в QrStars! 🎉",
        description: isLanding
          ? "Страница заведения и QR уже созданы. За минуту покажем, где оформить блоки и настройки."
          : "QR на сбор отзывов уже работает. За минуту покажем интерфейс — где смотреть оценки и что настроить дальше.",
      },
    },
    {
      element: "#tour-sidebar-logo",
      popover: {
        title: "Логотип",
        description: "Нажмите сюда, чтобы вернуться на главную страницу дашборда в любой момент.",
        side: "right",
      },
    },
    {
      element: "#tour-nav-dashboard",
      popover: {
        title: "Обзор",
        description: isLanding
          ? "Сводка и аналитика: сканирования QR и активность гостей по заведениям."
          : "Сводка и аналитика: сканирования, оценки, отзывы и графики по заведениям.",
        side: "right",
      },
    },
    {
      element: "#tour-nav-establishments",
      popover: {
        title: "Заведения",
        description: isLanding
          ? "Название, телефон и ссылки на Яндекс.Карты / 2GIS — понадобятся, когда включите сбор отзывов."
          : "Ссылки на Яндекс.Карты и 2GIS — сюда попадут гости с оценками 4–5★. Можно дополнить позже.",
        side: "right",
      },
    },
    {
      element: "#tour-nav-my-page",
      popover: {
        title: "Моя страница",
        description: isLanding
          ? "Микро-лендинг: какие блоки видят гости (меню, Wi‑Fi, визитка, отзывы). Включайте и оформляйте здесь."
          : "Меню, Wi‑Fi, визитка и оформление страницы заведения — контент для гостей с QR «Микро-лендинг».",
        side: "right",
      },
    },
    {
      element: "#tour-nav-qrcodes",
      popover: {
        title: "QR-коды",
        description: isLanding
          ? "Ваш QR открывает страницу заведения. Можно создать ещё коды: сразу на отзывы, меню или Wi‑Fi."
          : "Ваш QR сразу открывает сбор отзывов. Можно добавить коды на лендинг, меню или Wi‑Fi.",
        side: "right",
      },
    },
    {
      element: "#tour-nav-reviews",
      popover: {
        title: "Отзывы",
        description: isLanding
          ? "Жалобы и оценки появятся здесь, когда включите блок «Сбор отзывов» и укажете ссылки на карты."
          : "Все отзывы и жалобы от гостей. Негативные (1–3★) — вам, позитивные (4–5★) — на площадки.",
        side: "right",
      },
    },
    {
      element: "#tour-nav-settings",
      popover: {
        title: "Настройки",
        description:
          "Профиль, уведомления, подключение Telegram / MAX для алертов, email для жалоб.",
        side: "right",
      },
    },
    {
      element: "#tour-nav-subscription",
      popover: {
        title: "Тариф",
        description:
          "Текущий план FREE / PRO / Сеть. PRO открывает умную ротацию площадок, white-label и расширенную аналитику.",
        side: "right",
      },
    },
    {
      popover: {
        title: "Вы готовы! 🚀",
        description: isLanding
          ? "Оформите блоки в «Моя страница» и проверьте QR «Открыть как гость». Тур можно повторить через «Помощь» в меню."
          : "Подключите Telegram в настройках для жалоб и оформите страницу в «Моя страница». Тур можно повторить через «Помощь» в меню.",
      },
    },
  ];
}

interface OnboardingTourProps {
  completed: boolean;
  setupProfile?: SetupProfile | null;
}

export function OnboardingTour({ completed, setupProfile = null }: OnboardingTourProps) {
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
    if (completed) return;

    const timer = setTimeout(() => {
      startTour();
    }, 800);

    return () => clearTimeout(timer);
  }, [completed, startTour]);

  useEffect(() => {
    const handler = () => startTour();
    window.addEventListener("start-onboarding-tour", handler);
    return () => window.removeEventListener("start-onboarding-tour", handler);
  }, [startTour]);

  return null;
}
