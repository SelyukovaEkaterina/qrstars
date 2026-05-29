"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight, ChevronLeft, Sparkles, QrCode, BarChart3 } from "lucide-react";
import type { ElementType } from "react";

type Track = "popup" | "retail-media";

interface TourStep {
  targetId: string;
  title: string;
  description: string;
}

interface TrackConfig {
  name: string;
  icon: ElementType;
  color: string;
  tagline: string;
  steps: TourStep[];
}

const TRACKS: Record<Track, TrackConfig> = {
  popup: {
    name: "Popup / QR-таблички",
    icon: QrCode,
    color: "amber",
    tagline: "Физический продукт + управление отзывами",
    steps: [
      {
        targetId: "nav-overview",
        title: "Обзор платформы",
        description:
          "Главный дашборд показывает ключевые метрики: количество пользователей, заведений, собранных отзывов и QR-кодов. Отсюда виден «пульс» всей платформы.",
      },
      {
        targetId: "nav-batches",
        title: "Наборы табличек",
        description:
          "Здесь создаются партии физических QR-акриловых тейбл-тентов. Каждый QR уникален и «пустой» до момента активации. После покупки на WB/Ozon владелец сканирует QR и привязывает его к своему заведению.",
      },
      {
        targetId: "nav-establishments",
        title: "Заведения",
        description:
          "Все зарегистрированные точки бизнеса (кафе, салоны, клиники). Каждое заведение содержит ссылки на Яндекс.Карты / 2GIS, брендинг, меню, визитку и сценарии маршрутизации отзывов.",
      },
      {
        targetId: "nav-reviews",
        title: "Отзывы",
        description:
          "Весь трафик отзывов: оценки 4–5★ уходят на внешние площадки (Яндекс, 2GIS), оценки 1–3★ остаются внутри как жалоба владельцу. Здесь видно всё — и позитив, и негатив.",
      },
      {
        targetId: "nav-users",
        title: "Пользователи",
        description:
          "Список владельцев заведений. Можно искать по email, менять тариф (FREE → PRO), просматривать заведения пользователя и блокировать аккаунт при необходимости.",
      },
      {
        targetId: "nav-support",
        title: "Поддержка",
        description:
          "Тикеты от клиентов. Каждый тикет — отдельная тема в Telegram-форуме: оператор отвечает прямо в Telegram, сообщения автоматически синхронизируются с личным кабинетом клиента.",
      },
    ],
  },
  "retail-media": {
    name: "Retail-Media",
    icon: BarChart3,
    color: "violet",
    tagline: "Монетизация, партнёрка и аналитика продаж",
    steps: [
      {
        targetId: "nav-overview",
        title: "Дашборд выручки",
        description:
          "Ключевые показатели: MRR от PRO-подписок, динамика регистраций и отзывов за 30/60 дней. Отсюда видно, растёт ли выручка и насколько активна платформа.",
      },
      {
        targetId: "nav-payments",
        title: "Подписки (PRO)",
        description:
          "Все активные PRO и «Сеть» подписки. Оплата через ЮKassa, 54-ФЗ. Видна история платежей, даты продления и общий MRR. Здесь же можно отследить отток.",
      },
      {
        targetId: "nav-orders",
        title: "Заказы табличек",
        description:
          "Физические заказы акриловых тейбл-тентов через Wildberries, Ozon или прямые продажи. Каждый заказ связан с партией уникальных QR-кодов. Маржа ~650 ₽ с таблички.",
      },
      {
        targetId: "nav-partner-withdrawals",
        title: "Выводы партнёров",
        description:
          "Партнёры получают 15% от каждого платежа реферала (холд 30 дней). Здесь заявки на вывод от 10 000 ₽. Обрабатываются вручную переводом на расчётный счёт ИП/ООО.",
      },
      {
        targetId: "nav-establishments",
        title: "Клиентские заведения",
        description:
          "Каждое заведение = потенциальный апсейл в PRO. Заведения с активными QR-кодами — самые ценные клиенты. Видны тариф, дата регистрации и активность.",
      },
      {
        targetId: "nav-users",
        title: "Клиентская база",
        description:
          "Сегментация пользователей: FREE vs PRO, дата регистрации, реферальные связи. Отличный источник для ручного аутрича и промо-кодов для конверсии в PRO.",
      },
    ],
  },
};

const STORAGE_KEY = "admin_onboarding_done";

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function lsRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

interface TooltipPos {
  top: number;
  left: number;
}

export default function OnboardingWizard() {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"idle" | "pick" | "tour" | "done">("idle");
  const [track, setTrack] = useState<Track | null>(null);
  const [step, setStep] = useState(0);
  const [tooltipPos, setTooltipPos] = useState<TooltipPos | null>(null);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!lsGet(STORAGE_KEY)) {
      setPhase("pick");
    }
  }, []);

  const positionTooltip = useCallback((targetId: string) => {
    const el = document.querySelector(`[data-tour-id="${targetId}"]`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setHighlightRect(rect);
    const spaceRight = window.innerWidth - rect.right;
    if (spaceRight > 340) {
      setTooltipPos({ top: rect.top, left: rect.right + 16 });
    } else {
      setTooltipPos({ top: rect.bottom + 12, left: Math.min(rect.left, window.innerWidth - 340) });
    }
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const startTour = useCallback(
    (chosen: Track) => {
      setTrack(chosen);
      setStep(0);
      setPhase("tour");
      setTimeout(() => positionTooltip(TRACKS[chosen].steps[0].targetId), 100);
    },
    [positionTooltip]
  );

  const goNext = useCallback(() => {
    if (!track) return;
    const steps = TRACKS[track].steps;
    if (step < steps.length - 1) {
      const next = step + 1;
      setStep(next);
      positionTooltip(steps[next].targetId);
    } else {
      lsSet(STORAGE_KEY, "1");
      setPhase("done");
      setHighlightRect(null);
      setTooltipPos(null);
    }
  }, [track, step, positionTooltip]);

  const goPrev = useCallback(() => {
    if (!track || step === 0) return;
    const prev = step - 1;
    setStep(prev);
    positionTooltip(TRACKS[track].steps[prev].targetId);
  }, [track, step, positionTooltip]);

  const skip = useCallback(() => {
    lsSet(STORAGE_KEY, "1");
    setPhase("idle");
    setHighlightRect(null);
    setTooltipPos(null);
  }, []);

  const restart = useCallback(() => {
    lsRemove(STORAGE_KEY);
    setTrack(null);
    setStep(0);
    setHighlightRect(null);
    setTooltipPos(null);
    setPhase("pick");
  }, []);

  // Don't render anything until mounted on client
  if (!mounted) return null;

  // ── Idle: show restart button ──────────────────────────────────────────────
  if (phase === "idle") {
    return createPortal(
      <button
        onClick={restart}
        title="Запустить тур по продукту"
        className="fixed bottom-6 right-6 z-50 bg-amber-500 hover:bg-amber-400 text-gray-900 rounded-full w-11 h-11 flex items-center justify-center shadow-lg transition-colors"
      >
        <Sparkles className="w-5 h-5" />
      </button>,
      document.body
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  if (phase === "done") {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-white mb-2">Тур завершён!</h2>
          <p className="text-gray-400 text-sm mb-6">
            Теперь вы знаете, где что находится. Кнопка{" "}
            <Sparkles className="inline w-4 h-4 text-amber-400" /> в правом нижнем углу
            запустит тур снова в любой момент.
          </p>
          <button
            onClick={() => setPhase("idle")}
            className="w-full bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold py-2.5 rounded-lg transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // ── Pick track ─────────────────────────────────────────────────────────────
  if (phase === "pick") {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h2 className="text-xl font-bold text-white">Добро пожаловать!</h2>
            </div>
            <button onClick={skip} className="text-gray-500 hover:text-gray-300 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-gray-400 text-sm mb-6">
            Давайте проведём быстрый тур по админ-панели. Что хотите изучить?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(Object.keys(TRACKS) as Track[]).map((t) => {
              const cfg = TRACKS[t];
              const Icon = cfg.icon;
              const isAmber = cfg.color === "amber";
              return (
                <button
                  key={t}
                  onClick={() => startTour(t)}
                  className={`flex flex-col items-start p-5 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-100 ${
                    isAmber
                      ? "border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20"
                      : "border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20"
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg mb-3 ${
                      isAmber ? "bg-amber-500/20" : "bg-violet-500/20"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${isAmber ? "text-amber-400" : "text-violet-400"}`}
                    />
                  </div>
                  <p
                    className={`font-semibold text-sm mb-1 ${
                      isAmber ? "text-amber-300" : "text-violet-300"
                    }`}
                  >
                    {cfg.name}
                  </p>
                  <p className="text-gray-400 text-xs">{cfg.tagline}</p>
                </button>
              );
            })}
          </div>
          <button
            onClick={skip}
            className="w-full mt-4 text-gray-500 hover:text-gray-300 text-sm transition-colors py-2"
          >
            Пропустить тур
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // ── Tour ───────────────────────────────────────────────────────────────────
  if (!track) return null;
  const cfg = TRACKS[track];
  const steps = cfg.steps;
  const currentStep = steps[step];
  const isAmber = cfg.color === "amber";
  const accentText = isAmber ? "text-amber-400" : "text-violet-400";
  const accentBg = isAmber ? "bg-amber-500" : "bg-violet-500";
  const accentBgHover = isAmber ? "hover:bg-amber-400" : "hover:bg-violet-400";
  const accentRing = isAmber ? "ring-amber-400" : "ring-violet-400";

  return createPortal(
    <>
      {/* Overlay segments with cutout around highlighted element */}
      {highlightRect && (
        <div className="fixed inset-0 z-[9990] pointer-events-none">
          {/* top */}
          <div
            className="absolute bg-black/65"
            style={{ top: 0, left: 0, right: 0, height: Math.max(0, highlightRect.top - 6) }}
          />
          {/* bottom */}
          <div
            className="absolute bg-black/65"
            style={{ top: highlightRect.bottom + 6, left: 0, right: 0, bottom: 0 }}
          />
          {/* left */}
          <div
            className="absolute bg-black/65"
            style={{
              top: highlightRect.top - 6,
              left: 0,
              width: Math.max(0, highlightRect.left - 6),
              height: highlightRect.height + 12,
            }}
          />
          {/* right */}
          <div
            className="absolute bg-black/65"
            style={{
              top: highlightRect.top - 6,
              left: highlightRect.right + 6,
              right: 0,
              height: highlightRect.height + 12,
            }}
          />
          {/* highlight ring */}
          <div
            className={`absolute rounded-lg ring-2 ${accentRing}`}
            style={{
              top: highlightRect.top - 6,
              left: highlightRect.left - 6,
              width: highlightRect.width + 12,
              height: highlightRect.height + 12,
            }}
          />
        </div>
      )}

      {/* Click blocker (everything outside spotlight is non-interactive) */}
      <div className="fixed inset-0 z-[9991]" onClick={skip} />

      {/* Tooltip card */}
      {tooltipPos && (
        <div
          className="fixed z-[9999] w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-5 pointer-events-auto"
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* header */}
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-semibold uppercase tracking-wide ${accentText}`}>
              {cfg.name} · {step + 1}/{steps.length}
            </span>
            <button onClick={skip} className="text-gray-500 hover:text-gray-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* progress bar */}
          <div className="w-full bg-gray-700 rounded-full h-1 mb-4">
            <div
              className={`h-1 rounded-full transition-all duration-300 ${accentBg}`}
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>

          <h3 className="text-white font-semibold mb-2">{currentStep.title}</h3>
          <p className="text-gray-400 text-sm leading-relaxed mb-5">{currentStep.description}</p>

          <div className="flex items-center justify-between">
            <button
              onClick={goPrev}
              disabled={step === 0}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Назад
            </button>
            <button
              onClick={goNext}
              className={`flex items-center gap-1 text-sm font-semibold text-gray-900 px-4 py-1.5 rounded-lg transition-colors ${accentBg} ${accentBgHover}`}
            >
              {step < steps.length - 1 ? (
                <>
                  Дальше
                  <ChevronRight className="w-4 h-4" />
                </>
              ) : (
                "Завершить"
              )}
            </button>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
