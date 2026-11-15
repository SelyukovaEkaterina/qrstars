/**
 * Сводка по ответам формы для кабинета (раздел «Формы» → «Сводка»).
 * Чистые функции без БД — считаются по уже выбранным ответам, покрыты юнит-тестами.
 */
import { fieldHasOptions, type FormFieldType } from "@/lib/form-config";
import { MSK_OFFSET_MS } from "@/lib/report-formatting";

export const FORM_STATS_PERIODS = [7, 30, 90] as const;
export type FormStatsPeriod = (typeof FORM_STATS_PERIODS)[number];

export function parseStatsPeriod(raw: string | null | undefined): FormStatsPeriod {
  const n = Number(raw);
  return (FORM_STATS_PERIODS as readonly number[]).includes(n) ? (n as FormStatsPeriod) : 30;
}

export interface CountRow {
  label: string;
  count: number;
}

export interface FieldSummary {
  fieldId: string;
  label: string;
  type: FormFieldType;
  /** Сколько ответов, где поле заполнено. */
  answered: number;
  /** rating: среднее 1–5 с одним знаком. */
  average?: number | null;
  /** nps: % промоутеров (9–10) минус % критиков (0–6), от −100 до 100. */
  nps?: number | null;
  /** rating / nps — по значениям шкалы; select / radio / multi — по вариантам; checkbox — да / нет. */
  distribution?: CountRow[];
}

interface FieldDef {
  id: string;
  label: string;
  type: FormFieldType;
  options: string[] | null;
}

function isFilled(v: unknown): boolean {
  return !(v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function summarizeFormAnswers(fields: FieldDef[], answers: Record<string, unknown>[]): FieldSummary[] {
  return fields.map((f) => {
    const values = answers.map((a) => a[f.id]).filter(isFilled);
    const base: FieldSummary = { fieldId: f.id, label: f.label, type: f.type, answered: values.length };

    if (f.type === "rating" || f.type === "nps") {
      const [min, max] = f.type === "rating" ? [1, 5] : [0, 10];
      const nums = values.map(Number).filter((n) => Number.isInteger(n) && n >= min && n <= max);
      const distribution = Array.from({ length: max - min + 1 }, (_, i) => ({
        label: String(min + i),
        count: nums.filter((n) => n === min + i).length,
      }));
      if (f.type === "rating") {
        return {
          ...base,
          average: nums.length ? round1(nums.reduce((s, n) => s + n, 0) / nums.length) : null,
          distribution,
        };
      }
      const promoters = nums.filter((n) => n >= 9).length;
      const detractors = nums.filter((n) => n <= 6).length;
      return {
        ...base,
        nps: nums.length ? Math.round(((promoters - detractors) / nums.length) * 100) : null,
        distribution,
      };
    }

    if (fieldHasOptions(f.type)) {
      const options = f.options ?? [];
      const picked = values.flatMap((v) => (Array.isArray(v) ? v : [v])).map(String);
      const distribution = options.map((o) => ({ label: o, count: picked.filter((p) => p === o).length }));
      // Варианты, которые владелец потом удалил или переименовал.
      const other = picked.filter((p) => !options.includes(p)).length;
      if (other > 0) distribution.push({ label: "Старые варианты", count: other });
      return { ...base, distribution };
    }

    if (f.type === "checkbox") {
      const yes = answers.filter((a) => a[f.id] === true).length;
      return {
        ...base,
        answered: yes,
        distribution: [
          { label: "Да", count: yes },
          { label: "Нет", count: answers.length - yes },
        ],
      };
    }

    return base;
  });
}

/** Ответы по дням МСК за последние `days` дней, включая сегодня. */
export function dailyCounts(dates: Date[], days: number, now = new Date()): { date: string; count: number }[] {
  const key = (d: Date) => new Date(d.getTime() + MSK_OFFSET_MS).toISOString().slice(0, 10);
  const byDay = new Map<string, number>();
  for (const d of dates) byDay.set(key(d), (byDay.get(key(d)) ?? 0) + 1);
  return Array.from({ length: days }, (_, i) => {
    const date = key(new Date(now.getTime() - (days - 1 - i) * 86_400_000));
    return { date, count: byDay.get(date) ?? 0 };
  });
}

/** Конверсия «скан QR → ответ», %; null, если сканов нет (форма только в микросайте). */
export function scanConversion(answers: number, scans: number): number | null {
  if (scans <= 0) return null;
  return Math.min(100, round1((answers / scans) * 100));
}
