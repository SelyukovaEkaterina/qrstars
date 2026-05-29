export type FormFieldType =
  | "text"
  | "textarea"
  | "phone"
  | "email"
  | "number"
  | "date"
  | "time"
  | "select"
  | "checkbox";

export const FORM_FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: "text", label: "Короткий текст" },
  { value: "textarea", label: "Длинный текст" },
  { value: "phone", label: "Телефон" },
  { value: "email", label: "Email" },
  { value: "number", label: "Число" },
  { value: "date", label: "Дата" },
  { value: "time", label: "Время" },
  { value: "select", label: "Выпадающий список" },
  { value: "checkbox", label: "Чекбокс (да/нет)" },
];

export function isFormFieldType(v: unknown): v is FormFieldType {
  return typeof v === "string" && FORM_FIELD_TYPES.some((t) => t.value === v);
}

export interface FormFieldDraft {
  label: string;
  placeholder?: string;
  helpText?: string;
  type: FormFieldType;
  required: boolean;
  options?: string[];
}

export interface FormPreset {
  id: string;
  name: string;
  description: string;
  title: string;
  submitLabel: string;
  successMessage: string;
  fields: FormFieldDraft[];
}

export const FORM_PRESETS: FormPreset[] = [
  {
    id: "blank",
    name: "Пустая форма",
    description: "Начать с нуля — добавьте поля сами",
    title: "Свяжитесь с нами",
    submitLabel: "Отправить",
    successMessage: "Спасибо! Мы получили вашу заявку и скоро свяжемся с вами.",
    fields: [
      { label: "Имя", type: "text", required: true, placeholder: "Как к вам обращаться" },
      { label: "Телефон", type: "phone", required: true, placeholder: "+7 (___) ___-__-__" },
      { label: "Сообщение", type: "textarea", required: false, placeholder: "Опишите ваш запрос" },
    ],
  },
  {
    id: "table_booking",
    name: "Бронь столика",
    description: "Имя, телефон, дата, время, количество гостей",
    title: "Забронировать столик",
    submitLabel: "Забронировать",
    successMessage: "Спасибо! Мы подтвердим бронь по телефону в ближайшее время.",
    fields: [
      { label: "Имя", type: "text", required: true, placeholder: "Как к вам обращаться" },
      { label: "Телефон", type: "phone", required: true, placeholder: "+7 (___) ___-__-__" },
      { label: "Дата", type: "date", required: true },
      { label: "Время", type: "time", required: true },
      { label: "Количество гостей", type: "number", required: true, placeholder: "2" },
      { label: "Пожелания", type: "textarea", required: false, placeholder: "У окна, детский стульчик и т.д." },
    ],
  },
  {
    id: "service_appointment",
    name: "Запись на услугу",
    description: "Имя, телефон, услуга, удобное время",
    title: "Записаться на услугу",
    submitLabel: "Записаться",
    successMessage: "Спасибо! Мы свяжемся с вами для подтверждения записи.",
    fields: [
      { label: "Имя", type: "text", required: true, placeholder: "Как к вам обращаться" },
      { label: "Телефон", type: "phone", required: true, placeholder: "+7 (___) ___-__-__" },
      { label: "Услуга", type: "select", required: true, options: ["Консультация", "Стрижка", "Другое"] },
      { label: "Удобная дата", type: "date", required: false },
      { label: "Комментарий", type: "textarea", required: false },
    ],
  },
];

export function getPreset(id: string | null | undefined): FormPreset | null {
  if (!id) return null;
  return FORM_PRESETS.find((p) => p.id === id) ?? null;
}

export interface FormFieldDef {
  id: string;
  label: string;
  placeholder: string | null;
  helpText: string | null;
  type: FormFieldType;
  required: boolean;
  options: string[] | null;
  order: number;
}

export function parseFieldOptions(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const result = raw
    .filter((v): v is string => typeof v === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return result.length > 0 ? result : null;
}

export function normalizeFieldType(raw: unknown): FormFieldType {
  return isFormFieldType(raw) ? raw : "text";
}

export function formatSubmissionForNotification(
  fields: FormFieldDef[],
  values: Record<string, unknown>
): string {
  return fields
    .map((f) => {
      const raw = values[f.id];
      let display: string;
      if (raw === undefined || raw === null || raw === "") {
        display = "—";
      } else if (typeof raw === "boolean") {
        display = raw ? "Да" : "Нет";
      } else if (Array.isArray(raw)) {
        display = raw.join(", ");
      } else {
        display = String(raw);
      }
      return `${f.label}: ${display}`;
    })
    .join("\n");
}
