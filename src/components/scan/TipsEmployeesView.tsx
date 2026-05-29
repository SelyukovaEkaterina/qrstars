"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink, ArrowLeft } from "lucide-react";

export interface TipsEmployeeData {
  id: string;
  name: string;
  photoUrl?: string | null;
  paymentType: "LINK" | "PHONE";
  paymentUrl?: string | null;
  phone?: string | null;
  bankName?: string | null;
}

interface TipsEmployeesViewProps {
  employees: TipsEmployeeData[];
  establishmentName?: string | null;
  brandColor?: string;
  pageAppearance?: "light" | "dark";
}

function bankEmoji(name: string): string {
  const map: [string, string][] = [
    ["тинькофф", "🟡"], ["т-банк", "🟡"],
    ["сбер", "🟢"],
    ["втб", "🔵"],
    ["альфа", "🔴"],
    ["озон", "🟣"],
  ];
  const lower = name.toLowerCase();
  for (const [key, emoji] of map) {
    if (lower.includes(key)) return emoji;
  }
  return "🏦";
}

function EmployeeCard({
  emp,
  brandColor,
  isDark,
  onSelect,
}: {
  emp: TipsEmployeeData;
  brandColor: string;
  isDark: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left active:scale-95 ${
        isDark
          ? "border-gray-600 bg-gray-700 hover:border-gray-400"
          : "border-gray-100 bg-white hover:border-indigo-200 shadow-sm"
      }`}
    >
      {emp.photoUrl ? (
        <img
          src={emp.photoUrl}
          alt={emp.name}
          className="w-14 h-14 rounded-full object-cover shrink-0"
        />
      ) : (
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
          style={{ backgroundColor: brandColor }}
        >
          {emp.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-base">{emp.name}</p>
        <p className={`text-xs mt-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          {emp.paymentType === "LINK" ? "Оплата онлайн" : `СБП · ${emp.bankName || "банк"}`}
        </p>
      </div>
      <svg className={`w-5 h-5 shrink-0 ${isDark ? "text-gray-500" : "text-gray-300"}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

function EmployeePayView({
  emp,
  brandColor,
  isDark,
  onBack,
}: {
  emp: TipsEmployeeData;
  brandColor: string;
  isDark: boolean;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const num = (emp.phone ?? "").replace(/\s/g, "");
    try {
      await navigator.clipboard.writeText(num);
    } catch {
      const el = document.createElement("input");
      el.value = num;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (emp.paymentType === "LINK" && emp.paymentUrl) {
    window.location.replace(emp.paymentUrl);
    return (
      <div className="text-center space-y-3 py-10">
        <div className="text-4xl animate-bounce">💰</div>
        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>Переходим к оплате...</p>
        <a href={emp.paymentUrl} className="inline-flex items-center gap-1 text-sm underline" style={{ color: brandColor }}>
          <ExternalLink className="w-3 h-3" /> Перейти вручную
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className={`flex items-center gap-1.5 text-sm font-medium ${isDark ? "text-gray-300 hover:text-white" : "text-gray-500 hover:text-gray-800"}`}
      >
        <ArrowLeft className="w-4 h-4" /> Назад
      </button>

      {/* Employee header */}
      <div className="flex items-center gap-4">
        {emp.photoUrl ? (
          <img src={emp.photoUrl} alt={emp.name} className="w-16 h-16 rounded-full object-cover shrink-0" />
        ) : (
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold shrink-0"
            style={{ backgroundColor: brandColor }}
          >
            {emp.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-bold text-lg">{emp.name}</p>
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>Чаевые сотруднику</p>
        </div>
      </div>

      {/* Phone block */}
      {emp.phone && (
        <div className={`rounded-xl p-4 space-y-3 ${isDark ? "bg-gray-700" : "bg-gray-50 border border-gray-100"}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Перевод по номеру телефона
          </p>
          <div className="flex items-center gap-3 mb-1">
            {emp.bankName && <span className="text-2xl">{bankEmoji(emp.bankName)}</span>}
            <div className="flex-1 min-w-0">
              <p className="text-xl font-bold tracking-widest">{emp.phone}</p>
              {emp.bankName && (
                <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>{emp.bankName}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
              copied ? "bg-green-500 text-white" : "text-white"
            }`}
            style={copied ? undefined : { backgroundColor: brandColor }}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Номер скопирован!" : "Скопировать номер"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function TipsEmployeesView({
  employees,
  establishmentName,
  brandColor = "#4f46e5",
  pageAppearance = "light",
}: TipsEmployeesViewProps) {
  const isDark = pageAppearance === "dark";
  const [selected, setSelected] = useState<TipsEmployeeData | null>(null);

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center px-4 py-10 ${isDark ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
      <div className={`w-full max-w-sm rounded-2xl shadow-xl overflow-hidden ${isDark ? "bg-gray-800" : "bg-white"}`}>
        <div className="h-1.5" style={{ backgroundColor: brandColor }} />

        <div className="p-6 space-y-5">
          {!selected && (
            <div className="text-center space-y-1">
              <div className="text-4xl">💰</div>
              <h1 className="text-xl font-bold">Оставить чаевые</h1>
              {establishmentName && (
                <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  {establishmentName}
                </p>
              )}
            </div>
          )}

          {selected ? (
            <EmployeePayView
              emp={selected}
              brandColor={brandColor}
              isDark={isDark}
              onBack={() => setSelected(null)}
            />
          ) : employees.length === 0 ? (
            <p className={`text-center text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Нет доступных сотрудников
            </p>
          ) : (
            <div className="space-y-3">
              <p className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                Выберите сотрудника:
              </p>
              {employees.map((emp) => (
                <EmployeeCard
                  key={emp.id}
                  emp={emp}
                  brandColor={brandColor}
                  isDark={isDark}
                  onSelect={() => setSelected(emp)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
