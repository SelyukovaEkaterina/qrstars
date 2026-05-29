"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { formatHoursStatus, type WorkingHours } from "@/lib/working-hours";

interface Props {
  workingHours: WorkingHours;
  color: string; // base text color (для закрытого) — открытый рендерится зелёным
  embedded?: boolean;
}

/**
 * Показывает «Открыто до 22:00» / «Закрыто • Откроется ...».
 * Обновляется раз в минуту.
 */
export default function OpenStatusIndicator({ workingHours, color, embedded }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // tick используется только чтобы заставить React пересчитать
  void tick;

  const status = formatHoursStatus(workingHours);
  if (!status) return null;

  const dotColor = status.open ? "#10b981" : "#9ca3af";
  const textColor = status.open ? "#059669" : color;

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${embedded ? "text-[11px]" : "text-xs"}`}
      style={{ color: textColor }}
    >
      <span
        aria-hidden
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: dotColor }}
      />
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>{status.text}</span>
    </span>
  );
}
