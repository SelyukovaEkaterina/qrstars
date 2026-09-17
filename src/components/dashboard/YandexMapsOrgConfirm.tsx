"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
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

export type YandexMapsOrgConfirmHandle = {
  check: () => Promise<boolean>;
};

const YandexMapsOrgConfirm = forwardRef<
  YandexMapsOrgConfirmHandle,
  {
    value: string;
    onChange: (url: string) => void;
    onConfirmedChange?: (canonicalUrl: string | null) => void;
    onConfirmed?: (canonicalUrl: string) => void;
    label: string;
    required?: boolean;
    placeholder?: string;
    error?: string;
    previewOnBlur?: boolean;
    projectName?: string;
    onPreviewReadyChange?: (ready: boolean) => void;
  }
>(function YandexMapsOrgConfirm(
  {
    value,
    onChange,
    onConfirmedChange,
    onConfirmed,
    label,
    required,
    placeholder,
    error,
    previewOnBlur = true,
    projectName,
    onPreviewReadyChange,
  },
  ref
) {
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const [fieldError, setFieldError] = useState("");

  const runPreview = useCallback(
    async (raw: string): Promise<boolean> => {
      const trimmed = raw.trim();
      if (!trimmed) {
        setFieldError("");
        setPreview({ status: "idle" });
        onPreviewReadyChange?.(false);
        onConfirmedChange?.(null);
        return false;
      }
      const localErr = yandexMapsUrlError(trimmed);
      if (localErr && localErr !== YANDEX_MAPS_SHORT_UNCONFIRMED_ERROR) {
        setFieldError(localErr);
        setPreview({ status: "idle" });
        onPreviewReadyChange?.(false);
        return false;
      }
      setFieldError("");
      setPreview({ status: "loading" });
      onPreviewReadyChange?.(false);
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
          onPreviewReadyChange?.(false);
          onConfirmedChange?.(null);
          return false;
        }
        setPreview({
          status: "ready",
          name: data.name,
          canonicalUrl: data.canonicalUrl,
          confirmed: false,
        });
        onPreviewReadyChange?.(true);
        return true;
      } catch {
        setPreview({ status: "error", message: "Не удалось проверить ссылку" });
        onPreviewReadyChange?.(false);
        onConfirmedChange?.(null);
        return false;
      }
    },
    [onConfirmedChange, onPreviewReadyChange]
  );

  useImperativeHandle(
    ref,
    () => ({
      check: () => runPreview(value),
    }),
    [runPreview, value]
  );

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
    onConfirmed?.(preview.canonicalUrl);
  };

  return (
    <div className="space-y-2">
      <Input
        label={label}
        type="text"
        value={value}
        required={required}
        placeholder={placeholder || "https://yandex.ru/maps/org/ваше-заведение/…"}
        error={
          error || fieldError || (preview.status === "error" ? preview.message : undefined)
        }
        onChange={(e) => {
          onChange(e.target.value);
          setPreview({ status: "idle" });
          setFieldError("");
          onPreviewReadyChange?.(false);
          onConfirmedChange?.(null);
        }}
        onBlur={() => {
          if (previewOnBlur) void runPreview(value);
        }}
      />
      {preview.status === "loading" && (
        <p className="text-xs text-gray-500">Проверяем карточку организации…</p>
      )}
      {preview.status === "ready" && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-950">
          {projectName?.trim() ? (
            <div className="space-y-1">
              <p><span className="text-indigo-700">Проект:</span> <strong>{projectName.trim()}</strong></p>
              <p><span className="text-indigo-700">Яндекс.Карты:</span> <strong>{preview.name}</strong></p>
              {projectName.trim().toLocaleLowerCase("ru") !== preview.name.trim().toLocaleLowerCase("ru") && (
                <p className="pt-1 text-xs text-amber-800">
                  Названия отличаются — проверьте, что это карточка вашего заведения.
                </p>
              )}
            </div>
          ) : (
            <p>
              Это ваша организация? <strong>{preview.name}</strong>
            </p>
          )}
          {preview.confirmed ? (
            <p className="mt-1 text-xs text-green-700">Карточка подтверждена</p>
          ) : (
            <button
              type="button"
              className="mt-3 inline-flex rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
              onClick={confirm}
            >
              Да, это мы
            </button>
          )}
        </div>
      )}
    </div>
  );
});

YandexMapsOrgConfirm.displayName = "YandexMapsOrgConfirm";

export default YandexMapsOrgConfirm;

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
