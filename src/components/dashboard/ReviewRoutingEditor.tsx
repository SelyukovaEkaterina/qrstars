"use client";

import { useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  type ReviewRoutingConfig,
  type StarRating,
  REVIEW_STAR_ACTIONS,
  DEFAULT_REVIEW_ROUTING,
  reviewRoutingToJson,
  isComplaintAction,
} from "@/lib/review-routing";
import { Crown, ChevronDown, ChevronUp, Loader2, Save, Star } from "lucide-react";

interface ReviewRoutingEditorProps {
  establishmentId: string;
  establishmentName?: string;
  initialRouting: ReviewRoutingConfig;
  isPro: boolean;
  onSaved?: () => void;
}

const STARS: StarRating[] = [1, 2, 3, 4, 5];

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function ReviewRoutingEditor({
  establishmentId,
  establishmentName,
  initialRouting,
  isPro,
  onSaved,
}: ReviewRoutingEditorProps) {
  const [routing, setRouting] = useState<ReviewRoutingConfig>(initialRouting);
  const [expandedStar, setExpandedStar] = useState<StarRating | null>(1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const updateStar = (star: StarRating, patch: Partial<ReviewRoutingConfig[StarRating]>) => {
    setRouting((prev) => ({
      ...prev,
      [star]: { ...prev[star], ...patch },
    }));
  };

  const handleSave = async () => {
    if (!isPro) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: establishmentId,
          reviewRouting: reviewRoutingToJson(routing),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Сценарии сохранены");
        onSaved?.();
      } else {
        setMessage(data.error || "Ошибка сохранения");
      }
    } catch {
      setMessage("Ошибка соединения");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const displayRouting = isPro ? routing : DEFAULT_REVIEW_ROUTING;

  return (
    <Card>
      <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
        <Star className="w-4 h-4 text-amber-500" />
        Сценарии по звёздам
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        Для каждой оценки — действие и тексты до и после отправки. Ссылки на площадки — в{" "}
        <Link
          href={`/dashboard/establishments/${establishmentId}`}
          className="text-indigo-600 hover:text-indigo-800"
        >
          настройках заведения
          {establishmentName ? ` «${establishmentName}»` : ""}
        </Link>
        .
      </p>

      {!isPro && <ProUpsellBanner />}


      <div className="space-y-2">
        {STARS.map((star) => {
          const step = displayRouting[star];
          const expanded = expandedStar === star;
          const disabled = !isPro;
          const actionLabel =
            REVIEW_STAR_ACTIONS.find((a) => a.value === step.action)?.label ?? step.action;

          return (
            <div
              key={star}
              className={`rounded-xl border ${expanded ? "border-indigo-200 bg-indigo-50/40" : "border-gray-200 bg-white"}`}
            >
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 text-left"
                onClick={() => setExpandedStar(expanded ? null : star)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-amber-500 font-medium shrink-0">{star} ★</span>
                  <span className="text-sm text-gray-700 truncate">{actionLabel}</span>
                </div>
                {expanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                )}
              </button>

              {expanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Действие</label>
                    <select
                      value={step.action}
                      disabled={disabled}
                      onChange={(e) =>
                        updateStar(star, {
                          action: e.target.value as ReviewRoutingConfig[StarRating]["action"],
                        })
                      }
                      className={inputClass}
                    >
                      {REVIEW_STAR_ACTIONS.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Заголовок до отправки
                    </label>
                    <input
                      type="text"
                      value={step.promptTitle}
                      disabled={disabled}
                      onChange={(e) => updateStar(star, { promptTitle: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Подзаголовок до отправки
                    </label>
                    <input
                      type="text"
                      value={step.promptSubtitle}
                      disabled={disabled}
                      onChange={(e) => updateStar(star, { promptSubtitle: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  {(isComplaintAction(step.action) || step.action !== "THANKS") && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {isComplaintAction(step.action) ? "Текст кнопки отправки" : "Текст кнопки"}
                      </label>
                      <input
                        type="text"
                        value={step.ctaLabel}
                        disabled={disabled}
                        onChange={(e) => updateStar(star, { ctaLabel: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Заголовок после отправки
                    </label>
                    <input
                      type="text"
                      value={step.thanksTitle}
                      disabled={disabled}
                      onChange={(e) => updateStar(star, { thanksTitle: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Подзаголовок после отправки
                    </label>
                    <textarea
                      value={step.thanksSubtitle}
                      disabled={disabled}
                      onChange={(e) => updateStar(star, { thanksSubtitle: e.target.value })}
                      rows={2}
                      className={inputClass}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {message && (
        <div
          className={`mt-4 px-4 py-3 rounded-lg text-sm ${
            message.includes("Ошибка") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      {isPro && (
        <Button className="mt-4" onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Сохранение...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Сохранить сценарии
            </>
          )}
        </Button>
      )}
    </Card>
  );
}

function ProUpsellBanner() {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 mb-4">
      <Crown className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-900">Доступно на PRO-тарифе</p>
        <p className="text-xs text-amber-800 mt-1">
          На бесплатном тарифе: 1–3★ — жалоба владельцу, 4★ — 2GIS, 5★ — Яндекс.Карты. Свои сценарии — в PRO.
        </p>
        <Link
          href="/dashboard/subscription"
          className="inline-block mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          Перейти к подписке →
        </Link>
      </div>
    </div>
  );
}
