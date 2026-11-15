"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Lock, Star } from "lucide-react";
import { FORM_STATS_PERIODS, type FieldSummary, type FormStatsPeriod } from "@/lib/form-stats";

interface StatsResponse {
  days: number;
  total: number;
  current: number;
  previous: number;
  qrCount: number;
  scans: number;
  conversion: number | null;
  unlimited: boolean;
  byDay: { date: string; count: number }[] | null;
  fields: FieldSummary[] | null;
  truncated?: boolean;
}

function delta(current: number, previous: number): string | null {
  if (previous === 0) return current > 0 ? "новые ответы" : null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct > 0 ? "+" : ""}${pct}% к прошлому периоду`;
}

function Bars({ rows, total }: { rows: { label: string; count: number }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-xs">
          <span className="w-28 shrink-0 truncate text-gray-600" title={r.label}>
            {r.label}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
          <span className="w-16 shrink-0 text-right tabular-nums text-gray-700">
            {r.count}
            {total > 0 && <span className="text-gray-400"> · {Math.round((r.count / total) * 100)}%</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function FieldBlock({ f, total }: { f: FieldSummary; total: number }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-gray-900">{f.label}</p>
        <span className="shrink-0 text-xs text-gray-500">ответили: {f.answered}</span>
      </div>
      {f.type === "rating" && f.average != null && (
        <p className="mb-2 flex items-center gap-1 text-lg font-semibold text-gray-900">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          {f.average.toLocaleString("ru-RU")} <span className="text-sm font-normal text-gray-500">из 5</span>
        </p>
      )}
      {f.type === "nps" && f.nps != null && (
        <p className="mb-2 text-sm text-gray-700">
          <span className={`text-lg font-semibold ${f.nps >= 0 ? "text-green-700" : "text-red-700"}`}>
            NPS {f.nps > 0 ? "+" : ""}
            {f.nps}
          </span>{" "}
          <span className="text-xs text-gray-500">— доля 9–10 минус доля 0–6</span>
        </p>
      )}
      {f.distribution ? (
        // В «нескольких вариантах» проценты — от числа ответивших, в остальных — от суммы строк.
        <Bars
          rows={f.distribution}
          total={f.type === "multi" ? total : f.distribution.reduce((sum, r) => sum + r.count, 0)}
        />
      ) : (
        <p className="text-xs text-gray-500">Текстовые ответы — в разделе «Ответы».</p>
      )}
    </div>
  );
}

export default function FormStatsPanel({ formId }: { formId: string }) {
  const [days, setDays] = useState<FormStatsPeriod>(30);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/forms/${formId}/stats?days=${days}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error || "Не удалось загрузить сводку");
        setData(json);
        setError("");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Не удалось загрузить сводку");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formId, days]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
      </div>
    );
  }

  const change = delta(data.current, data.previous);
  const maxDay = Math.max(1, ...(data.byDay ?? []).map((d) => d.count));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold text-gray-900">Сводка</h4>
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 text-xs">
          {FORM_STATS_PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDays(p)}
              className={`rounded-md px-2.5 py-1 ${p === days ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              {p} дн.
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-xs text-gray-500">Ответов за {data.days} дн.</p>
          <p className="text-2xl font-semibold text-gray-900">{data.current}</p>
          {change && <p className="text-xs text-gray-500">{change}</p>}
        </div>
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-xs text-gray-500">Всего ответов</p>
          <p className="text-2xl font-semibold text-gray-900">{data.total}</p>
        </div>
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-xs text-gray-500">Сканов → ответов</p>
          <p className="text-2xl font-semibold text-gray-900">
            {data.conversion != null ? `${data.conversion.toLocaleString("ru-RU")}%` : "—"}
          </p>
          <p className="text-xs text-gray-500">
            {data.qrCount > 0 ? `${data.scans} сканов QR за всё время` : "У формы нет своего QR"}
          </p>
        </div>
      </div>

      {data.unlimited ? (
        <>
          {data.byDay && data.current > 0 && (
            <div>
              <p className="mb-1 text-xs text-gray-500">Ответы по дням</p>
              <div className="flex h-20 items-end gap-0.5" aria-label="Ответы по дням">
                {data.byDay.map((d) => (
                  <div
                    key={d.date}
                    className="flex-1 rounded-t bg-indigo-400"
                    style={{ height: `${Math.max(d.count ? 6 : 1, (d.count / maxDay) * 100)}%`, opacity: d.count ? 1 : 0.25 }}
                    title={`${d.date.split("-").reverse().join(".")}: ${d.count}`}
                  />
                ))}
              </div>
            </div>
          )}
          {data.fields && data.current > 0 ? (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {data.fields.map((f) => (
                <FieldBlock key={f.fieldId} f={f} total={data.current} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">За этот период ответов нет.</p>
          )}
          {data.truncated && (
            <p className="text-xs text-gray-400">Разбивка посчитана по последним 5 000 ответам периода.</p>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 p-4 text-sm text-indigo-950" data-upsell="form-stats">
          <p className="flex items-center gap-1.5 font-medium">
            <Lock className="h-4 w-4" /> График по дням и разбивка по вопросам — на PRO
          </p>
          <p className="mt-1 text-xs text-indigo-900/80">
            Средняя оценка, NPS, какие варианты выбирают чаще, ответы по дням. Плюс ответы без лимита и выгрузка в
            Excel.
          </p>
          <Link
            href="/dashboard/subscription"
            className="mt-2 inline-flex h-8 items-center rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Подключить PRO
          </Link>
        </div>
      )}
    </div>
  );
}
