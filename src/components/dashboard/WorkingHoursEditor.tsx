"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import {
  WEEK_DAYS,
  WEEK_DAY_LABELS,
  type WeekDay,
  type WorkingHours,
  type DayHours,
} from "@/lib/working-hours";

interface Props {
  value: WorkingHours | null;
  onChange: (v: WorkingHours | null) => void;
}

const DEFAULT_OPEN = "09:00";
const DEFAULT_CLOSE = "22:00";

export default function WorkingHoursEditor({ value, onChange }: Props) {
  const [draft, setDraft] = useState<WorkingHours>(() => ({ ...(value || {}) }));

  const apply = (next: WorkingHours) => {
    setDraft(next);
    const cleaned: WorkingHours = {};
    let any = false;
    for (const d of WEEK_DAYS) {
      if (next[d] === undefined) continue;
      cleaned[d] = next[d] ?? null;
      any = true;
    }
    onChange(any ? cleaned : null);
  };

  const toggleDay = (day: WeekDay) => {
    const current = draft[day];
    const next: WorkingHours = { ...draft };
    if (current === undefined || current === null) {
      next[day] = { open: DEFAULT_OPEN, close: DEFAULT_CLOSE };
    } else {
      next[day] = null;
    }
    apply(next);
  };

  const updateTime = (day: WeekDay, field: keyof DayHours, val: string) => {
    const current = draft[day] || { open: DEFAULT_OPEN, close: DEFAULT_CLOSE };
    apply({ ...draft, [day]: { ...current, [field]: val } });
  };

  const copyToAll = (from: WeekDay) => {
    const src = draft[from];
    if (!src) return;
    const next: WorkingHours = { ...draft };
    for (const d of WEEK_DAYS) {
      if (draft[d] === null) continue; // не трогаем выходные
      next[d] = { ...src };
    }
    apply(next);
  };

  const presetWeekdays = () => {
    const next: WorkingHours = {};
    for (const d of WEEK_DAYS) {
      next[d] = d === "sat" || d === "sun"
        ? null
        : { open: "09:00", close: "18:00" };
    }
    apply(next);
  };

  const preset247 = () => {
    const next: WorkingHours = {};
    for (const d of WEEK_DAYS) {
      next[d] = { open: "00:00", close: "23:59" };
    }
    apply(next);
  };

  const clearAll = () => {
    apply({});
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={presetWeekdays}
          className="px-2.5 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
        >
          Будни 9–18
        </button>
        <button
          type="button"
          onClick={preset247}
          className="px-2.5 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
        >
          Круглосуточно
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="px-2.5 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-500"
        >
          Очистить
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
        {WEEK_DAYS.map((day) => {
          const cell = draft[day];
          const isOpen = !!cell;
          return (
            <div key={day} className="flex items-center gap-3 px-3 py-2.5">
              <label className="inline-flex items-center gap-2 w-20 shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isOpen}
                  onChange={() => toggleDay(day)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                <span className="text-sm font-medium text-gray-900">
                  {WEEK_DAY_LABELS[day]}
                </span>
              </label>

              {isOpen ? (
                <>
                  <input
                    type="time"
                    value={cell.open}
                    onChange={(e) => updateTime(day, "open", e.target.value)}
                    className="w-28 px-2 py-1 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <span className="text-gray-400 text-sm">—</span>
                  <input
                    type="time"
                    value={cell.close}
                    onChange={(e) => updateTime(day, "close", e.target.value)}
                    className="w-28 px-2 py-1 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => copyToAll(day)}
                    title="Применить ко всем рабочим дням"
                    className="ml-auto p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <span className="text-sm text-gray-400">Выходной</span>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500">
        Если время закрытия меньше времени открытия — считаем, что заведение закрывается на следующий день
        (например, 20:00 → 04:00).
      </p>
    </div>
  );
}
