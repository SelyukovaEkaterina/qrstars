"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import {
  Loader2,
  Inbox,
  Filter,
  Search,
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCheck,
  Eye,
} from "lucide-react";

interface FormOption {
  id: string;
  title: string;
  _count: { submissions: number };
}

interface SubmissionRow {
  id: string;
  values: Record<string, unknown>;
  guestIp: string | null;
  isRead: boolean;
  createdAt: string;
  form: {
    id: string;
    title: string;
    fields: { id: string; label: string }[];
  };
  qrCode?: { id: string; code: string; label: string | null } | null;
}

interface FormSubmissionsPanelProps {
  establishmentId: string;
  forms: { id: string; title: string }[];
  onUnreadChange?: (count: number) => void;
}

function formatValue(val: unknown): string {
  if (val === true) return "Да";
  if (val === false) return "Нет";
  if (val === null || val === "") return "—";
  return String(val);
}

export default function FormSubmissionsPanel({
  establishmentId,
  forms: formsProp,
  onUnreadChange,
}: FormSubmissionsPanelProps) {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [formOptions, setFormOptions] = useState<FormOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterFormId, setFilterFormId] = useState("");
  const [filterUnread, setFilterUnread] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);

  const fetchSubmissions = useCallback(() => {
    if (!establishmentId) return;
    setLoading(true);

    const params = new URLSearchParams({ page: String(page) });
    if (filterFormId) params.set("formId", filterFormId);
    if (filterUnread === "true") params.set("unread", "true");
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (search.trim()) params.set("search", search.trim());

    fetch(`/api/establishments/${establishmentId}/form-submissions?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setSubmissions(data.submissions || []);
        setTotal(data.total || 0);
        setUnreadCount(data.unreadCount || 0);
        setPages(data.pages || 1);
        if (data.forms?.length) setFormOptions(data.forms);
        const unread = data.unreadCount || 0;
        onUnreadChange?.(unread);
        window.dispatchEvent(
          new CustomEvent("submissions-unread-changed", { detail: unread })
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [establishmentId, page, filterFormId, filterUnread, dateFrom, dateTo, search]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const markRead = async (ids: string[]) => {
    await fetch(`/api/establishments/${establishmentId}/form-submissions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionIds: ids }),
    });
    fetchSubmissions();
  };

  const markAllRead = async () => {
    await fetch(`/api/establishments/${establishmentId}/form-submissions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    fetchSubmissions();
  };

  const resetFilters = () => {
    setSearch("");
    setFilterFormId("");
    setFilterUnread("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const hasActiveFilters =
    search || filterFormId || filterUnread || dateFrom || dateTo;

  const handleFilterChange =
    (setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      setter(e.target.value);
      setPage(1);
    };

  const formsForFilter =
    formOptions.length > 0
      ? formOptions
      : formsProp.map((f) => ({ id: f.id, title: f.title, _count: { submissions: 0 } }));

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

  if (!formsForFilter.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Inbox className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="font-medium text-gray-700">Заявок пока нет</p>
        <p className="text-sm mt-1">
          Добавьте блок «Форма» в{" "}
          <a href="/dashboard/my-page" className="text-indigo-600 hover:underline">
            Моя страница
          </a>{" "}
          — сюда будут попадать ответы гостей.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Заявки из форм</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Всего {total}
            {unreadCount > 0 && (
              <span className="ml-2 text-indigo-600 font-medium">
                · {unreadCount} непрочитанных
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="w-4 h-4 mr-1" />
              Прочитать все
            </Button>
          )}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-gray-500">
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

      {filtersOpen && (
        <Card padding="sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск (форма, QR, IP)..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={filterFormId}
              onChange={handleFilterChange(setFilterFormId)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Все формы</option>
              {formsForFilter.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                  {f._count.submissions > 0 ? ` (${f._count.submissions})` : ""}
                </option>
              ))}
            </select>

            <select
              value={filterUnread}
              onChange={handleFilterChange(setFilterUnread)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Все заявки</option>
              <option value="true">Только непрочитанные</option>
            </select>

            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={handleFilterChange(setDateFrom)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={dateTo}
                onChange={handleFilterChange(setDateTo)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-12 text-gray-500 border border-dashed border-gray-200 rounded-lg">
          <Inbox className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p>Заявок не найдено</p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm text-indigo-600 hover:underline mt-2"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {submissions.map((s) => {
              const fieldLabels = new Map(s.form.fields.map((f) => [f.id, f.label]));
              const expanded = expandedId === s.id;
              const previewEntries = Object.entries(s.values).slice(0, 2);

              return (
                <div
                  key={s.id}
                  className={`border rounded-lg transition-colors ${
                    s.isRead
                      ? "border-gray-200 bg-white"
                      : "border-indigo-200 bg-indigo-50/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedId(expanded ? null : s.id);
                      if (!s.isRead) markRead([s.id]);
                    }}
                    className="w-full text-left p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium text-gray-900">{s.form.title}</span>
                          {!s.isRead && (
                            <Badge variant="default" className="text-xs">
                              Новая
                            </Badge>
                          )}
                        </div>
                        {!expanded && previewEntries.length > 0 && (
                          <p className="text-sm text-gray-600 truncate">
                            {previewEntries
                              .map(([fid, val]) => {
                                const label = fieldLabels.get(fid) ?? fid;
                                return `${label}: ${formatValue(val)}`;
                              })
                              .join(" · ")}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(s.createdAt).toLocaleString("ru-RU")}
                          {s.qrCode && ` · QR: ${s.qrCode.label || s.qrCode.code}`}
                          {s.guestIp && ` · ${s.guestIp}`}
                        </p>
                      </div>
                      <Eye className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
                    </div>
                  </button>

                  {expanded && (
                    <div className="px-3 pb-3 border-t border-gray-100 pt-2">
                      <dl className="text-sm space-y-1">
                        {Object.entries(s.values).map(([fid, val]) => (
                          <div key={fid} className="flex gap-2">
                            <dt className="text-gray-500 min-w-[100px] shrink-0">
                              {fieldLabels.get(fid) ?? fid}:
                            </dt>
                            <dd className="text-gray-900 flex-1 break-words">
                              {formatValue(val)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2">
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {getPageNumbers().map((n, i) =>
                typeof n === "number" ? (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`min-w-[36px] h-9 rounded-lg text-sm font-medium ${
                      page === n
                        ? "bg-indigo-600 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {n}
                  </button>
                ) : (
                  <span key={i} className="px-1 text-gray-400">
                    …
                  </span>
                )
              )}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage(pages)}
                disabled={page === pages}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
