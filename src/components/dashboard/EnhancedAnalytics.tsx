"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import {
  Loader2,
  Download,
  TrendingUp,
  TrendingDown,
  Star,
  MessageSquare,
  MousePointerClick,
  AlertTriangle,
  Calendar,
  Store,
  QrCode,
  BarChart3,
  Wifi,
  FileText,
  ArrowRightCircle,
  CreditCard,
} from "lucide-react";

interface AnalyticsData {
  period: { label: string; days: number };
  stats: {
    totalReviews: number;
    avgRating: number;
    positiveCount: number;
    negativeCount: number;
    negativePercent: number;
    totalScans: number;
    conversionRate: number;
  };
  previousPeriod: {
    totalReviews: number;
    avgRating: number;
    negativePercent: number;
  };
  dailyReviews: {
    date: string;
    count: number;
    negative: number;
    avgRating: number;
  }[];
  ratingDistribution: { rating: number; count: number }[];
  dayOfWeekStats: { day: string; count: number }[];
  topEstablishments: {
    id: string;
    name: string;
    reviews: number;
    avgRating: number;
  }[];
  recentReviews: {
    id: string;
    rating: number;
    comment: string | null;
    guestName: string | null;
    isNegative: boolean;
    createdAt: string;
    establishmentName: string;
  }[];
  qrcodes: {
    id: string;
    code: string;
    label: string | null;
    mode: string;
    establishmentId: string;
    establishmentName: string;
    scansCount: number;
    reviewsCount: number;
    conversionRate: number;
  }[];
  establishmentScans: {
    id: string;
    name: string;
    scansCount: number;
    reviewsCount: number;
    qrCount: number;
    conversionRate: number;
  }[];
  scansByMode: {
    mode: string;
    label: string;
    scans: number;
    qrCount: number;
  }[];
  establishments: {
    id: string;
    name: string;
  }[];
}

type Tab = "reviews" | "scans";

const MODE_LABELS: Record<string, string> = {
  REVIEW: "Отзывы",
  REDIRECT: "Редирект",
  BUSINESS_CARD: "Визитка",
  WIFI: "Wi-Fi",
  FILE: "Файл",
};

const MODE_COLORS: Record<string, string> = {
  REVIEW: "bg-indigo-100 text-indigo-700",
  REDIRECT: "bg-orange-100 text-orange-700",
  BUSINESS_CARD: "bg-purple-100 text-purple-700",
  WIFI: "bg-cyan-100 text-cyan-700",
  FILE: "bg-amber-100 text-amber-700",
};

const MODE_PIE_COLORS: Record<string, string> = {
  REVIEW: "#6366f1",
  REDIRECT: "#f97316",
  BUSINESS_CARD: "#a855f7",
  WIFI: "#06b6d4",
  FILE: "#f59e0b",
};

const MODE_ICONS: Record<string, React.ElementType> = {
  REVIEW: MessageSquare,
  REDIRECT: ArrowRightCircle,
  BUSINESS_CARD: CreditCard,
  WIFI: Wifi,
  FILE: FileText,
};

function ModeBadge({ mode }: { mode: string }) {
  const Icon = MODE_ICONS[mode] || QrCode;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${MODE_COLORS[mode] || "bg-gray-100 text-gray-700"}`}>
      <Icon className="w-3 h-3" />
      {MODE_LABELS[mode] || mode}
    </span>
  );
}

const PRESETS = [
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "90d", label: "90 дней" },
  { value: "all", label: "Всё время" },
];

const RATING_COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function TrendBadge({
  current,
  previous,
  inverse = false,
}: {
  current: number;
  previous: number;
  inverse?: boolean;
}) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0)
    return (
      <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
        Новое
      </span>
    );

  const change = +(((current - previous) / previous) * 100).toFixed(0);
  const isUp = change >= 0;
  const isGood = inverse ? !isUp : isUp;

  return (
    <span
      className={`text-xs font-medium px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 ${
        isGood ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50"
      }`}
    >
      {isUp ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      {isUp ? "+" : ""}
      {change}%
    </span>
  );
}

export default function EnhancedAnalytics() {
  const [activeTab, setActiveTab] = useState<Tab>("reviews");
  const [queryStr, setQueryStr] = useState("period=30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [filterEstId, setFilterEstId] = useState<string>("");
  const [filterQrId, setFilterQrId] = useState<string>("");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [fetchedKey, setFetchedKey] = useState("");

  const buildQuery = useCallback(() => {
    let q = queryStr;
    if (filterEstId) q += `&establishmentId=${filterEstId}`;
    if (filterQrId) q += `&qrCodeId=${filterQrId}`;
    return q;
  }, [queryStr, filterEstId, filterQrId]);

  useEffect(() => {
    fetch(`/api/analytics?${buildQuery()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && !d.error) {
          setData(d);
          setFetchedKey(buildQuery());
        }
      })
      .catch(() => {});
  }, [buildQuery]);

  const loading = fetchedKey !== buildQuery();

  const activePreset = queryStr.startsWith("period=")
    ? queryStr.slice(7)
    : null;
  const isCustomActive = queryStr.startsWith("from=");

  const handlePreset = (p: string) => {
    setCustomFrom("");
    setCustomTo("");
    setQueryStr(`period=${p}`);
  };

  const handleCustomApply = () => {
    if (customFrom && customTo && customFrom <= customTo) {
      setQueryStr(`from=${customFrom}&to=${customTo}`);
    }
  };

  const exportCSV = useCallback(() => {
    if (!data) return;
    const headers = [
      "Дата",
      "Заведение",
      "Оценка",
      "Комментарий",
      "Имя гостя",
      "Тип",
    ];
    const rows = data.recentReviews.map((r) => [
      new Date(r.createdAt).toLocaleDateString("ru-RU"),
      `"${r.establishmentName}"`,
      r.rating,
      `"${(r.comment || "").replace(/"/g, '""')}"`,
      r.guestName || "",
      r.isNegative ? "Негатив" : "Позитив",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n"
    );
    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const filteredQrs = data
    ? data.qrcodes.filter((q) => !filterEstId || q.establishmentId === filterEstId)
    : [];

  const {
    stats,
    previousPeriod,
    dailyReviews,
    ratingDistribution,
    dayOfWeekStats,
    topEstablishments,
    recentReviews,
  } = data;

  const scanPieData = (data.scansByMode || []).map((m) => ({
    name: m.label,
    value: m.scans,
    fill: MODE_PIE_COLORS[m.mode] || "#9ca3af",
  }));

  const reviewCapableScans = (data.scansByMode || [])
    .filter((m) => m.mode === "REVIEW" || m.mode === "LANDING")
    .reduce((a, m) => a + m.scans, 0);
  const otherScans = stats.totalScans - reviewCapableScans;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Расширенная аналитика
            </h1>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab("reviews")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "reviews"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Отзывы
              </button>
              <button
                onClick={() => setActiveTab("scans")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "scans"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <MousePointerClick className="w-3.5 h-3.5" />
                Сканирования
              </button>
            </div>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
        </div>

        <Card padding="sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Store className="w-4 h-4 text-gray-400 shrink-0" />
              <select
                value={filterEstId}
                onChange={(e) => {
                  setFilterEstId(e.target.value);
                  setFilterQrId("");
                }}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              >
                <option value="">Все заведения</option>
                {data?.establishments.map((est) => (
                  <option key={est.id} value={est.id}>{est.name}</option>
                ))}
              </select>
            </div>
            <div className="hidden sm:block w-px h-8 bg-gray-200" />
            <div className="flex items-center gap-2 flex-wrap">
              <QrCode className="w-4 h-4 text-gray-400 shrink-0" />
              <select
                value={filterQrId}
                onChange={(e) => setFilterQrId(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              >
                <option value="">Все QR-коды</option>
                {filteredQrs.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.code}{q.label ? ` (${q.label})` : ""} — {q.establishmentName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 p-1">
            <div className="flex bg-gray-100 rounded-lg p-1 shrink-0">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => handlePreset(p.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activePreset === p.value
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="hidden lg:block w-px h-8 bg-gray-200" />

            <div className="flex items-center gap-2 flex-wrap">
              <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                max={customTo || todayISO()}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <span className="text-gray-400 text-sm">&mdash;</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                min={customFrom || undefined}
                max={todayISO()}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <Button
                size="sm"
                variant={
                  isCustomActive && customFrom && customTo ? "primary" : "outline"
                }
                onClick={handleCustomApply}
                disabled={!customFrom || !customTo || customFrom > customTo}
              >
                Применить
              </Button>
              {isCustomActive && (
                <span className="text-xs text-gray-400">
                  {new Date(customFrom).toLocaleDateString("ru-RU")} &mdash;{" "}
                  {new Date(customTo).toLocaleDateString("ru-RU")}
                </span>
              )}
            </div>
          </div>
        </Card>
      </div>

      {activeTab === "reviews" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Отзывы за период</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.totalReviews}
                  </p>
                </div>
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-indigo-600" />
                </div>
              </div>
              <div className="mt-2">
                <TrendBadge
                  current={stats.totalReviews}
                  previous={previousPeriod.totalReviews}
                />
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Средняя оценка</p>
                  <div className="flex items-center gap-1">
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.avgRating || "—"}
                    </p>
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  </div>
                </div>
                <div className="p-2 bg-green-50 rounded-lg">
                  <Star className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <div className="mt-2">
                <TrendBadge
                  current={stats.avgRating}
                  previous={previousPeriod.avgRating}
                />
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Конверсия</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.conversionRate}%
                  </p>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg">
                  <MousePointerClick className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Отзывы / сканы QR-отзывов
              </p>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Негативных</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.negativePercent}%
                  </p>
                </div>
                <div className="p-2 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
              </div>
              <div className="mt-2">
                <TrendBadge
                  current={stats.negativePercent}
                  previous={previousPeriod.negativePercent}
                  inverse
                />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <h3 className="font-semibold text-gray-900 mb-4">
                Динамика отзывов
              </h3>
              {dailyReviews.some((d) => d.count > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={dailyReviews}>
                    <defs>
                      <linearGradient
                        id="gradReviews"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#6366f1"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="95%"
                          stopColor="#6366f1"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={fmtDate}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                    />
                    <Tooltip
                      labelFormatter={(label) => fmtDate(String(label))}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#6366f1"
                      fill="url(#gradReviews)"
                      strokeWidth={2}
                      name="Отзывы"
                    />
                    <Area
                      type="monotone"
                      dataKey="negative"
                      stroke="#ef4444"
                      fill="#ef444420"
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                      name="Негативные"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">
                  Нет данных за выбранный период
                </div>
              )}
            </Card>

            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">
                По дням недели
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dayOfWeekStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    fill="#6366f1"
                    radius={[4, 4, 0, 0]}
                    name="Отзывы"
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">
                Распределение оценок
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={ratingDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="rating"
                    tickFormatter={(v: number) => `${v} \u2605`}
                    width={40}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Количество">
                    {ratingDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={RATING_COLORS[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">Топ заведений</h3>
              {topEstablishments.length > 0 ? (
                <div className="space-y-3">
                  {topEstablishments.map((est, i) => (
                    <div
                      key={est.id}
                      className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-gray-300 w-6">
                          {i + 1}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {est.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {est.reviews}{" "}
                            {est.reviews === 1
                              ? "отзыв"
                              : est.reviews < 5
                                ? "отзыва"
                                : "отзывов"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-semibold">{est.avgRating}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">
                  Нет данных
                </div>
              )}
            </Card>
          </div>

          {recentReviews.length > 0 && (
            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">
                Последние отзывы
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">
                        Дата
                      </th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">
                        Заведение
                      </th>
                      <th className="text-center py-2 px-3 text-gray-500 font-medium">
                        Оценка
                      </th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">
                        Комментарий
                      </th>
                      <th className="text-center py-2 px-3 text-gray-500 font-medium">
                        Тип
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentReviews.map((review) => (
                      <tr
                        key={review.id}
                        className="border-b border-gray-50 hover:bg-gray-50"
                      >
                        <td className="py-2 px-3 text-gray-600">
                          {new Date(review.createdAt).toLocaleDateString("ru-RU")}
                        </td>
                        <td className="py-2 px-3 text-gray-900">
                          {review.establishmentName}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="inline-flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                            {review.rating}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-600 max-w-xs truncate">
                          {review.comment || "—"}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Badge
                            variant={review.isNegative ? "danger" : "success"}
                          >
                            {review.isNegative ? "Негатив" : "Позитив"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {activeTab === "scans" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Всего сканирований</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.totalScans}
                  </p>
                </div>
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <MousePointerClick className="w-5 h-5 text-indigo-600" />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Все типы QR-кодов
              </p>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">QR-отзывы</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {reviewCapableScans}
                  </p>
                </div>
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-indigo-600" />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Сканы QR-кодов типа «Отзывы»
              </p>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Прочие сканы</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {otherScans}
                  </p>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg">
                  <QrCode className="w-5 h-5 text-gray-600" />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Wi-Fi, визитки, редиректы
              </p>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Конверсия</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.conversionRate}%
                  </p>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Отзывы / сканы QR-отзывов
              </p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <h3 className="font-semibold text-gray-900 mb-4">
                Конверсия по дням
              </h3>
              {dailyReviews.some((d) => d.count > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyReviews}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={fmtDate}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                    />
                    <Tooltip
                      labelFormatter={(label) => fmtDate(String(label))}
                    />
                    <Bar
                      dataKey="count"
                      fill="#6366f1"
                      radius={[4, 4, 0, 0]}
                      name="Отзывы"
                    />
                    <Bar
                      dataKey="negative"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                      name="Негативные"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">
                  Нет данных за выбранный период
                </div>
              )}
            </Card>

            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">
                По типам QR
              </h3>
              {scanPieData.length > 0 && scanPieData.some((d) => d.value > 0) ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={scanPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={85}
                        dataKey="value"
                        stroke="none"
                      >
                        {scanPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    {scanPieData.map((d) => (
                      <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-500">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.fill }} />
                        {d.name} ({d.value})
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-[220px] text-gray-400 text-sm">
                  Нет данных
                </div>
              )}
            </Card>
          </div>

          {(data.scansByMode || []).length > 0 && (
            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">
                Распределение по типам
              </h3>
              <div className="space-y-3">
                {(data.scansByMode || []).map((item) => {
                  const pct = stats.totalScans > 0 ? (item.scans / stats.totalScans) * 100 : 0;
                  const Icon = MODE_ICONS[item.mode] || QrCode;
                  return (
                    <div key={item.mode}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-sm">
                            {item.label}
                          </span>
                          <span className="text-xs text-gray-400">
                            ({item.qrCount} QR)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{item.scans}</span>
                          <span className="text-xs text-gray-400">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: MODE_PIE_COLORS[item.mode] || "#9ca3af",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">
              Сканирования по QR-кодам
            </h3>
            {filteredQrs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">
                        QR-код
                      </th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">
                        Тип
                      </th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">
                        Заведение
                      </th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">
                        Сканирований
                      </th>
                      {filteredQrs.some((q) => q.mode === "REVIEW") && (
                        <>
                          <th className="text-right py-2 px-3 text-gray-500 font-medium">
                            Отзывов
                          </th>
                          <th className="text-right py-2 px-3 text-gray-500 font-medium">
                            Конверсия
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQrs
                      .sort((a, b) => b.scansCount - a.scansCount)
                      .map((q) => (
                        <tr
                          key={q.id}
                          className="border-b border-gray-50 hover:bg-gray-50"
                        >
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <QrCode className="w-4 h-4 text-gray-400" />
                              <span className="font-medium">{q.code}</span>
                              {q.label && (
                                <span className="text-gray-400">({q.label})</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <ModeBadge mode={q.mode} />
                          </td>
                          <td className="py-2 px-3 text-gray-600">
                            {q.establishmentName}
                          </td>
                          <td className="text-right py-2 px-3 font-medium">
                            {q.scansCount}
                          </td>
                          {filteredQrs.some((qr) => qr.mode === "REVIEW") && (
                            <>
                              <td className="text-right py-2 px-3">
                                {q.mode === "REVIEW" ? q.reviewsCount : "—"}
                              </td>
                              <td className="text-right py-2 px-3">
                                {q.mode === "REVIEW" && q.scansCount > 0 ? (
                                  <span className={`font-medium ${
                                    q.conversionRate >= 30
                                      ? "text-green-600"
                                      : q.conversionRate >= 15
                                        ? "text-yellow-600"
                                        : "text-red-600"
                                  }`}>
                                    {q.conversionRate}%
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                Нет QR-кодов
              </div>
            )}
          </Card>

          {data.establishmentScans && data.establishmentScans.length > 0 && (
            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">
                Сканирования по заведениям
              </h3>
              <div className="space-y-4">
                {data.establishmentScans
                  .sort((a, b) => b.scansCount - a.scansCount)
                  .map((est) => (
                    <div
                      key={est.id}
                      className="border-b border-gray-50 pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {est.name}
                          </span>
                          <span className="text-xs text-gray-400">
                            ({est.qrCount} QR)
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-500">
                            {est.scansCount} скан.
                          </span>
                          <span className="text-gray-500">
                            {est.reviewsCount} отзыв.
                          </span>
                          <span className={`font-medium ${
                            est.conversionRate >= 30
                              ? "text-green-600"
                              : est.conversionRate >= 15
                                ? "text-yellow-600"
                                : est.scansCount > 0
                                  ? "text-red-600"
                                  : "text-gray-400"
                          }`}>
                            {est.scansCount > 0 ? `${est.conversionRate}%` : "—"}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500 transition-all"
                          style={{
                            width: `${stats.totalScans > 0 ? (est.scansCount / stats.totalScans) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
