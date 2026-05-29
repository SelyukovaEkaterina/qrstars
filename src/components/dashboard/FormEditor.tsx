"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Lock } from "lucide-react";
import Button from "@/components/ui/Button";
import {
  FORM_FIELD_TYPES,
  isFormFieldType,
  type FormFieldType,
} from "@/lib/form-config";

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
  isPro: boolean;
  saving: boolean;
  onSave: (data: Partial<FormEditState> & { fields?: FormFieldEditState[] }) => Promise<void>;
}

export default function FormEditor({ initialData, isPro, saving, onSave }: FormEditorProps) {
  const [form, setForm] = useState<FormEditState>(initialData);
  const initialFieldsCount = initialData.fields.length;

  useEffect(() => {
    setForm(initialData);
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

  const addField = () => {
    if (!isPro && form.fields.length >= initialFieldsCount) {
      alert(
        "Добавление новых полей доступно на PRO-тарифе. На FREE можно редактировать пресет, но не добавлять поля сверх него."
      );
      return;
    }
    setForm((prev) => ({
      ...prev,
      fields: [
        ...prev.fields,
        {
          label: "Новое поле",
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

  const handleSave = async () => {
    await onSave({
      title: form.title,
      description: form.description,
      submitLabel: form.submitLabel,
      successMessage: form.successMessage,
      enabled: form.enabled,
      fields: form.fields,
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
          <Button variant="outline" size="sm" onClick={addField}>
            {isPro ? (
              <Plus className="w-4 h-4 mr-1" />
            ) : (
              <Lock className="w-3.5 h-3.5 mr-1" />
            )}
            Добавить поле
          </Button>
        </div>
        {!isPro && (
          <p className="text-xs text-amber-600 mb-2">
            На FREE можно редактировать поля пресета. Добавление новых полей — на PRO.
          </p>
        )}
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
                  value={field.placeholder ?? ""}
                  onChange={(e) => updateField(idx, { placeholder: e.target.value || null })}
                  placeholder="Подсказка"
                  className="md:col-span-3 px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
                <label className="md:col-span-1 flex items-center gap-1 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateField(idx, { required: e.target.checked })}
                  />
                  обяз.
                </label>
                <button
                  type="button"
                  onClick={() => removeField(idx)}
                  className="md:col-span-1 p-1.5 text-gray-400 hover:text-red-600 justify-self-end"
                  title="Удалить поле"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {field.type === "select" && (
                <div className="mt-2">
                  <label className="block text-xs text-gray-500 mb-1">
                    Варианты (через запятую)
                  </label>
                  <input
                    type="text"
                    value={(field.options ?? []).join(", ")}
                    onChange={(e) =>
                      updateField(idx, {
                        options: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Опция 1, Опция 2, Опция 3"
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
