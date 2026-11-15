"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import type { BrandThemeScanProps } from "@/components/scan/brand-theme-props";
import { useBrandThemeScan } from "@/components/scan/brand-theme-props";
import {
  headingColor,
  mutedColor,
  scanRootStyle,
} from "@/lib/brand-theme-ui";
import type { FormFieldType } from "@/lib/form-config";
import ConsentCheckbox from "@/components/scan/ConsentCheckbox";
import { guestPdPolicyUrl, type PdConsent } from "@/lib/pd-consent";
import { useConsentGate } from "@/components/scan/use-consent-gate";

export interface FormViewField {
  id: string;
  label: string;
  placeholder: string | null;
  helpText: string | null;
  type: FormFieldType;
  required: boolean;
  options: string[] | null;
  order: number;
}

export interface FormViewData {
  id: string;
  title: string;
  description: string | null;
  submitLabel: string;
  successMessage: string;
  enabled: boolean;
  fields: FormViewField[];
}

interface FormViewProps extends BrandThemeScanProps {
  form: FormViewData;
  qrCodeId?: string;
  isDemo?: boolean;
  embedded?: boolean;
  isBg?: boolean;
  pdConsent?: PdConsent;
  /** FREE — подпись «Сделано в QrStars» под формой. */
  watermarkEnabled?: boolean;
}

const inputClass =
  "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white";
function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === "" || v === false || (Array.isArray(v) && v.length === 0);
}

export default function FormView({
  form,
  qrCodeId,
  isDemo,
  embedded,
  isBg,
  brandColor,
  pageAppearance,
  pdConsent,
  watermarkEnabled = false,
}: FormViewProps) {
  const { theme } = useBrandThemeScan({ brandColor, pageAppearance });
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const sensitiveFilled = form.fields.some((f) => {
    if (f.type !== "phone" && f.type !== "email") return false;
    const v = values[f.id];
    return typeof v === "string" ? v.trim() !== "" : Boolean(v);
  });
  const needsConsent = !isDemo && sensitiveFilled;
  const policyUrl = guestPdPolicyUrl(pdConsent);
  const { consentChecked, setConsentChecked, consentHighlight, consentRef, ensureConsent } =
    useConsentGate(needsConsent);

  const setVal = (id: string, v: unknown) => setValues((prev) => ({ ...prev, [id]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    for (const f of form.fields) {
      if (f.required) {
        if (isEmpty(values[f.id])) {
          setError(`Заполните поле «${f.label}»`);
          return;
        }
      }
    }

    if (!ensureConsent()) return;

    if (isDemo) {
      setDone(true);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/forms/${form.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values, qrCodeId, ...(consentChecked ? { pdConsentGiven: true } : {}) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Ошибка отправки");
        return;
      }
      setDone(true);
    } catch {
      setError("Не удалось отправить. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  };

  const wrapperClass = embedded ? "p-4" : "min-h-screen px-4 py-6 max-w-md mx-auto";

  if (done) {
    return (
      <div className={wrapperClass} style={scanRootStyle(theme, { isBg, embedded })}>
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
          <CheckCircle2 className="w-14 h-14 mx-auto text-green-500 mb-3" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Спасибо!</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{form.successMessage}</p>
        </div>
      </div>
    );
  }

  if (!form.enabled) {
    return (
      <div className={wrapperClass} style={scanRootStyle(theme, { isBg, embedded })}>
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
          <p className="text-sm text-gray-600">Форма временно не принимает заявки.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass} style={scanRootStyle(theme, { isBg, embedded })}>
      <div className="mb-4">
        <h2 className="text-2xl font-bold" style={{ color: headingColor(!!isBg) }}>
          {form.title}
        </h2>
        {form.description && (
          <p className="text-sm mt-1" style={{ color: mutedColor(!!isBg) }}>
            {form.description}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 bg-white rounded-2xl p-4 shadow-sm">
        {form.fields.map((f) => (
          <div key={f.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {f.label}
              {f.required && <span className="text-red-500"> *</span>}
            </label>
            {f.helpText && <p className="text-xs text-gray-500 mb-1">{f.helpText}</p>}
            {renderInput(f, values[f.id], (v) => setVal(f.id, v))}
          </div>
        ))}

        {needsConsent && (
          <ConsentCheckbox
            ref={consentRef}
            checked={consentChecked}
            onChange={setConsentChecked}
            policyUrl={policyUrl}
            highlight={consentHighlight}
          />
        )}

        {error && (
          <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-xl font-semibold text-white shadow-sm transition-opacity disabled:opacity-60"
          style={{ backgroundColor: "var(--brand-600)" }}
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Отправка...
            </span>
          ) : (
            form.submitLabel
          )}
        </button>
      </form>

      {watermarkEnabled && !embedded && (
        <a
          href="https://qrstars.ru/?utm_source=qrstars&utm_medium=watermark&utm_campaign=form"
          target="_blank"
          rel="noopener"
          className="mt-4 block text-center text-xs"
          style={{ color: mutedColor(!!isBg) }}
        >
          Сделано в QrStars · создать свою анкету бесплатно
        </a>
      )}
    </div>
  );
}

function OptionList({
  f,
  value,
  onChange,
  multiple,
}: {
  f: FormViewField;
  value: unknown;
  onChange: (v: unknown) => void;
  multiple: boolean;
}) {
  const picked = multiple ? (Array.isArray(value) ? (value as string[]) : []) : [];
  return (
    <div className="space-y-1.5" role={multiple ? "group" : "radiogroup"} aria-label={f.label}>
      {(f.options ?? []).map((opt) => {
        const checked = multiple ? picked.includes(opt) : value === opt;
        return (
          <label
            key={opt}
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              checked ? "border-[var(--brand-600)] bg-[var(--brand-50)]" : "border-gray-200 bg-white"
            }`}
          >
            <input
              type={multiple ? "checkbox" : "radio"}
              name={f.id}
              checked={checked}
              onChange={() => {
                if (!multiple) return onChange(opt);
                onChange(checked ? picked.filter((p) => p !== opt) : [...picked, opt]);
              }}
              className="h-4 w-4 accent-[var(--brand-600)]"
            />
            <span className="text-gray-800">{opt}</span>
          </label>
        );
      })}
    </div>
  );
}

function RatingInput({ f, value, onChange }: { f: FormViewField; value: unknown; onChange: (v: unknown) => void }) {
  const current = typeof value === "number" ? value : 0;
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label={f.label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={current === n}
          aria-label={`${n} из 5`}
          onClick={() => onChange(current === n && !f.required ? null : n)}
          className="rounded-lg p-1 transition-transform active:scale-95"
        >
          <Star
            className="h-9 w-9"
            strokeWidth={1.5}
            fill={n <= current ? "#f59e0b" : "none"}
            color={n <= current ? "#f59e0b" : "#d1d5db"}
          />
        </button>
      ))}
    </div>
  );
}

function NpsInput({ f, value, onChange }: { f: FormViewField; value: unknown; onChange: (v: unknown) => void }) {
  const current = typeof value === "number" ? value : null;
  return (
    <div>
      <div className="grid grid-cols-11 gap-1" role="radiogroup" aria-label={f.label}>
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={current === n}
            onClick={() => onChange(n)}
            className={`h-9 rounded-md border text-sm font-medium transition-colors ${
              current === n
                ? "border-[var(--brand-600)] bg-[var(--brand-600)] text-white"
                : "border-gray-200 bg-white text-gray-700"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-gray-500">
        <span>Точно нет</span>
        <span>Обязательно</span>
      </div>
    </div>
  );
}

function renderInput(
  f: FormViewField,
  value: unknown,
  onChange: (v: unknown) => void
): React.ReactNode {
  switch (f.type) {
    case "textarea":
      return (
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={f.placeholder ?? ""}
          rows={3}
          className={inputClass}
        />
      );
    case "phone":
      return (
        <input
          type="tel"
          inputMode="tel"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={f.placeholder ?? ""}
          className={inputClass}
        />
      );
    case "email":
      return (
        <input
          type="email"
          inputMode="email"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={f.placeholder ?? ""}
          className={inputClass}
        />
      );
    case "number":
      return (
        <input
          type="number"
          inputMode="numeric"
          value={(value as string | number) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={f.placeholder ?? ""}
          className={inputClass}
        />
      );
    case "date":
      return (
        <input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
    case "time":
      return (
        <input
          type="time"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
    case "select":
      return (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">— выберите —</option>
          {(f.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    case "radio":
      return <OptionList f={f} value={value} onChange={onChange} multiple={false} />;
    case "multi":
      return <OptionList f={f} value={value} onChange={onChange} multiple />;
    case "rating":
      return <RatingInput f={f} value={value} onChange={onChange} />;
    case "nps":
      return <NpsInput f={f} value={value} onChange={onChange} />;
    case "checkbox":
      return (
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 rounded text-indigo-600"
          />
          {f.placeholder || "Да"}
        </label>
      );
    case "text":
    default:
      return (
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={f.placeholder ?? ""}
          className={inputClass}
        />
      );
  }
}
