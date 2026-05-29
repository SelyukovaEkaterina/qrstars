"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { BrandThemeScanProps } from "@/components/scan/brand-theme-props";
import { useBrandThemeScan } from "@/components/scan/brand-theme-props";
import {
  headingColor,
  mutedColor,
  scanRootStyle,
} from "@/lib/brand-theme-ui";
import type { FormFieldType } from "@/lib/form-config";
import ConsentCheckbox from "@/components/scan/ConsentCheckbox";
import type { PdConsent } from "@/components/scan/ScanFlow";

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
}

const inputClass =
  "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white";
const inputDisabledClass =
  "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400 cursor-not-allowed";

export default function FormView({ form, qrCodeId, isDemo, embedded, isBg, brandColor, pageAppearance, pdConsent }: FormViewProps) {
  const { theme } = useBrandThemeScan({ brandColor, pageAppearance });
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [consentChecked, setConsentChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const hasSensitiveFields = form.fields.some((f) => f.type === "phone" || f.type === "email");
  const sensitiveAllowed = isDemo || !pdConsent || pdConsent.ready;
  const needsConsent = !isDemo && !!pdConsent?.ready && hasSensitiveFields;

  const setVal = (id: string, v: unknown) => setValues((prev) => ({ ...prev, [id]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    for (const f of form.fields) {
      if (f.required) {
        const v = values[f.id];
        if (v === undefined || v === null || v === "" || v === false) {
          setError(`Заполните поле «${f.label}»`);
          return;
        }
      }
    }

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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Заявка отправлена</h2>
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
        {form.fields.map((f) => {
          const isSensitive = f.type === "phone" || f.type === "email";
          if (isSensitive && !sensitiveAllowed) {
            return (
              <div key={f.id}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {f.label}
                  {f.required && <span className="text-red-500"> *</span>}
                </label>
                <div className={inputDisabledClass}>
                  Поле недоступно — владелец не заполнил реквизиты для обработки персональных данных.
                </div>
              </div>
            );
          }
          return (
            <div key={f.id}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {f.label}
                {f.required && <span className="text-red-500"> *</span>}
              </label>
              {f.helpText && <p className="text-xs text-gray-500 mb-1">{f.helpText}</p>}
              {renderInput(f, values[f.id], (v) => setVal(f.id, v))}
            </div>
          );
        })}

        {needsConsent && (
          <ConsentCheckbox
            checked={consentChecked}
            onChange={setConsentChecked}
            policyUrl={pdConsent!.policyUrl}
          />
        )}

        {error && (
          <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting || (needsConsent && !consentChecked)}
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
