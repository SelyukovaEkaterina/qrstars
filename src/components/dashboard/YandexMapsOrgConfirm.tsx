"use client";

import { useCallback, useEffect, useState } from "react";
import Input from "@/components/ui/Input";
import {
  YANDEX_MAPS_SHORT_UNCONFIRMED_ERROR,
  yandexMapsUrlError,
} from "@/lib/yandex-maps-url";

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; name: string; canonicalUrl: string; confirmed: boolean };

export default function YandexMapsOrgConfirm({
  value,
  onChange,
  onConfirmedChange,
  label,
  required,
  placeholder,
}: {
  value: string;
  onChange: (url: string) => void;
  onConfirmedChange?: (canonicalUrl: string | null) => void;
  label: string;
  required?: boolean;
  placeholder?: string;
}) {
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const [fieldError, setFieldError] = useState("");

  const runPreview = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setFieldError("");
      setPreview({ status: "idle" });
      onConfirmedChange?.(null);
      return;
    }
    const localErr = yandexMapsUrlError(trimmed);
    if (localErr && localErr !== YANDEX_MAPS_SHORT_UNCONFIRMED_ERROR) {
      setFieldError(localErr);
      setPreview({ status: "idle" });
      return;
    }
    setFieldError("");
    setPreview({ status: "loading" });
    try {
      const res = await fetch("/api/yandex-maps/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setPreview({
          status: "error",
          message: data.error || "Не удалось проверить ссылку",
        });
        return;
      }
      setPreview({
        status: "ready",
        name: data.name,
        canonicalUrl: data.canonicalUrl,
        confirmed: false,
      });
    } catch {
      setPreview({ status: "error", message: "Не удалось проверить ссылку" });
    }
  }, []);

  useEffect(() => {
    if (!value.trim()) {
      setPreview({ status: "idle" });
      setFieldError("");
    }
  }, [value]);

  const confirm = () => {
    if (preview.status !== "ready") return;
    onChange(preview.canonicalUrl);
    setPreview({ ...preview, confirmed: true });
    onConfirmedChange?.(preview.canonicalUrl);
  };

  return (
    <div className="space-y-2">
      <Input
        label={label}
        type="text"
        value={value}
        required={required}
        placeholder={placeholder || "https://yandex.ru/maps/org/ваше-заведение/…"}
        error={fieldError || (preview.status === "error" ? preview.message : undefined)}
        onChange={(e) => {
          onChange(e.target.value);
          setPreview({ status: "idle" });
          setFieldError("");
          onConfirmedChange?.(null);
        }}
        onBlur={() => void runPreview(value)}
      />
      {preview.status === "loading" && (
        <p className="text-xs text-gray-500">Проверяем карточку организации…</p>
      )}
      {preview.status === "ready" && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-950">
          <p>
            Это ваша организация? <strong>{preview.name}</strong>
          </p>
          {preview.confirmed ? (
            <p className="mt-1 text-xs text-green-700">Карточка подтверждена</p>
          ) : (
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
              onClick={confirm}
            >
              Да, это мы — сохранить эту карточку
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function yandexPreviewBlocksSubmit(value: string, confirmedCanonical: string | null) {
  const trimmed = value.trim();
  if (!trimmed) return "Укажите ссылку на Яндекс.Карты";
  const err = yandexMapsUrlError(trimmed);
  if (err === YANDEX_MAPS_SHORT_UNCONFIRMED_ERROR) {
    if (!confirmedCanonical) return YANDEX_MAPS_SHORT_UNCONFIRMED_ERROR;
    return null;
  }
  if (err) return err;
  return confirmedCanonical ? null : "Подтвердите, что это ваша организация";
}
