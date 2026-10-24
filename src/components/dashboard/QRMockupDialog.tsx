"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type Mockup = "plain" | "tent" | "card" | "window";

const MOCKUPS: { id: Mockup; label: string }[] = [
  { id: "plain", label: "Код" },
  { id: "tent", label: "Табличка на стол" },
  { id: "card", label: "Визитка" },
  { id: "window", label: "Наклейка на витрину" },
];

const CHECKER =
  "linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%)";

/**
 * Крупный просмотр QR и примерка на табличке, визитке и витрине.
 * Снизу — переданные элементы управления (скачивание и т.п.).
 */
export default function QRMockupDialog({
  imageUrl,
  caption = "Наведите камеру",
  onClose,
  children,
}: {
  imageUrl: string | null;
  caption?: string;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const [mockup, setMockup] = useState<Mockup>("plain");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const qr = imageUrl ? <img src={imageUrl} alt="QR-код" className="block h-auto w-full" /> : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="QR-код крупно"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[94dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-w-2xl sm:rounded-3xl sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-900">Ваш QR-код</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none]">
          {MOCKUPS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMockup(m.id)}
              className={`h-10 shrink-0 whitespace-nowrap rounded-xl border px-3.5 text-sm font-semibold transition ${
                mockup === m.id
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
          {mockup === "plain" && (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ backgroundImage: CHECKER, backgroundSize: "24px 24px", backgroundPosition: "0 0,0 12px,12px -12px,12px 0" }}
            >
              <div className="h-[88%] max-w-[82%]">
                {imageUrl && <img src={imageUrl} alt="QR-код" className="h-full w-auto object-contain" />}
              </div>
            </div>
          )}

          {mockup === "tent" && (
            <div
              className="flex h-full w-full flex-col items-center justify-end"
              style={{ background: "radial-gradient(120% 80% at 50% 0%, #fef3c7 0%, #fde68a 40%, #d6a86b 100%)" }}
            >
              <div
                className="relative z-[1] -mb-[4%] w-[44%] rounded-t-2xl rounded-b-md bg-white px-3 pb-2.5 pt-3.5 text-center shadow-[0_24px_30px_-12px_rgba(60,30,0,0.45)]"
                style={{ transform: "perspective(700px) rotateX(8deg)", transformOrigin: "bottom" }}
              >
                <div className="mb-2 text-[clamp(0.7rem,2.6vw,1rem)] font-extrabold text-slate-900">{caption}</div>
                {qr}
                <div className="mt-1.5 text-[clamp(0.5rem,1.6vw,0.65rem)] text-slate-500">QR-код · без приложений</div>
              </div>
              <div className="h-[24%] w-full bg-gradient-to-b from-amber-800 to-amber-900 shadow-[inset_0_6px_12px_rgba(0,0,0,0.25)]" />
            </div>
          )}

          {mockup === "card" && (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900">
              <div className="flex aspect-[85/55] w-[78%] -rotate-[4deg] items-center justify-between gap-[4%] rounded-lg bg-white p-[5%] shadow-[0_25px_40px_-15px_rgba(0,0,0,0.6)]">
                <div className="flex min-w-0 flex-col gap-1 text-[clamp(0.55rem,2.2vw,0.85rem)] text-slate-700">
                  <b className="text-[1.35em] text-slate-900">Анна Смирнова</b>
                  <span>Стилист · салон «Лето»</span>
                  <span className="text-slate-400">+7 900 000-00-00</span>
                </div>
                <div className="w-[40%] shrink-0">{qr}</div>
              </div>
            </div>
          )}

          {mockup === "window" && (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{
                background:
                  "linear-gradient(115deg, rgba(255,255,255,.35) 0%, rgba(255,255,255,0) 35%, rgba(255,255,255,.2) 60%, rgba(255,255,255,0) 75%), linear-gradient(180deg,#7dd3fc 0%,#0ea5e9 55%,#0369a1 100%)",
              }}
            >
              <div className="flex w-[40%] flex-col items-center gap-2 rounded-2xl bg-white p-3 text-center text-[clamp(0.6rem,2.2vw,0.9rem)] font-extrabold text-slate-900 shadow-[0_10px_25px_rgba(3,105,161,0.45)]">
                {qr}
                <span>{caption}</span>
              </div>
            </div>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-gray-400">Подписи на макетах — для примера, в файл попадает только код.</p>

        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}
