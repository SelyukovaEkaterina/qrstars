"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Calendar,
  Download,
  Filter,
  GitBranch,
  Loader2,
  MousePointerClick,
  UserPlus,
  Users,
} from "lucide-react";
import type { SetupFunnelReport } from "@/lib/setup-funnel-admin";

const INTENT_LABELS: Record<string, string> = {
  reviews: "Оставить отзыв",
  landing: "Микросайт",
  redirect: "Редирект",
  menu: "QR-меню",
};

const DESTINATION_LABELS: Record<string, string> = {
  templates: "Конструктор QR",
  "my-page": "Страницы заведений",
  "qrcode-settings": "Настройки QR",
  dashboard: "Дашборд",
};

const FUNNEL_COLORS = [
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
];

function formatDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function presetRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: formatDateInput(from), to: formatDateInput(to) };
}

function StepBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${
        ok ? "bg-emerald-500/15 text-emerald-300" : "bg-gray-800 text-gray-500"
      }`}
      title={label}
    >
      {label}
    </span>
  );
}

export default function AdminFunnelPage() {
  const { status } = useSession();
  const router = useRouter();
  const [from, setFrom] = useState(() => presetRange(7).from);
  const [to, setTo] = useState(() => presetRange(7).to);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [report, setReport] = useState<SetupFunnelReport | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/admin/funnel?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось загрузить отчёт");
        setReport(null);
        return;
      }
      setReport(data);
    } catch {
      setError("Ошибка соединения");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/admin/login");
    if (status !== "authenticated") return;
    void loadReport();
  }, [status, router, loadReport]);

  const maxFunnelCount = useMemo(
    () => Math.max(...(report?.funnel.map((s) => s.count) ?? [1]), 1),
    [report]
  );

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Воронка онбординга</h1>
          <p className="mt-1 text-sm text-gray-400">
            Когорта: пользователи, зарегистрировавшиеся в выбранном периоде
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {[
            { label: "Сегодня", days: 1 },
            { label: "7 дней", days: 7 },
            { label: "30 дней", days: 30 },
          ].map((preset) => (
            <button
              key={preset.days}
              type="button"
              onClick={() => {
                const range = presetRange(preset.days);
                setFrom(range.from);
                setTo(range.to);
              }}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-medium text-gray-300 transition hover:border-amber-500/40 hover:text-white"
            >
              {preset.label}
            </button>
          ))}
          <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-transparent text-sm text-white outline-none"
            />
            <span className="text-gray-600">—</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-transparent text-sm text-white outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadReport()}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-gray-950 transition hover:bg-amber-400"
          >
            <Filter className="h-4 w-4" />
            Применить
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && report && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Регистрации",
                value: report.summary.registrations,
                sub: `${report.range.from} — ${report.range.to}`,
                icon: UserPlus,
                color: "text-blue-400",
              },
              {
                label: "QR создан",
                value: report.summary.completed,
                sub:
                  report.summary.completionRate !== null
                    ? `${report.summary.completionRate}% от регистраций`
                    : "—",
                icon: GitBranch,
                color: "text-emerald-400",
              },
              {
                label: "Скачали PNG",
                value: report.summary.qrDownloaded,
                sub:
                  report.summary.downloadRate !== null
                    ? `${report.summary.downloadRate}% от создавших QR`
                    : "—",
                icon: Download,
                color: "text-cyan-400",
              },
              {
                label: "Открыли мастер",
                value: report.summary.intentViewed,
                sub: `${report.summary.intentSelected} выбрали сценарий`,
                icon: MousePointerClick,
                color: "text-amber-400",
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="rounded-xl border border-gray-800 bg-gray-900 p-5"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <Icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  <p className="text-2xl font-bold text-white">{card.value}</p>
                  <p className="mt-0.5 text-sm text-gray-500">{card.sub}</p>
                  <p className="mt-1 text-xs text-gray-600">{card.label}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">Воронка</h2>
              <div className="space-y-3">
                {report.funnel.map((step, index) => {
                  const width = Math.max((step.count / maxFunnelCount) * 100, step.count > 0 ? 8 : 2);
                  return (
                    <div key={step.key}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-gray-300">{step.label}</span>
                        <span className="font-semibold text-white">
                          {step.count}
                          {step.rateFromStart !== null && (
                            <span className="ml-2 text-xs font-normal text-gray-500">
                              {step.rateFromStart}% от старта
                            </span>
                          )}
                          {step.rateFromPrev !== null && (
                            <span className="ml-1 text-xs font-normal text-gray-600">
                              · {step.rateFromPrev}% от пред.
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-8 overflow-hidden rounded-lg bg-gray-800">
                        <div
                          className="flex h-full items-center rounded-lg px-3 text-xs font-medium text-gray-950 transition-all"
                          style={{
                            width: `${width}%`,
                            backgroundColor: FUNNEL_COLORS[index % FUNNEL_COLORS.length],
                          }}
                        >
                          {step.count > 0 ? step.count : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
                <h2 className="mb-4 text-lg font-semibold text-white">Активность по дням</h2>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#9ca3af", fontSize: 11 }}
                        tickFormatter={(v: string) => v.slice(5)}
                      />
                      <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "#111827",
                          border: "1px solid #374151",
                          borderRadius: 8,
                          color: "#f3f4f6",
                        }}
                      />
                      <Bar dataKey="registrations" name="Регистрации" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="completed" name="QR создан" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="downloaded" name="Скачали PNG" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                  <h3 className="mb-3 text-sm font-semibold text-white">Сценарии</h3>
                  {report.intentBreakdown.length === 0 ? (
                    <p className="text-sm text-gray-500">Нет данных</p>
                  ) : (
                    <div className="space-y-2">
                      {report.intentBreakdown.map((row) => (
                        <div
                          key={row.intent}
                          className="flex items-center justify-between rounded-lg bg-gray-800 px-3 py-2 text-sm"
                        >
                          <span className="text-gray-300">
                            {INTENT_LABELS[row.intent] ?? row.intent}
                          </span>
                          <span className="text-gray-400">
                            {row.completed}/{row.selected}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                  <h3 className="mb-3 text-sm font-semibold text-white">Куда ушли после мастера</h3>
                  {report.destinations.length === 0 ? (
                    <p className="text-sm text-gray-500">Нет переходов</p>
                  ) : (
                    <div className="space-y-2">
                      {report.destinations.map((row) => (
                        <div
                          key={row.destination}
                          className="flex items-center justify-between rounded-lg bg-gray-800 px-3 py-2 text-sm"
                        >
                          <span className="text-gray-300">
                            {DESTINATION_LABELS[row.destination] ?? row.destination}
                          </span>
                          <span className="font-medium text-white">{row.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                  <h3 className="mb-1 text-sm font-semibold text-white">Источники регистраций</h3>
                  <p className="mb-3 text-xs text-gray-500">Регистрации / QR создан / скачан файл</p>
                  {report.sourceBreakdown.length === 0 ? (
                    <p className="text-sm text-gray-500">Нет данных</p>
                  ) : (
                    <div className="space-y-2">
                      {report.sourceBreakdown.map((row) => (
                        <div
                          key={row.source}
                          className="flex items-center justify-between gap-3 rounded-lg bg-gray-800 px-3 py-2 text-sm"
                        >
                          <span className="min-w-0 truncate text-gray-300">{row.source}</span>
                          <span className="shrink-0 text-gray-400">
                            {row.registrations}/{row.completed}/{row.downloaded}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <MonetizationBlock data={report.monetization} />

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-white">
                Пользователи когорты ({report.users.length})
              </h2>
            </div>
            {report.users.length === 0 ? (
              <p className="text-sm text-gray-500">За период регистраций нет</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1040px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-2 font-medium">Пользователь</th>
                      <th className="px-3 py-2 font-medium">Регистрация</th>
                      <th className="px-3 py-2 font-medium">Источник</th>
                      <th className="px-3 py-2 font-medium">Сценарий</th>
                      <th className="px-3 py-2 font-medium">Шаги</th>
                      <th className="px-3 py-2 font-medium">Дальше</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.users.map((user) => (
                      <tr key={user.id} className="border-b border-gray-800/80 last:border-0">
                        <td className="px-3 py-3">
                          <p className="font-medium text-white">{user.name || "—"}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </td>
                        <td className="px-3 py-3 text-gray-400">
                          {new Date(user.registeredAt).toLocaleString("ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-3 py-3 text-gray-400">{user.source}</td>
                        <td className="px-3 py-3 text-gray-300">
                          {user.intent ? INTENT_LABELS[user.intent] ?? user.intent : "—"}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            <StepBadge ok={user.steps.intentViewed} label="Мастер" />
                            <StepBadge ok={user.steps.intentSelected} label="Сценарий" />
                            <StepBadge ok={user.steps.formSubmitted} label="Форма" />
                            <StepBadge ok={user.steps.completed} label="QR" />
                            <StepBadge ok={user.steps.qrDownloaded} label="PNG" />
                            <StepBadge ok={user.steps.previewOpened} label="Превью" />
                          </div>
                        </td>
                        <td className="px-3 py-3 text-gray-400">
                          {user.lastDestination
                            ? DESTINATION_LABELS[user.lastDestination] ?? user.lastDestination
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}


const SECTION_LABELS: Record<string, string> = {
  start: "Мастер",
  home: "Главная кабинета",
  projects: "Список проектов",
  "project.home": "Главная проекта",
  "project.qrcodes": "Список QR",
  "project.qrcode": "Карточка QR",
  "project.card": "Редактор визитки",
  "project.page": "Микросайт",
  "project.inbox": "Обратная связь",
  "project.stats": "Статистика",
  "project.settings": "Настройки проекта",
  subscription: "Тариф и оплата",
  settings: "Настройки аккаунта",
  "settings.templates": "Стили QR",
  support: "Поддержка",
  partner: "Партнёрка",
  network: "Сводка по сети",
};

const PAYWALL_LABELS: Record<string, string> = {
  landing: "Микросайт",
  gif: "Анимированный QR (GIF)",
  stl: "3D-печать (STL)",
};

const LIMIT_LABELS: Record<string, string> = {
  projects: "Второй проект на тарифе",
  landing: "Микросайт на FREE",
};

function MonetizationList({
  title,
  hint,
  rows,
}: {
  title: string;
  hint?: string;
  rows: { label: string; value: number }[];
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {hint && <p className="mb-2 mt-0.5 text-xs text-gray-500">{hint}</p>}
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">Пока нет данных</p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 rounded-lg bg-gray-800 px-3 py-1.5 text-sm"
            >
              <span className="min-w-0 truncate text-gray-300">{row.label}</span>
              <span className="shrink-0 font-medium text-white">{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MonetizationBlock({ data }: { data: SetupFunnelReport["monetization"] }) {
  const max = Math.max(...data.steps.map((s) => s.count), 1);
  return (
    <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h2 className="text-lg font-semibold text-white">Путь к оплате</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">
        Уникальные пользователи когорты. Визиты в кабинет и клики по тарифам пишутся с 15 ноября
        2026 — у более ранних регистраций эти шаги пустые.
      </p>
      <div className="space-y-2">
        {data.steps.map((step) => (
          <div key={step.key} className="flex items-center gap-3 text-sm">
            <span className="w-64 shrink-0 text-gray-300">{step.label}</span>
            <div className="h-6 min-w-0 flex-1 overflow-hidden rounded bg-gray-800">
              <div
                className="h-full rounded bg-amber-500"
                style={{ width: `${(step.count / max) * 100}%` }}
              />
            </div>
            <span className="w-24 shrink-0 text-right font-medium text-white">
              {step.count}
              {step.rateFromStart !== null && (
                <span className="ml-1 font-normal text-gray-500">{step.rateFromStart}%</span>
              )}
            </span>
          </div>
        ))}
      </div>
      {data.checkoutWithoutConsent > 0 && (
        <p className="mt-3 text-sm text-amber-300">
          {data.checkoutWithoutConsent} чел. нажали «Оплатить» без галочки автосписаний и не дошли
          до оплаты.
        </p>
      )}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonetizationList
          title="Откуда идут на тарифы"
          hint="Раздел кабинета и текст ссылки"
          rows={data.upgradeClicks.map((r) => ({
            label: `${SECTION_LABELS[r.from] ?? r.from} — ${r.text || "без текста"}`,
            value: r.users,
          }))}
        />
        <MonetizationList
          title="Какие разделы открывают"
          rows={data.sections.map((r) => ({
            label: SECTION_LABELS[r.section] ?? r.section,
            value: r.users,
          }))}
        />
        <MonetizationList
          title="Показы paywall"
          rows={data.paywalls.map((r) => ({
            label: PAYWALL_LABELS[r.feature] ?? r.feature,
            value: r.users,
          }))}
        />
        <MonetizationList
          title="Упёрлись в лимит тарифа"
          hint="Сервер отказал: нужен платный тариф"
          rows={data.limitHits.map((r) => ({
            label: LIMIT_LABELS[r.limit] ?? r.limit,
            value: r.users,
          }))}
        />
      </div>
    </div>
  );
}
