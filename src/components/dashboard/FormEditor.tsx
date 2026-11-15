"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import Button from "@/components/ui/Button";
import {
  FORM_FIELD_TYPES,
  FORM_MAX_FIELDS,
  fieldHasOptions,
  isFormFieldType,
  type FormFieldType,
} from "@/lib/form-config";

/** У этих типов нет текстовой подсказки в поле ввода. */
const NO_PLACEHOLDER_TYPES: FormFieldType[] = ["radio", "multi", "rating", "nps", "date", "time"];

export interface FormFieldEditState {
  id?: string;
  label: string;
  placeholder: string | null;
  helpText: string | null;
  type: FormFieldType;
  required: boolean;
  options: string[] | null;
  order: number;
}

export interface FormEditState {
  id: string;
  title: string;
  description: string | null;
  submitLabel: string;
  successMessage: string;
  enabled: boolean;
  fields: FormFieldEditState[];
}

interface FormEditorProps {
  initialData: FormEditState;
  /** Раньше на FREE нельзя было добавлять поля; теперь лимит — только по числу заявок. */
  isPro?: boolean;
  saving: boolean;
  onSave: (data: Partial<FormEditState> & { fields?: FormFieldEditState[] }) => Promise<void>;
}

function fieldOptionsKey(field: FormFieldEditState, idx: number): string {
  return field.id ?? `new-${idx}`;
}

/** Варианты — по одному на строку (запятая бывает внутри варианта: «Чай, кофе»). */
function parseOptionsText(raw: string): string[] | null {
  const options = raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  return options.length > 0 ? options : null;
}

export default function FormEditor({ initialData, saving, onSave }: FormEditorProps) {
  const [form, setForm] = useState<FormEditState>(initialData);
  const [optionsDraft, setOptionsDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    setForm(initialData);
    setOptionsDraft({});
  }, [initialData.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateField = (idx: number, patch: Partial<FormFieldEditState>) => {
    setForm((prev) => ({
      ...prev,
      fields: prev.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    }));
  };

  const removeField = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== idx).map((f, i) => ({ ...f, order: i })),
    }));
  };

  const moveField = (idx: number, dir: -1 | 1) => {
    setForm((prev) => {
      const next = [...prev.fields];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...prev, fields: next.map((f, i) => ({ ...f, order: i })) };
    });
  };

  const addField = () => {
    if (form.fields.length >= FORM_MAX_FIELDS) return;
    setForm((prev) => ({
      ...prev,
      fields: [
        ...prev.fields,
        {
          label: "Новый вопрос",
          placeholder: null,
          helpText: null,
          type: "text",
          required: false,
          options: null,
          order: prev.fields.length,
        },
      ],
    }));
  };

  const commitOptionsDraft = useCallback((idx: number, raw: string) => {
    const options = parseOptionsText(raw);
    setForm((prev) => ({
      ...prev,
      fields: prev.fields.map((f, i) => (i === idx ? { ...f, options } : f)),
    }));
  }, []);

  const flushOptionsDrafts = useCallback((): FormFieldEditState[] => {
    return form.fields.map((field, idx) => {
      const key = fieldOptionsKey(field, idx);
      const draft = optionsDraft[key];
      if (draft === undefined) return field;
      return { ...field, options: parseOptionsText(draft) };
    });
  }, [form.fields, optionsDraft]);

  const handleSave = async () => {
    const fields = flushOptionsDrafts();
    setForm((prev) => ({ ...prev, fields }));
    setOptionsDraft({});
    await onSave({
      title: form.title,
      description: form.description,
      submitLabel: form.submitLabel,
      successMessage: form.successMessage,
      enabled: form.enabled,
      fields,
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Заголовок формы</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            maxLength={200}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Текст кнопки</label>
          <input
            type="text"
            value={form.submitLabel}
            onChange={(e) => setForm({ ...form, submitLabel: e.target.value })}
            maxLength={60}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Описание (необязательно)</label>
        <textarea
          value={form.description ?? ""}
          onChange={(e) => setForm({ ...form, description: e.target.value || null })}
          maxLength={500}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          placeholder="Короткое пояснение, что произойдёт после отправки"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Сообщение после отправки</label>
        <textarea
          value={form.successMessage}
          onChange={(e) => setForm({ ...form, successMessage: e.target.value })}
          maxLength={500}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      <div className="flex items-center gap-2 text-sm">
        <input
          id="form-enabled"
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          className="w-4 h-4 rounded text-indigo-600"
        />
        <label htmlFor="form-enabled" className="text-gray-700">
          Форма принимает заявки
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-gray-900">Поля формы</h4>
          <Button
            variant="outline"
            size="sm"
            onClick={addField}
            disabled={form.fields.length >= FORM_MAX_FIELDS}
            title={form.fields.length >= FORM_MAX_FIELDS ? `Не больше ${FORM_MAX_FIELDS} полей` : undefined}
          >
            <Plus className="w-4 h-4 mr-1" />
            Добавить поле
          </Button>
        </div>
        <div className="space-y-3">
          {form.fields.map((field, idx) => (
            <div key={field.id ?? `new-${idx}`} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => updateField(idx, { label: e.target.value })}
                  placeholder="Название поля"
                  className="md:col-span-4 px-2 py-1.5 border border-gray-300 rounded text-sm"
                  aria-label="Вопрос"
                />
                <select
                  value={field.type}
                  onChange={(e) => {
                    const t = e.target.value;
                    if (isFormFieldType(t)) updateField(idx, { type: t });
                  }}
                  className="md:col-span-3 px-2 py-1.5 border border-gray-300 rounded text-sm"
                >
                  {FORM_FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={NO_PLACEHOLDER_TYPES.includes(field.type) ? "" : field.placeholder ?? ""}
                  onChange={(e) => updateField(idx, { placeholder: e.target.value || null })}
                  placeholder={
                    NO_PLACEHOLDER_TYPES.includes(field.type)
                      ? "—"
                      : field.type === "checkbox"
                        ? "Текст рядом с галочкой"
                        : "Подсказка в поле"
                  }
                  disabled={NO_PLACEHOLDER_TYPES.includes(field.type)}
                  className="md:col-span-2 px-2 py-1.5 border border-gray-300 rounded text-sm disabled:bg-gray-100"
                  aria-label="Подсказка в поле"
                />
                <label className="md:col-span-1 flex items-center gap-1 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateField(idx, { required: e.target.checked })}
                  />
                  обяз.
                </label>
                <div className="md:col-span-2 flex items-center justify-end gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveField(idx, -1)}
                    disabled={idx === 0}
                    className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                    title="Выше"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveField(idx, 1)}
                    disabled={idx === form.fields.length - 1}
                    className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                    title="Ниже"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeField(idx)}
                    className="p-1.5 text-gray-400 hover:text-red-600"
                    title="Удалить поле"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={field.helpText ?? ""}
                onChange={(e) => updateField(idx, { helpText: e.target.value || null })}
                placeholder="Пояснение под вопросом (необязательно)"
                maxLength={200}
                className="mt-2 w-full px-2 py-1.5 border border-gray-200 rounded text-xs bg-white"
                aria-label="Пояснение под вопросом"
              />
              {fieldHasOptions(field.type) && (
                <div className="mt-2">
                  <label className="block text-xs text-gray-500 mb-1">
                    Варианты ответа — каждый с новой строки
                  </label>
                  <textarea
                    rows={Math.min(8, Math.max(3, (field.options ?? []).length + 1))}
                    value={
                      optionsDraft[fieldOptionsKey(field, idx)] ??
                      (field.options ?? []).join("\n")
                    }
                    onChange={(e) => {
                      const key = fieldOptionsKey(field, idx);
                      setOptionsDraft((prev) => ({ ...prev, [key]: e.target.value }));
                    }}
                    onBlur={(e) => {
                      const key = fieldOptionsKey(field, idx);
                      commitOptionsDraft(idx, e.target.value);
                      setOptionsDraft((prev) => {
                        const next = { ...prev };
                        delete next[key];
                        return next;
                      });
                    }}
                    placeholder={"Вариант 1\nВариант 2\nВариант 3"}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
              )}
            </div>
          ))}
          {form.fields.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6 border border-dashed border-gray-300 rounded">
              Добавьте хотя бы одно поле
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          Сохранить
        </Button>
      </div>
    </div>
  );
}
