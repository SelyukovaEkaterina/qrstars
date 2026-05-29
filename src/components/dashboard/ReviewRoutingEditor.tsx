"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  type ReviewRoutingConfig,
  type StarRating,
  type OrderedPlatformEntry,
  STANDARD_PLATFORM_LABELS,
  DEFAULT_REVIEW_ROUTING,
  DEFAULT_STAR_EMOJIS,
  reviewRoutingToJson,
  isComplaintAction,
  getStepPlatforms,
  PLATFORM_ACTIONS,
} from "@/lib/review-routing";
import { Crown, ChevronDown, ChevronUp, Loader2, Save, Star, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";

type FlowType = "COMPLAINT" | "PLATFORM" | "THANKS";

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

function getFlowType(step: ReviewRoutingConfig[StarRating]): FlowType {
  if (isComplaintAction(step.action)) return "COMPLAINT";
  if (step.action === "THANKS") return "THANKS";
  return "PLATFORM";
}

function newCustomId(): string {
  return `custom-${Math.random().toString(36).slice(2, 9)}`;
}

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
          const flowType = getFlowType(step);

          const summaryLabel = useMemo(() => {
            if (flowType === "COMPLAINT") return "Жалоба владельцу";
            if (flowType === "THANKS") return "Благодарность";
            const list = step.platformList;
            if (list && list.length > 0) {
              const names = list.map((e) =>
                e.type === "CUSTOM"
                  ? e.name?.trim() || "Своя площадка"
                  : STANDARD_PLATFORM_LABELS[e.type]
              );
              return "Площадки: " + names.join(", ");
            }
            const platforms = getStepPlatforms(step);
            if (platforms.length === 0) return "Благодарность";
            return "Площадки: " + platforms.map((p) => PLATFORM_ACTIONS.find((a) => a.value === p)?.label ?? p).join(", ");
          }, [step, flowType]);

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
                  <span className="text-sm text-gray-700 truncate">{summaryLabel}</span>
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
                    <label className="block text-xs font-medium text-gray-600 mb-1">Тип действия</label>
                    <select
                      value={flowType}
                      disabled={disabled}
                      onChange={(e) => {
                        const ft = e.target.value as FlowType;
                        if (ft === "COMPLAINT") {
                          updateStar(star, {
                            action: "COMPLAINT",
                            platformList: undefined,
                            ctaLabel: "Отправить",
                            promptTitle: "Нам очень жаль! Расскажите подробнее",
                            promptSubtitle: "Ваше сообщение попадёт лично руководству",
                            thanksTitle: "Спасибо за обратную связь!",
                            thanksSubtitle: "Мы уже работаем над улучшением. Руководство лично прочитает ваш отзыв.",
                          });
                        } else if (ft === "THANKS") {
                          updateStar(star, {
                            action: "THANKS",
                            platformList: undefined,
                            promptTitle: "Спасибо!",
                            promptSubtitle: "Мы рады, что вам понравилось!",
                            thanksTitle: "Спасибо!",
                            thanksSubtitle: "Будем рады видеть вас снова!",
                          });
                        } else {
                          updateStar(star, {
                            action: "YANDEX",
                            platformList: [{ type: "YANDEX" }],
                            ctaLabel: "Оставить отзыв",
                            promptTitle: "Спасибо! Оставьте отзыв на карте?",
                            promptSubtitle: "Это поможет нам стать лучше!",
                            thanksTitle: "Спасибо за вашу оценку!",
                            thanksSubtitle: "Будем рады, если поделитесь впечатлением на карте.",
                          });
                        }
                      }}
                      className={inputClass}
                    >
                      <option value="COMPLAINT">Жалоба владельцу</option>
                      <option value="PLATFORM">Отзыв на площадках</option>
                      <option value="THANKS">Благодарность</option>
                    </select>
                  </div>

                  {flowType === "PLATFORM" && (
                    <PlatformListEditor
                      star={star}
                      step={step}
                      disabled={disabled}
                      onUpdate={updateStar}
                    />
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Эмодзи</label>
                    <EmojiPicker
                      value={step.emoji || DEFAULT_STAR_EMOJIS[star]}
                      disabled={disabled}
                      onChange={(e) => updateStar(star, { emoji: e })}
                    />
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

                  {flowType === "COMPLAINT" && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Текст кнопки отправки
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

const STANDARD_TYPES = ["YANDEX", "TWO_GIS", "AVITO"] as const;

function PlatformListEditor({
  star,
  step,
  disabled,
  onUpdate,
}: {
  star: StarRating;
  step: ReviewRoutingConfig[StarRating];
  disabled: boolean;
  onUpdate: (star: StarRating, patch: Partial<ReviewRoutingConfig[StarRating]>) => void;
}) {
  const list: OrderedPlatformEntry[] = step.platformList ?? [];

  const setList = (next: OrderedPlatformEntry[]) => {
    const firstPlatform = next[0];
    const action = firstPlatform
      ? firstPlatform.type === "CUSTOM" ? "CUSTOM" : firstPlatform.type
      : "YANDEX";
    onUpdate(star, { platformList: next, action });
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...list];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setList(next);
  };

  const remove = (index: number) => {
    const next = list.filter((_, i) => i !== index);
    setList(next);
  };

  const updateCustom = (index: number, patch: Partial<Extract<OrderedPlatformEntry, { type: "CUSTOM" }>>) => {
    const next = list.map((e, i) =>
      i === index && e.type === "CUSTOM" ? { ...e, ...patch } : e
    );
    setList(next);
  };

  const addStandard = (type: "YANDEX" | "TWO_GIS" | "AVITO") => {
    setList([...list, { type }]);
  };

  const addCustom = () => {
    setList([
      ...list,
      { type: "CUSTOM", id: newCustomId(), name: "", url: "", iconUrl: undefined },
    ]);
  };

  const usedStandards = new Set(
    list.filter((e) => e.type !== "CUSTOM").map((e) => e.type)
  );
  const availableStandards = STANDARD_TYPES.filter((t) => !usedStandards.has(t));

  const hasInvalidCustom = list.some((e) => e.type === "CUSTOM" && !e.url.trim());

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-2">Площадки</label>

      {list.length === 0 && (
        <p className="text-xs text-amber-600 mb-2">Добавьте хотя бы одну площадку</p>
      )}

      <div className="space-y-2">
        {list.map((entry, index) => (
          <div key={entry.type === "CUSTOM" ? entry.id : entry.type} className="space-y-2">
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                disabled ? "opacity-60" : ""
              } ${
                entry.type === "CUSTOM"
                  ? "border-indigo-200 bg-indigo-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  onClick={() => move(index, -1)}
                  className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  disabled={disabled || index === list.length - 1}
                  onClick={() => move(index, 1)}
                  className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>

              {/* Platform name */}
              <div className="flex-1 min-w-0">
                {entry.type === "CUSTOM" ? (
                  <input
                    type="text"
                    value={entry.name}
                    disabled={disabled}
                    onChange={(e) => updateCustom(index, { name: e.target.value })}
                    placeholder="Название площадки"
                    className="w-full text-sm bg-transparent border-none outline-none placeholder-gray-400 disabled:cursor-not-allowed"
                  />
                ) : (
                  <span className="text-sm text-gray-700">
                    {STANDARD_PLATFORM_LABELS[entry.type]}
                  </span>
                )}
              </div>

              {/* Primary badge */}
              {index === 0 && (
                <span className="text-xs text-indigo-500 shrink-0">основная</span>
              )}

              {/* Remove */}
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(index)}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Custom platform fields */}
            {entry.type === "CUSTOM" && (
              <div className="ml-8 pl-3 border-l-2 border-indigo-200 space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">URL площадки</label>
                  <input
                    type="url"
                    value={entry.url}
                    disabled={disabled}
                    onChange={(e) => updateCustom(index, { url: e.target.value.trim() })}
                    placeholder="https://..."
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    URL иконки <span className="font-normal text-gray-400">(необязательно)</span>
                  </label>
                  <input
                    type="url"
                    value={entry.iconUrl ?? ""}
                    disabled={disabled}
                    onChange={(e) =>
                      updateCustom(index, { iconUrl: e.target.value.trim() || undefined })
                    }
                    placeholder="https://.../icon.png"
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add platform controls */}
      {!disabled && (
        <div className="mt-3 flex flex-wrap gap-2">
          {availableStandards.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => addStandard(type)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-dashed border-gray-300 text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
            >
              <Plus className="w-3 h-3" />
              {STANDARD_PLATFORM_LABELS[type]}
            </button>
          ))}
          <button
            type="button"
            onClick={addCustom}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-dashed border-indigo-300 text-indigo-600 hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Своя площадка
          </button>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-2">
        Первая площадка — основная. Порядок определяет очерёдность показа.
      </p>
      {hasInvalidCustom && (
        <p className="text-xs text-amber-600 mt-1">Укажите URL для всех своих площадок</p>
      )}
    </div>
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

const EMOJI_OPTIONS = [
  "😡", "😞", "😔", "😟", "😕", "🙁", "😐", "🙂", "😊", "😁",
  "😄", "🤩", "😍", "❤️", "👏", "🎉", "🙏", "💪", "⭐", "🌟",
  "💯", "🔥", "✨", "👍", "👎", "💔", "😢", "😭", "🥺", "😤",
];

function EmojiPicker({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (emoji: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-3xl">{value}</span>
        <input
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-center text-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          maxLength={4}
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {EMOJI_OPTIONS.map((e) => (
          <button
            key={e}
            type="button"
            disabled={disabled}
            onClick={() => onChange(e)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-colors ${
              value === e
                ? "bg-indigo-100 border border-indigo-300"
                : "hover:bg-gray-100 border border-transparent"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
