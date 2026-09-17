"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  BarChart3,
  Bell,
  Check,
  Coffee,
  CreditCard,
  Crown,
  ExternalLink,
  FileText,
  Palette,
  QrCode,
  Star,
  Wifi,
  X,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { PLAN_PRICING, PLANS, formatRub } from "@/lib/plans";

const LANDING_TILES: { icon: typeof Coffee; label: string }[] = [
  { icon: Coffee, label: "Меню" },
  { icon: Star, label: "Отзывы" },
  { icon: CreditCard, label: "Визитка" },
  { icon: Wifi, label: "Wi‑Fi" },
  { icon: Banknote, label: "Чаевые" },
  { icon: FileText, label: "Свои страницы" },
];

const LANDING_BENEFITS: { icon: typeof QrCode; title: string; text: string }[] = [
  {
    icon: QrCode,
    title: "Один QR вместо нескольких наклеек",
    text: "Не нужно печатать отдельные таблички под меню, отзывы и Wi‑Fi — гость сам выбирает нужный раздел.",
  },
  {
    icon: ArrowRight,
    title: "Гость делает больше за один визит",
    text: "Посмотрел меню, подключился к Wi‑Fi и оставил отзыв — всё с одного сканирования.",
  },
  {
    icon: Palette,
    title: "Страница выглядит как ваша",
    text: "Логотип, обложка, фирменный цвет и светлая или тёмная тема — вместо стандартной страницы с вотермаркой.",
  },
];

/** Иконки идут по порядку PLANS.PRO.features (без микросайта), лишние падают на Check. */
const EXTRA_PRO_ICONS = [Star, Bell, Palette, Banknote, BarChart3, QrCode, Crown];

interface LandingProPaywallProps {
  open: boolean;
  onClose: () => void;
  /** Пробный период ещё не использован — показываем кнопку «Попробовать». */
  trialEligible?: boolean;
  trialDays?: number;
  trialStarting?: boolean;
  trialError?: string | null;
  onStartTrial?: () => void;
}

export default function LandingProPaywall({
  open,
  onClose,
  trialEligible = false,
  trialDays = 14,
  trialStarting = false,
  trialError = null,
  onStartTrial,
}: LandingProPaywallProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const extraProFeatures = PLANS.PRO.features.filter(
    (f) => !f.toLowerCase().startsWith("микросайт")
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Микросайт на тарифе PRO"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-7 text-white">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide">
            <Crown className="w-3.5 h-3.5" />
            PRO
          </span>
          <h2 className="mt-3 text-2xl font-bold leading-tight">
            Микросайт — мини-сайт заведения в одном QR
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-indigo-100">
            Вместо одного раздела гость попадает на страницу заведения со всеми сервисами:
            меню, отзывы, визитка, Wi‑Fi. Контент настраивается один раз в «Моей странице»,
            QR перепечатывать не нужно.
          </p>
        </div>

        <div className="px-6 py-6 space-y-7">
          <section>
            <h3 className="text-sm font-semibold text-gray-900">Что увидит гость</h3>
            <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="grid grid-cols-3 gap-2.5">
                {LANDING_TILES.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2 py-3 text-center"
                  >
                    <Icon className="w-5 h-5 text-indigo-600" />
                    <span className="text-[11px] font-medium text-gray-700 leading-tight">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center text-xs text-gray-500">
                Ненужные разделы выключаются тумблерами — порядок и названия плиток вы задаёте сами.
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900">Зачем он нужен</h3>
            <div className="mt-3 space-y-3">
              {LANDING_BENEFITS.map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                    <Icon className="w-4.5 h-4.5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{title}</p>
                    <p className="text-sm text-gray-500 leading-relaxed">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900">Что ещё даёт PRO</h3>
            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {extraProFeatures.map((feature, i) => {
                const Icon = EXTRA_PRO_ICONS[i] ?? Check;
                return (
                  <li
                    key={feature}
                    className="flex gap-2.5 rounded-xl border border-gray-200 px-3 py-2.5"
                  >
                    <Icon className="w-4 h-4 flex-shrink-0 mt-0.5 text-indigo-600" />
                    <span className="text-sm text-gray-700 leading-snug">{feature}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className="sticky bottom-0 border-t border-gray-100 bg-white/95 px-6 py-4 backdrop-blur">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">
              {formatRub(PLAN_PRICING.PRO.monthlyRub)}/мес
            </span>{" "}
            или {formatRub(PLAN_PRICING.PRO.yearlyRub)}/год — {PLAN_PRICING.PRO.yearlyNote}
          </p>

          {trialError && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {trialError}
            </p>
          )}

          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            {trialEligible && onStartTrial ? (
              <>
                <Button
                  type="button"
                  className="sm:flex-1"
                  disabled={trialStarting}
                  onClick={onStartTrial}
                >
                  {trialStarting ? (
                    "Включаем…"
                  ) : (
                    <>
                      Попробовать {trialDays} дней бесплатно
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
                <Link href="/dashboard/subscription" className="sm:flex-1">
                  <Button type="button" variant="outline" className="w-full">
                    Подключить PRO
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/dashboard/subscription" className="sm:flex-1">
                  <Button type="button" className="w-full">
                    Подключить PRO
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link
                  href="/q/demo-landing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sm:flex-1"
                >
                  <Button type="button" variant="outline" className="w-full">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Посмотреть демо
                  </Button>
                </Link>
              </>
            )}
            <Button type="button" variant="ghost" onClick={onClose}>
              Позже
            </Button>
          </div>

          {trialEligible && onStartTrial && (
            <p className="mt-3 text-xs leading-relaxed text-gray-500">
              Карта не нужна, автоматических списаний нет. Через {trialDays} дней микросайт
              останется открытым для гостей — напечатанные QR не сломаются, но менять разделы и
              оформление можно будет только на PRO за{" "}
              {formatRub(PLAN_PRICING.PRO.monthlyRub)}/мес.{" "}
              <Link
                href="/q/demo-landing"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-indigo-600 hover:text-indigo-800"
              >
                Посмотреть демо
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
