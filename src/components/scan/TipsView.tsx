"use client";

import { useState, useEffect } from "react";
import { ExternalLink, Copy, Check } from "lucide-react";

interface TipsViewProps {
  tipsType: "REDIRECT" | "PHONE";
  redirectUrl?: string | null;
  tipsPhone?: string | null;
  tipsBankName?: string | null;
  establishmentName?: string | null;
  brandColor?: string;
  pageAppearance?: "light" | "dark";
}

function bankEmoji(name: string): string {
  const map: [string, string][] = [
    ["тинькофф", "🟡"],
    ["сбер", "🟢"],
    ["втб", "🔵"],
    ["альфа", "🔴"],
    ["озон", "🟣"],
    ["т-банк", "🟡"],
  ];
  const lower = name.toLowerCase();
  for (const [key, emoji] of map) {
    if (lower.includes(key)) return emoji;
  }
  return "🏦";
}

export default function TipsView({
  tipsType,
  redirectUrl,
  tipsPhone,
  tipsBankName,
  establishmentName,
  brandColor = "#4f46e5",
  pageAppearance = "light",
}: TipsViewProps) {
  const isDark = pageAppearance === "dark";
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (tipsType === "REDIRECT" && redirectUrl) {
      window.location.replace(redirectUrl);
    }
  }, [tipsType, redirectUrl]);

  const handleCopy = async () => {
    const num = (tipsPhone ?? "").replace(/\s/g, "");
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

  if (tipsType === "REDIRECT") {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-gray-900" : "bg-gray-50"}`}>
        <div className="text-center space-y-3">
          <div className="text-4xl animate-bounce">💰</div>
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Переходим к оплате чаевых...
          </p>
          <a
            href={redirectUrl ?? "#"}
            className="inline-flex items-center gap-1 text-sm underline"
            style={{ color: brandColor }}
          >
            <ExternalLink className="w-3 h-3" />
            Перейти вручную
          </a>
        </div>
      </div>
    );
  }

  const phone = tipsPhone ?? "";
  const bank = tipsBankName ?? "";

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center px-4 py-10 ${isDark ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
      <div className={`w-full max-w-sm rounded-2xl shadow-xl overflow-hidden ${isDark ? "bg-gray-800" : "bg-white"}`}>
        <div className="h-1.5" style={{ backgroundColor: brandColor }} />

        <div className="p-6 space-y-6">
          <div className="text-center space-y-1">
            <div className="text-4xl">💰</div>
            <h1 className="text-xl font-bold">Оставить чаевые</h1>
            {establishmentName && (
              <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                {establishmentName}
              </p>
            )}
          </div>

          {phone && (
            <div className={`rounded-xl p-4 space-y-3 ${isDark ? "bg-gray-700" : "bg-gray-50 border border-gray-100"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                Перевод по номеру телефона
              </p>
              <div className="flex items-center gap-3 mb-1">
                {bank && <span className="text-2xl">{bankEmoji(bank)}</span>}
                <div className="flex-1 min-w-0">
                  <p className="text-xl font-bold tracking-widest">{phone}</p>
                  {bank && (
                    <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>{bank}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
                  copied
                    ? "bg-green-500 text-white"
                    : "text-white"
                }`}
                style={copied ? undefined : { backgroundColor: brandColor }}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Номер скопирован!" : "Скопировать номер"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
