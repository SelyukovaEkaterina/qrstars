"use client";

import { useEffect, useRef, useCallback } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";

const STEPS = [
  {
    popover: {
      title: "Добро пожаловать в QrStars! 🎉",
      description:
        "Мы поможем вам собирать отзывы и управлять репутацией заведения. Давайте быстро познакомимся с интерфейсом — это займёт меньше минуты.",
    },
  },
  {
    element: "#tour-sidebar-logo",
    popover: {
      title: "Логотип",
      description:
        "Нажмите сюда, чтобы вернуться на главную страницу дашборда в любой момент.",
      side: "right" as const,
    },
  },
  {
    element: "#tour-nav-dashboard",
    popover: {
      title: "Обзор",
      description:
        "Сводка и аналитика: сканирования, оценки, отзывы и графики по заведениям.",
      side: "right" as const,
    },
  },
  {
    element: "#tour-nav-establishments",
    popover: {
      title: "Заведения",
      description:
        "Создавайте и настраивайте организации. Укажите ссылки на Яндекс.Карты, 2GIS, Авито — именно туда будут направляться гости с хорошими оценками.",
      side: "right" as const,
    },
  },
  {
    element: "#tour-nav-my-page",
    popover: {
      title: "Моя страница",
      description:
        "Микро-лендинг вашего заведения: меню, визитка, Wi-Fi, отзывы. Контент, который видит гость при сканировании QR-кода.",
      side: "right" as const,
    },
  },
  {
    element: "#tour-nav-qrcodes",
    popover: {
      title: "QR-коды",
      description:
        "Создавайте QR-коды и активируйте таблички с маркетплейса. Каждый код — свой сценарий: лендинг, меню, отзывы, Wi-Fi.",
      side: "right" as const,
    },
  },
  {
    element: "#tour-nav-reviews",
    popover: {
      title: "Отзывы",
      description:
        "Все отзывы и жалобы от гостей. Негативные (1–3★) фильтруются и приходят вам как жалоба, позитивные (4–5★) направляются на площадки.",
      side: "right" as const,
    },
  },
  {
    element: "#tour-nav-settings",
    popover: {
      title: "Настройки",
      description:
        "Профиль, уведомления, подключение Telegram / MAX для алертов, email для жалоб.",
      side: "right" as const,
    },
  },
  {
    element: "#tour-nav-subscription",
    popover: {
      title: "Тариф",
      description:
        "Текущий план FREE / PRO / Сеть. PRO открывает умную ротацию площадок, white-label и расширенную аналитику.",
      side: "right" as const,
    },
  },
  {
    popover: {
      title: "Вы готовы! 🚀",
      description:
        "Ваш QR уже собирает отзывы. Оформите страницу в «Моя страница» или подключите Telegram в настройках для жалоб. Тур можно повторить через «Помощь» в меню.",
    },
  },
];

interface OnboardingTourProps {
  completed: boolean;
}

export function OnboardingTour({ completed }: OnboardingTourProps) {
  const driverRef = useRef<Driver | null>(null);

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
      steps: STEPS,
    });

    driverRef.current = d;
    d.drive();
  }, []);

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
