"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import {
  Star,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  MessageSquare,
  Search,
  X,
  Calendar,
  ChevronsLeft,
  ChevronsRight,
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
  establishment: {
    id: string;
    name: string;
    user: { id: string; email: string; name: string | null };
  };
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
          className={`w-3.5 h-3.5 ${
            i <= rating
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-700"
          }`}
        />
      ))}
    </div>
  );
}

export default function AdminReviewsPage() {
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
      fetch("/api/admin/establishments/list")
        .then((r) => r.json())
        .then((data) => setEstablishments(data.establishments || []))
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

    fetch(`/api/admin/reviews?${params}`)
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
    if (status === "unauthenticated") router.push("/admin/login");
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

  const handleFilterChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
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
      <div className="flex min-h-screen bg-gray-950 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Отзывы</h1>
          <p className="text-gray-400 mt-1">
            {total} {total === 1 ? "отзыв" : total < 5 ? "отзыва" : "отзывов"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-gray-400">
              <X className="w-4 h-4 mr-1" />
              Сбросить
            </Button>
          )}
          <Button
            variant={filtersOpen ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="text-gray-400"
          >
            <Filter className="w-4 h-4 mr-1" />
            Фильтры
          </Button>
        </div>
      </div>

      {filtersOpen && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Поиск (коммент, имя, телефон)..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <select
              value={filterEstablishment}
              onChange={handleFilterChange(setFilterEstablishment)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Все заведения</option>
              {establishments.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>

            <select
              value={filterNegative}
              onChange={handleFilterChange(setFilterNegative)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Все типы</option>
              <option value="true">Жалобы (1-3★)</option>
              <option value="false">Позитив (4-5★)</option>
            </select>

            <select
              value={filterRating}
              onChange={handleFilterChange(setFilterRating)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Любой рейтинг</option>
              <option value="5">5 ★</option>
              <option value="4">4 ★</option>
              <option value="3">3 ★</option>
              <option value="2">2 ★</option>
              <option value="1">1 ★</option>
            </select>

            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="date"
                value={dateFrom}
                onChange={handleFilterChange(setDateFrom)}
                className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="date"
                value={dateTo}
                onChange={handleFilterChange(setDateTo)}
                className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Дата до"
              />
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        </div>
      ) : (
        <>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Рейтинг</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Тип</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Комментарий</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Заведение</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">QR</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Гость</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => (
                    <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-4 py-3">
                        <RatingStars rating={r.rating} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            className={
                              r.isNegative
                                ? "bg-red-500/10 text-red-400"
                                : "bg-green-500/10 text-green-400"
                            }
                          >
                            {r.isNegative ? "Жалоба" : "Позитив"}
                          </Badge>
                          {!r.isProcessed && r.isNegative && (
                            <Badge className="bg-orange-500/10 text-orange-400">
                              Новый
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.comment ? (
                          <p className="text-sm text-gray-300 max-w-xs truncate">{r.comment}</p>
                        ) : (
                          <span className="text-sm text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-white">{r.establishment.name}</p>
                        <p className="text-xs text-gray-500">{r.establishment.user.name || r.establishment.user.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        {r.qrCode ? (
                          <span className="text-sm text-gray-300">{r.qrCode.label || r.qrCode.code}</span>
                        ) : (
                          <span className="text-sm text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.guestName ? (
                          <p className="text-sm text-gray-300">{r.guestName}</p>
                        ) : (
                          <span className="text-sm text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-400">
                          {new Date(r.createdAt).toLocaleDateString("ru-RU")}
                        </p>
                        <p className="text-xs text-gray-600">
                          {new Date(r.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </td>
                    </tr>
                  ))}
                  {reviews.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        Отзывов не найдено
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Показано {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} из {total}
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
                    <span key={`dots-${i}`} className="px-1 text-gray-600 text-sm">...</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-2.5 py-1 rounded text-sm ${
                        p === page
                          ? "bg-amber-500/20 text-amber-400 font-medium"
                          : "text-gray-400 hover:bg-gray-800"
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
  );
}
