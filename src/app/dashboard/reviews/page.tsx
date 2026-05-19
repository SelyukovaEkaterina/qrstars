"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import {
  Star,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Search,
  X,
  Calendar,
  MessageSquare,
} from "lucide-react";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  guestName: string | null;
  guestPhone: string | null;
  isNegative: boolean;
  isProcessed: boolean;
  createdAt: string;
  establishment: { id: string; name: string };
  qrCode: { id: string; code: string; label: string | null } | null;
}

interface EstablishmentOption {
  id: string;
  name: string;
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${
            i <= rating
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-300"
          }`}
        />
      ))}
      <span className="ml-1 text-sm font-medium text-gray-700">{rating}</span>
    </div>
  );
}

export default function ReviewsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [establishments, setEstablishments] = useState<EstablishmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [filterNegative, setFilterNegative] = useState("");
  const [filterRating, setFilterRating] = useState("");
  const [filterEstablishment, setFilterEstablishment] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/establishments")
        .then((r) => r.json())
        .then((data) => {
          const list = (data.establishments || []).map((e: { id: string; name: string }) => ({
            id: e.id,
            name: e.name,
          }));
          setEstablishments(list);
        })
        .catch(() => {});
    }
  }, [status]);

  const fetchReviews = useCallback(() => {
    if (status !== "authenticated") return;
    setLoading(true);

    const params = new URLSearchParams({ page: String(page) });
    if (filterNegative) params.set("negative", filterNegative);
    if (filterRating) params.set("rating", filterRating);
    if (filterEstablishment) params.set("establishmentId", filterEstablishment);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (search.trim()) params.set("search", search.trim());

    fetch(`/api/reviews?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setReviews(data.reviews || []);
        setPages(data.pages || 1);
        setTotal(data.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, page, filterNegative, filterRating, filterEstablishment, dateFrom, dateTo, search]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;
    queueMicrotask(() => fetchReviews());
  }, [fetchReviews, status, router]);

  const resetFilters = () => {
    setSearch("");
    setFilterNegative("");
    setFilterRating("");
    setFilterEstablishment("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const hasActiveFilters =
    search || filterNegative || filterRating || filterEstablishment || dateFrom || dateTo;

  const handleFilterChange =
    (setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      setter(e.target.value);
      setPage(1);
    };

  const getPageNumbers = () => {
    const delta = 2;
    const nums: (number | string)[] = [];
    const left = Math.max(2, page - delta);
    const right = Math.min(pages - 1, page + delta);

    nums.push(1);
    if (left > 2) nums.push("...");
    for (let i = left; i <= right; i++) nums.push(i);
    if (right < pages - 1) nums.push("...");
    if (pages > 1) nums.push(pages);
    return nums;
  };

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </main>
      </div>
    );
  }

  const ratingSummary = reviews.length
    ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1)
    : "—";
  const negativeCount = reviews.filter((r) => r.isNegative).length;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Отзывы</h1>
              <p className="text-gray-500 mt-1">
                Всего {total}{" "}
                {total === 1
                  ? "отзыв"
                  : total < 5
                  ? "отзыва"
                  : "отзывов"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="text-gray-500"
                >
                  <X className="w-4 h-4 mr-1" />
                  Сбросить
                </Button>
              )}
              <Button
                variant={filtersOpen ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="text-gray-500"
              >
                <Filter className="w-4 h-4 mr-1" />
                Фильтры
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{total}</p>
                  <p className="text-sm text-gray-500">Всего отзывов</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-50 rounded-lg">
                  <Star className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{ratingSummary}</p>
                  <p className="text-sm text-gray-500">Ср. рейтинг (стр.)</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{negativeCount}</p>
                  <p className="text-sm text-gray-500">Жалоб (стр.)</p>
                </div>
              </div>
            </Card>
          </div>

          {filtersOpen && (
            <Card>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Поиск (коммент, имя)..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <select
                  value={filterEstablishment}
                  onChange={handleFilterChange(setFilterEstablishment)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Все заведения</option>
                  {establishments.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filterNegative}
                  onChange={handleFilterChange(setFilterNegative)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Все типы</option>
                  <option value="true">Жалобы (1-3★)</option>
                  <option value="false">Позитив (4-5★)</option>
                </select>

                <select
                  value={filterRating}
                  onChange={handleFilterChange(setFilterRating)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Любой рейтинг</option>
                  <option value="5">5 ★</option>
                  <option value="4">4 ★</option>
                  <option value="3">3 ★</option>
                  <option value="2">2 ★</option>
                  <option value="1">1 ★</option>
                </select>

                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={handleFilterChange(setDateFrom)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={handleFilterChange(setDateTo)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            </Card>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : (
            <>
              <Card padding="sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                          Рейтинг
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                          Тип
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                          Комментарий
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                          Заведение
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                          QR
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                          Гость
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                          Дата
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviews.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-gray-50 hover:bg-gray-50/50"
                        >
                          <td className="px-4 py-3">
                            <RatingStars rating={r.rating} />
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={r.isNegative ? "danger" : "success"}
                            >
                              {r.isNegative ? "Жалоба" : "Позитив"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {r.comment ? (
                              <p className="text-sm text-gray-700 max-w-xs truncate">
                                {r.comment}
                              </p>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-900">
                              {r.establishment.name}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {r.qrCode ? (
                              <span className="text-sm text-gray-600">
                                {r.qrCode.label || r.qrCode.code}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {r.guestName ? (
                              <span className="text-sm text-gray-700">
                                {r.guestName}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-gray-600">
                              {new Date(r.createdAt).toLocaleDateString("ru-RU")}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(r.createdAt).toLocaleTimeString("ru-RU", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </td>
                        </tr>
                      ))}
                      {reviews.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-12 text-center text-gray-400"
                          >
                            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            Отзывов не найдено
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {pages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Показано {(page - 1) * 20 + 1}–
                    {Math.min(page * 20, total)} из {total}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                      className="text-gray-400 px-2"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="text-gray-400 px-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    {getPageNumbers().map((p, i) =>
                      typeof p === "string" ? (
                        <span
                          key={`dots-${i}`}
                          className="px-1 text-gray-300 text-sm"
                        >
                          ...
                        </span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`px-2.5 py-1 rounded text-sm ${
                            p === page
                              ? "bg-indigo-50 text-indigo-700 font-medium"
                              : "text-gray-500 hover:bg-gray-100"
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(pages, p + 1))}
                      disabled={page === pages}
                      className="text-gray-400 px-2"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage(pages)}
                      disabled={page === pages}
                      className="text-gray-400 px-2"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
