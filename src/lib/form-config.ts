export type FormFieldType =
  | "text"
  | "textarea"
  | "phone"
  | "email"
  | "number"
  | "date"
  | "time"
  | "select"
  | "checkbox"
  | "radio"
  | "multi"
  | "rating"
  | "nps";

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
  { value: "radio", label: "Один вариант из списка" },
  { value: "multi", label: "Несколько вариантов" },
  { value: "rating", label: "Оценка 1–5 ★" },
  { value: "nps", label: "Шкала 0–10" },
];

/** Типы полей, у которых есть варианты ответа. */
export const OPTION_FIELD_TYPES: readonly FormFieldType[] = ["select", "radio", "multi"];

export function fieldHasOptions(type: FormFieldType | string): boolean {
  return (OPTION_FIELD_TYPES as readonly string[]).includes(type);
}

/** Сколько полей и вариантов можно в одной форме — защита от раздувания. */
export const FORM_MAX_FIELDS = 30;
export const FORM_MAX_OPTIONS = 30;
export const FORM_VALUE_MAX_LENGTH = 2000;

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
  /** Иконка карточки шаблона в кабинете, мастере и на лендинге. */
  emoji: string;
  title: string;
  submitLabel: string;
  successMessage: string;
  fields: FormFieldDraft[];
}

export const FORM_PRESETS: FormPreset[] = [
  {
    id: "blank",
    emoji: "📝",
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
    emoji: "🍽️",
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
    emoji: "📅",
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
  // id шаблонов хранятся в Form.preset — не переименовывать, новые добавлять в конец.
  {
    id: "guest_survey",
    emoji: "⭐",
    name: "Опрос гостей",
    description: "Оценка, что понравилось, порекомендуют ли вас",
    title: "Как вам у нас?",
    submitLabel: "Отправить",
    successMessage: "Спасибо! Ваш ответ поможет нам стать лучше.",
    fields: [
      { label: "Оцените визит", type: "rating", required: true },
      {
        label: "Что понравилось больше всего?",
        type: "multi",
        required: false,
        options: ["Еда и напитки", "Обслуживание", "Атмосфера", "Скорость", "Цены"],
      },
      { label: "Насколько вероятно, что вы порекомендуете нас друзьям?", type: "nps", required: false },
      { label: "Что нам улучшить?", type: "textarea", required: false },
      {
        label: "Телефон",
        type: "phone",
        required: false,
        placeholder: "+7 (___) ___-__-__",
        helpText: "Оставьте, если хотите, чтобы мы ответили",
      },
    ],
  },
  {
    id: "event_registration",
    emoji: "🎟️",
    name: "Регистрация на мероприятие",
    description: "Имя, телефон, сколько человек придёт",
    title: "Регистрация на мероприятие",
    submitLabel: "Зарегистрироваться",
    successMessage: "Вы зарегистрированы! Напомним о мероприятии накануне.",
    fields: [
      { label: "Имя", type: "text", required: true, placeholder: "Как к вам обращаться" },
      { label: "Телефон", type: "phone", required: true, placeholder: "+7 (___) ___-__-__" },
      { label: "Сколько человек придёт", type: "number", required: true, placeholder: "1" },
      {
        label: "Откуда узнали о мероприятии?",
        type: "radio",
        required: false,
        options: ["Telegram", "ВКонтакте", "От друзей", "Афиша", "Другое"],
      },
    ],
  },
  {
    id: "feedback",
    emoji: "💬",
    name: "Жалобы и предложения",
    description: "Тема обращения, сообщение и контакт для ответа",
    title: "Жалобы и предложения",
    submitLabel: "Отправить",
    successMessage: "Спасибо! Мы прочитаем каждое сообщение.",
    fields: [
      {
        label: "Тема",
        type: "radio",
        required: true,
        options: ["Предложение", "Жалоба", "Благодарность", "Другое"],
      },
      { label: "Сообщение", type: "textarea", required: true, placeholder: "Расскажите подробнее" },
      { label: "Имя", type: "text", required: false },
      {
        label: "Телефон",
        type: "phone",
        required: false,
        placeholder: "+7 (___) ___-__-__",
        helpText: "Если нужен ответ",
      },
    ],
  },
  {
    id: "giveaway",
    emoji: "🎁",
    name: "Участие в акции",
    description: "Розыгрыш, конкурс, подарок за покупку",
    title: "Участвуйте в розыгрыше",
    submitLabel: "Участвовать",
    successMessage: "Вы участвуете! Итоги объявим в наших соцсетях, победителю позвоним.",
    fields: [
      { label: "Имя", type: "text", required: true, placeholder: "Как к вам обращаться" },
      { label: "Телефон", type: "phone", required: true, placeholder: "+7 (___) ___-__-__" },
      { label: "Номер чека", type: "text", required: false, helpText: "Указан внизу чека" },
      { label: "Хочу узнавать о новых акциях", type: "checkbox", required: false, placeholder: "Да, присылайте" },
    ],
  },
  {
    id: "client_profile",
    emoji: "🗂️",
    name: "Анкета клиента",
    description: "Для салона, студии, мастерской: контакты и предпочтения",
    title: "Анкета клиента",
    submitLabel: "Отправить",
    successMessage: "Спасибо! Анкета сохранена.",
    fields: [
      { label: "Имя и фамилия", type: "text", required: true },
      { label: "Телефон", type: "phone", required: true, placeholder: "+7 (___) ___-__-__" },
      { label: "Дата рождения", type: "date", required: false, helpText: "Поздравим и подарим скидку" },
      {
        label: "Как удобнее связаться?",
        type: "radio",
        required: false,
        options: ["Звонок", "WhatsApp", "Telegram", "СМС"],
      },
      {
        label: "Как вы о нас узнали?",
        type: "select",
        required: false,
        options: ["Яндекс Карты", "2GIS", "Соцсети", "Друзья", "Проходил мимо", "Другое"],
      },
      { label: "Пожелания", type: "textarea", required: false },
    ],
  },
  {
    id: "job_application",
    emoji: "🧑‍🍳",
    name: "Отклик на вакансию",
    description: "Вакансия, опыт, пара слов о себе",
    title: "Работа у нас",
    submitLabel: "Откликнуться",
    successMessage: "Спасибо! Мы позвоним, если ваш опыт нам подходит.",
    fields: [
      { label: "Имя", type: "text", required: true },
      { label: "Телефон", type: "phone", required: true, placeholder: "+7 (___) ___-__-__" },
      {
        label: "Вакансия",
        type: "select",
        required: true,
        options: ["Официант", "Повар", "Бармен", "Администратор", "Другое"],
      },
      {
        label: "Опыт работы",
        type: "radio",
        required: false,
        options: ["Нет опыта", "До 1 года", "1–3 года", "Больше 3 лет"],
      },
      { label: "Расскажите о себе", type: "textarea", required: false },
    ],
  },
  {
    id: "vote",
    emoji: "🗳️",
    name: "Голосование",
    description: "Выбор блюда месяца, лучшей работы, темы встречи",
    title: "Голосуйте!",
    submitLabel: "Проголосовать",
    successMessage: "Спасибо, ваш голос учтён!",
    fields: [
      {
        label: "Ваш выбор",
        type: "radio",
        required: true,
        options: ["Вариант 1", "Вариант 2", "Вариант 3"],
      },
      { label: "Почему?", type: "textarea", required: false },
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
  const result = [
    ...new Set(
      raw
        .filter((v): v is string => typeof v === "string")
        .map((s) => s.trim().slice(0, 120))
        .filter((s) => s.length > 0)
    ),
  ].slice(0, FORM_MAX_OPTIONS);
  return result.length > 0 ? result : null;
}

function csvCell(value: string): string {
  // Формулы в Excel (=, +, -, @) — частая атака через выгрузки, экранируем апострофом.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * CSV заявок для Excel на русской локали: разделитель «;», BOM для UTF-8.
 * Значения полей, которых уже нет в форме, не выгружаются.
 */
export function submissionsToCsv(
  fields: Pick<FormFieldDef, "id" | "label" | "type">[],
  rows: { createdAt: Date | string; values: Record<string, unknown>; qrLabel?: string | null }[]
): string {
  const header = ["Дата", ...fields.map((f) => f.label), "QR-код"];
  const lines = rows.map((r) => {
    const date = new Date(r.createdAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
    return [
      date,
      ...fields.map((f) => {
        const v = formatFieldValue(f.type, r.values[f.id]);
        return v === "—" ? "" : v;
      }),
      r.qrLabel ?? "",
    ];
  });
  return "\uFEFF" + [header, ...lines].map((cols) => cols.map(csvCell).join(";")).join("\r\n");
}

export function normalizeFieldType(raw: unknown): FormFieldType {
  return isFormFieldType(raw) ? raw : "text";
}

export type FieldValueResult = { ok: true; value: unknown } | { ok: false; error: string };

function isEmptyValue(v: unknown): boolean {
  return v === null || v === undefined || v === "" || v === false || (Array.isArray(v) && v.length === 0);
}

/**
 * Проверка и приведение значения поля при отправке формы гостем.
 * Варианты ответа принимаются только из списка поля, оценки — только целые в диапазоне.
 */
export function validateFieldValue(
  field: Pick<FormFieldDef, "label" | "type" | "required" | "options">,
  raw: unknown
): FieldValueResult {
  let value: unknown = null;
  const options = field.options ?? [];

  switch (field.type) {
    case "checkbox":
      value = raw === true || raw === "true" || raw === "on";
      break;
    case "number": {
      if (raw === null || raw === undefined || raw === "") break;
      const n = Number(raw);
      if (!Number.isFinite(n)) return { ok: false, error: `В поле «${field.label}» нужно число` };
      value = n;
      break;
    }
    case "rating":
    case "nps": {
      if (raw === null || raw === undefined || raw === "") break;
      const n = Number(raw);
      const [min, max] = field.type === "rating" ? [1, 5] : [0, 10];
      if (!Number.isInteger(n) || n < min || n > max) {
        return { ok: false, error: `Поле «${field.label}»: выберите от ${min} до ${max}` };
      }
      value = n;
      break;
    }
    case "select":
    case "radio": {
      if (raw === null || raw === undefined || raw === "") break;
      if (typeof raw !== "string" || !options.includes(raw)) {
        return { ok: false, error: `Поле «${field.label}»: выберите вариант из списка` };
      }
      value = raw;
      break;
    }
    case "multi": {
      if (raw === null || raw === undefined || raw === "") break;
      const list = Array.isArray(raw) ? raw : [raw];
      const picked = options.filter((o) => list.includes(o));
      if (picked.length !== new Set(list).size) {
        return { ok: false, error: `Поле «${field.label}»: выберите варианты из списка` };
      }
      value = picked;
      break;
    }
    default:
      if (raw === null || raw === undefined) break;
      if (typeof raw !== "string" && typeof raw !== "number") {
        return { ok: false, error: `Поле «${field.label}» заполнено неверно` };
      }
      value = String(raw).trim().slice(0, FORM_VALUE_MAX_LENGTH);
  }

  if (field.required && isEmptyValue(value)) {
    return { ok: false, error: `Поле «${field.label}» обязательно` };
  }
  return { ok: true, value };
}

/** Значение поля для показа человеку: уведомления, кабинет, CSV. */
export function formatFieldValue(type: FormFieldType | string, raw: unknown): string {
  if (raw === undefined || raw === null || raw === "") return "—";
  if (typeof raw === "boolean") return raw ? "Да" : "Нет";
  if (Array.isArray(raw)) return raw.length ? raw.join(", ") : "—";
  if (type === "rating") return `${raw} из 5 ★`;
  if (type === "nps") return `${raw} из 10`;
  return String(raw);
}

export function formatSubmissionForNotification(
  fields: FormFieldDef[],
  values: Record<string, unknown>
): string {
  return fields
    .map((f) => {
      return `${f.label}: ${formatFieldValue(f.type, values[f.id])}`;
    })
    .join("\n");
}
