"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import {
  Star,
  MessageSquare,
  MousePointerClick,
  Store,
  QrCode as QrCodeIcon,
  BarChart3,
  Wifi,
  FileText,
  ArrowRightCircle,
  CreditCard,
} from "lucide-react";

interface Establishment {
  id: string;
  name: string;
  reviews: {
    id: string;
    rating: number;
    comment: string | null;
    isNegative: boolean;
    qrCodeId: string | null;
    createdAt: string;
  }[];
  qrcodes: {
    id: string;
    code: string;
    label: string | null;
    mode: string;
    scansCount: number;
  }[];
}

interface Props {
  establishments: Establishment[];
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

const MODE_ICONS: Record<string, React.ElementType> = {
  REVIEW: MessageSquare,
  REDIRECT: ArrowRightCircle,
  BUSINESS_CARD: CreditCard,
  WIFI: Wifi,
  FILE: FileText,
};

function ModeBadge({ mode }: { mode: string }) {
  const Icon = MODE_ICONS[mode] || QrCodeIcon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${MODE_COLORS[mode] || "bg-gray-100 text-gray-700"}`}>
      <Icon className="w-3 h-3" />
      {MODE_LABELS[mode] || mode}
    </span>
  );
}

export default function BasicAnalytics({ establishments }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("reviews");
  const [filterEstId, setFilterEstId] = useState<string>("");
  const [filterQrId, setFilterQrId] = useState<string>("");

  const filteredEst = filterEstId
    ? establishments.filter((e) => e.id === filterEstId)
    : establishments;

  const qrcodes = filteredEst.flatMap((e) =>
    e.qrcodes.map((q) => ({ ...q, establishmentId: e.id, establishmentName: e.name }))
  );

  const filteredQrs = filterQrId
    ? qrcodes.filter((q) => q.id === filterQrId)
    : qrcodes;

  const allReviews = filteredEst.flatMap((e) =>
    filterQrId
      ? e.reviews.filter((r) => r.qrCodeId === filterQrId)
      : e.reviews
  );

  const totalScans = filteredQrs.reduce((a, q) => a + q.scansCount, 0);
  const reviewCapableScans = filteredQrs
    .filter((q) => q.mode === "REVIEW" || q.mode === "LANDING")
    .reduce((a, q) => a + q.scansCount, 0);
  const otherScans = totalScans - reviewCapableScans;

  const ratingDistribution = [1, 2, 3, 4, 5].map((r) => ({
    rating: r,
    count: allReviews.filter((rev) => rev.rating === r).length,
  }));

  const negativeCount = allReviews.filter((r) => r.isNegative).length;
  const positiveCount = allReviews.filter((r) => !r.isNegative).length;
  const avgRating =
    allReviews.length > 0
      ? (allReviews.reduce((a, r) => a + r.rating, 0) / allReviews.length).toFixed(1)
      : "—";

  const conversionRate =
    reviewCapableScans > 0
      ? ((allReviews.length / reviewCapableScans) * 100).toFixed(1)
      : "—";

  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);
  const recentReviews = allReviews.filter(
    (r) => new Date(r.createdAt) >= last30Days
  );

  const dailyStats: Record<string, { reviews: number; negative: number }> = {};
  recentReviews.forEach((r) => {
    const day = new Date(r.createdAt).toISOString().split("T")[0];
    if (!dailyStats[day]) dailyStats[day] = { reviews: 0, negative: 0 };
    dailyStats[day].reviews++;
    if (r.isNegative) dailyStats[day].negative++;
  });

  const selectedQrLabel = filterQrId
    ? (() => {
        const q = qrcodes.find((qr) => qr.id === filterQrId);
        return q ? `${q.code}${q.label ? ` (${q.label})` : ""}` : "";
      })()
    : "";

  const qrReviewCounts: Record<string, number> = {};
  allReviews.forEach((r) => {
    if (r.qrCodeId) {
      qrReviewCounts[r.qrCodeId] = (qrReviewCounts[r.qrCodeId] || 0) + 1;
    }
  });

  const scansByMode: Record<string, { mode: string; scans: number; qrCount: number }> = {};
  filteredQrs.forEach((q) => {
    if (!scansByMode[q.mode]) {
      scansByMode[q.mode] = { mode: q.mode, scans: 0, qrCount: 0 };
    }
    scansByMode[q.mode].scans += q.scansCount;
    scansByMode[q.mode].qrCount++;
  });
  const scansByModeList = Object.values(scansByMode).sort((a, b) => b.scans - a.scans);

  const reviewQrs = filteredQrs.filter((q) => q.mode === "REVIEW");
  const otherQrs = filteredQrs.filter((q) => q.mode !== "REVIEW");

  return (
    <>
      <div className="flex bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("reviews")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === "reviews"
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Отзывы
        </button>
        <button
          onClick={() => setActiveTab("scans")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === "scans"
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <MousePointerClick className="w-4 h-4" />
          Сканирования
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
              {establishments.map((est) => (
                <option key={est.id} value={est.id}>{est.name}</option>
              ))}
            </select>
          </div>
          <div className="hidden sm:block w-px h-8 bg-gray-200" />
          <div className="flex items-center gap-2 flex-wrap">
            <QrCodeIcon className="w-4 h-4 text-gray-400 shrink-0" />
            <select
              value={filterQrId}
              onChange={(e) => setFilterQrId(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            >
              <option value="">Все QR-коды</option>
              {qrcodes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.code}{q.label ? ` (${q.label})` : ""} [{MODE_LABELS[q.mode] || q.mode}] — {q.establishmentName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {selectedQrLabel && (
        <p className="text-sm text-gray-500">
          Статистика по QR-коду: <span className="font-medium text-gray-700">{selectedQrLabel}</span>
        </p>
      )}

      {activeTab === "reviews" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{allReviews.length}</p>
                  <p className="text-sm text-gray-500">Всего отзывов</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <Star className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{avgRating}</p>
                  <p className="text-sm text-gray-500">Средняя оценка</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{conversionRate}%</p>
                  <p className="text-sm text-gray-500">Конверсия в отзыв</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {allReviews.length > 0
                      ? ((negativeCount / allReviews.length) * 100).toFixed(0)
                      : 0}
                    %
                  </p>
                  <p className="text-sm text-gray-500">Негативных</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">
                Распределение оценок
              </h3>
              <div className="space-y-3">
                {ratingDistribution.map((rd) => (
                  <div key={rd.rating} className="flex items-center gap-3">
                    <span className="text-sm w-8 text-right">
                      {rd.rating} ★
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-yellow-400 transition-all"
                        style={{
                          width: `${allReviews.length > 0 ? (rd.count / allReviews.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm text-gray-500 w-8">
                      {rd.count}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">
                Общая статистика
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Всего отзывов</span>
                  <span className="font-semibold">{allReviews.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Позитивных (4-5 ★)</span>
                  <span className="font-semibold text-green-600">
                    {positiveCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Негативных (1-3 ★)</span>
                  <span className="font-semibold text-red-600">
                    {negativeCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">За последние 30 дней</span>
                  <span className="font-semibold">{recentReviews.length}</span>
                </div>
              </div>
            </Card>
          </div>

          {Object.keys(dailyStats).length > 0 && (
            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">
                Отзывы за последние 30 дней
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">
                        Дата
                      </th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">
                        Всего
                      </th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">
                        Негативных
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(dailyStats)
                      .sort((a, b) => b[0].localeCompare(a[0]))
                      .slice(0, 14)
                      .map(([day, stats]) => (
                        <tr key={day} className="border-b border-gray-50">
                          <td className="py-2 px-3">
                            {new Date(day).toLocaleDateString("ru-RU")}
                          </td>
                          <td className="text-right py-2 px-3 font-medium">
                            {stats.reviews}
                          </td>
                          <td className="text-right py-2 px-3 text-red-600">
                            {stats.negative}
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <MousePointerClick className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalScans}</p>
                  <p className="text-sm text-gray-500">Всего сканирований</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{reviewCapableScans}</p>
                  <p className="text-sm text-gray-500">Сканы с отзывами</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-50 rounded-lg">
                    <QrCodeIcon className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{otherScans}</p>
                    <p className="text-sm text-gray-500">Прочие сканы</p>
                  </div>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{conversionRate}%</p>
                  <p className="text-sm text-gray-500">Конверсия в отзыв</p>
                </div>
              </div>
            </Card>
          </div>

          {scansByModeList.length > 0 && (
            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">
                Сканы по типам QR-кодов
              </h3>
              <div className="space-y-3">
                {scansByModeList.map((item) => {
                  const pct = totalScans > 0 ? (item.scans / totalScans) * 100 : 0;
                  const Icon = MODE_ICONS[item.mode] || QrCodeIcon;
                  return (
                    <div key={item.mode}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-sm">
                            {MODE_LABELS[item.mode] || item.mode}
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
                          className={`h-full rounded-full transition-all ${
                            item.mode === "REVIEW"
                              ? "bg-indigo-500"
                              : item.mode === "WIFI"
                                ? "bg-cyan-500"
                                : item.mode === "BUSINESS_CARD"
                                  ? "bg-purple-500"
                                  : item.mode === "FILE"
                                    ? "bg-amber-500"
                                    : "bg-orange-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {reviewQrs.length > 0 && (
            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">
                QR-коды отзывов
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">
                        QR-код
                      </th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">
                        Заведение
                      </th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">
                        Сканирований
                      </th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">
                        Отзывов
                      </th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">
                        Конверсия
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewQrs
                      .sort((a, b) => b.scansCount - a.scansCount)
                      .map((q) => {
                        const reviews = qrReviewCounts[q.id] || 0;
                        const conv = q.scansCount > 0
                          ? ((reviews / q.scansCount) * 100).toFixed(1)
                          : "—";
                        return (
                          <tr key={q.id} className="border-b border-gray-50">
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                <QrCodeIcon className="w-4 h-4 text-gray-400" />
                                <span className="font-medium">{q.code}</span>
                                {q.label && (
                                  <span className="text-gray-400">({q.label})</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-gray-600">
                              {q.establishmentName}
                            </td>
                            <td className="text-right py-2 px-3 font-medium">
                              {q.scansCount}
                            </td>
                            <td className="text-right py-2 px-3">
                              {reviews}
                            </td>
                            <td className="text-right py-2 px-3">
                              <span className={`font-medium ${
                                conv !== "—" && Number(conv) >= 30
                                  ? "text-green-600"
                                  : conv !== "—" && Number(conv) >= 15
                                    ? "text-yellow-600"
                                    : conv !== "—"
                                      ? "text-red-600"
                                      : "text-gray-400"
                              }`}>
                                {conv !== "—" ? `${conv}%` : conv}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {otherQrs.length > 0 && (
            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">
                Прочие QR-коды
              </h3>
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
                    </tr>
                  </thead>
                  <tbody>
                    {otherQrs
                      .sort((a, b) => b.scansCount - a.scansCount)
                      .map((q) => (
                        <tr key={q.id} className="border-b border-gray-50">
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <QrCodeIcon className="w-4 h-4 text-gray-400" />
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
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">
              Сканирования по заведениям
            </h3>
            {filteredEst.length > 0 ? (
              <div className="space-y-4">
                {filteredEst.map((est) => {
                  const estQrs = filterQrId
                    ? est.qrcodes.filter((q) => q.id === filterQrId)
                    : est.qrcodes;
                  const estScans = estQrs.reduce((a, q) => a + q.scansCount, 0);
                  const estReviewCapableScans = estQrs
                    .filter((q) => q.mode === "REVIEW" || q.mode === "LANDING")
                    .reduce((a, q) => a + q.scansCount, 0);
                  const estReviews = est.reviews.filter(
                    (r) => !filterQrId || r.qrCodeId === filterQrId
                  ).length;
                  const estConv = estReviewCapableScans > 0
                    ? ((estReviews / estReviewCapableScans) * 100).toFixed(1)
                    : "—";
                  return (
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
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-500">
                            {estScans} скан.
                          </span>
                          <span className="text-gray-500">
                            {estReviews} отзыв.
                          </span>
                          <span className="font-medium">
                            {estConv !== "—" ? `${estConv}%` : estConv}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500 transition-all"
                          style={{
                            width: `${totalScans > 0 ? (estScans / totalScans) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <div className="flex gap-2 mt-1">
                        {Object.entries(
                          estQrs.reduce<Record<string, number>>((acc, q) => {
                            acc[q.mode] = (acc[q.mode] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([mode, count]) => (
                          <span key={mode} className="text-xs text-gray-400">
                            {count} {MODE_LABELS[mode] || mode}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                Нет заведений
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
