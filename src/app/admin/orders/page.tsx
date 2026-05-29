"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  ShoppingBag,
  Search,
  X,
  Calendar,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  XCircle,
  CheckCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Store,
} from "lucide-react";
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
} from "recharts";

interface OrderItem {
  name: string;
  price: string | null;
  qty: number;
}

interface Order {
  id: string;
  items: OrderItem[];
  total: number | null;
  totalText: string | null;
  guestName: string;
  tableNumber: string | null;
  guestPhone: string | null;
  guestEmail: string | null;
  guestAddress: string | null;
  comment: string | null;
  guestIp: string | null;
  guestRegion: string | null;
  guestBrowser: string | null;
  guestDevice: string | null;
  status: "NEW" | "ACCEPTED" | "COMPLETED" | "CANCELLED";
  createdAt: string;
  establishment: {
    id: string;
    name: string;
    user: { id: string; email: string; name: string | null };
  };
  qrCode: { id: string; code: string; label: string | null } | null;
}

interface OrderStats {
  totalOrders: number;
  newOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  recentOrders: number;
  totalRevenue: number;
  chartData: { date: string; count: number; revenue: number }[];
  topEstablishments: { establishmentId: string; name: string; orderCount: number; revenue: number }[];
}

interface EstablishmentOption {
  id: string;
  name: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  NEW: { label: "Новый", color: "bg-blue-500/10 text-blue-400", icon: Clock },
  ACCEPTED: { label: "Принят", color: "bg-amber-500/10 text-amber-400", icon: ArrowRight },
  COMPLETED: { label: "Выполнен", color: "bg-green-500/10 text-green-400", icon: CheckCircle },
  CANCELLED: { label: "Отменён", color: "bg-red-500/10 text-red-400", icon: XCircle },
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function fmtDateAxis(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

function formatRevenue(v: number) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(Math.round(v));
}

export default function AdminOrdersPage() {
  const { status } = useSession();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [establishments, setEstablishments] = useState<EstablishmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterEstablishment, setFilterEstablishment] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/admin/establishments/list")
        .then((r) => r.json())
        .then((data) => setEstablishments(data.establishments || []))
        .catch(() => {});
      fetch("/api/admin/orders?stats=true")
        .then((r) => r.json())
        .then((data) => setOrderStats(data.stats || null))
        .catch(() => {});
    }
  }, [status]);

  const fetchOrders = useCallback(() => {
    if (status !== "authenticated") return;
    setLoading(true);

    const params = new URLSearchParams({ page: String(page) });
    if (filterStatus) params.set("status", filterStatus);
    if (filterEstablishment) params.set("establishmentId", filterEstablishment);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (search.trim()) params.set("search", search.trim());

    fetch(`/api/admin/orders?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setOrders(data.orders || []);
        setPages(data.pages || 1);
        setTotal(data.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, page, filterStatus, filterEstablishment, dateFrom, dateTo, search]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/admin/login");
    if (status !== "authenticated") return;
    queueMicrotask(() => fetchOrders());
  }, [fetchOrders, status, router]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setUpdating(true);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus as Order["status"] } : o))
        );
        if (selectedOrder?.id === orderId) {
          setSelectedOrder((prev) => (prev ? { ...prev, status: newStatus as Order["status"] } : null));
        }
      }
    } finally {
      setUpdating(false);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setFilterStatus("");
    setFilterEstablishment("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const hasActiveFilters = search || filterStatus || filterEstablishment || dateFrom || dateTo;

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
          <h1 className="text-2xl font-bold text-white">Заказы из меню</h1>
          <p className="text-gray-400 mt-1">
            {total} {total === 1 ? "заказ" : total < 5 ? "заказа" : "заказов"}
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

      {orderStats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-gray-500">Всего заказов</span>
              </div>
              <p className="text-xl font-bold text-white">{orderStats.totalOrders}</p>
              <p className="text-xs text-gray-600 mt-0.5">+{orderStats.recentOrders} за 30 д.</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                <span className="text-xs text-gray-500">Выручка (30 д.)</span>
              </div>
              <p className="text-xl font-bold text-white">{orderStats.totalRevenue.toLocaleString("ru-RU")} ₽</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-500">Новых</span>
              </div>
              <p className="text-xl font-bold text-white">{orderStats.newOrders}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-gray-500">Выполнено</span>
              </div>
              <p className="text-xl font-bold text-white">{orderStats.completedOrders}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-4">Заказы за 30 дней</h3>
              {orderStats.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={orderStats.chartData}>
                    <defs>
                      <linearGradient id="gradOrders" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" tickFormatter={fmtDateAxis} tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8, color: "#fff" }}
                      labelFormatter={(label) => fmtDate(String(label))}
                    />
                    <Area type="monotone" dataKey="count" stroke="#f59e0b" fill="url(#gradOrders)" strokeWidth={2} name="Заказы" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-600 text-sm text-center py-10">Нет данных</p>
              )}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-4">Топ заведений (30 д.)</h3>
              {orderStats.topEstablishments.length > 0 ? (
                <div className="space-y-3">
                  {orderStats.topEstablishments.map((est, i) => (
                    <div key={est.establishmentId} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-600 w-5">{i + 1}</span>
                        <div className="flex items-center gap-2">
                          <Store className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-sm text-white truncate max-w-[180px]">{est.name}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-amber-400">{est.orderCount} заказов</span>
                        {est.revenue > 0 && (
                          <p className="text-xs text-gray-600">{est.revenue.toLocaleString("ru-RU")} ₽</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-sm text-center py-10">Нет данных</p>
              )}
            </div>
          </div>

          {orderStats.chartData.length > 0 && orderStats.chartData.some((d) => d.revenue > 0) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-4">Выручка за 30 дней (₽)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={orderStats.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" tickFormatter={fmtDateAxis} tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={formatRevenue} tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8, color: "#fff" }}
                    labelFormatter={(label) => fmtDate(String(label))}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [`${Number(value).toLocaleString("ru-RU")} ₽`, "Выручка"]}
                  />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} name="Выручка" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {filtersOpen && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Поиск (имя, телефон, email)..."
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
              value={filterStatus}
              onChange={handleFilterChange(setFilterStatus)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Все статусы</option>
              <option value="NEW">Новый</option>
              <option value="ACCEPTED">Принят</option>
              <option value="COMPLETED">Выполнен</option>
              <option value="CANCELLED">Отменён</option>
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
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Статус</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Гость</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Позиции</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Сумма</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Заведение</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">QR</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Дата</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const statusCfg = STATUS_MAP[o.status];
                    const itemsList = o.items as OrderItem[];
                    return (
                      <tr key={o.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="px-4 py-3">
                          <Badge className={statusCfg.color}>
                            {statusCfg.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-white">{o.guestName}</p>
                          {o.tableNumber && <p className="text-xs text-gray-500">Стол: {o.tableNumber}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-300">
                            {itemsList.length} {itemsList.length === 1 ? "поз." : "поз."}
                          </p>
                          <p className="text-xs text-gray-600 truncate max-w-[160px]">
                            {itemsList.map((it) => it.name).join(", ")}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {o.totalText ? (
                            <p className="text-sm font-medium text-white">{o.totalText}</p>
                          ) : (
                            <span className="text-sm text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-white">{o.establishment.name}</p>
                          <p className="text-xs text-gray-500">{o.establishment.user.name || o.establishment.user.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          {o.qrCode ? (
                            <span className="text-sm text-gray-300">{o.qrCode.label || o.qrCode.code}</span>
                          ) : (
                            <span className="text-sm text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-400">
                            {new Date(o.createdAt).toLocaleDateString("ru-RU")}
                          </p>
                          <p className="text-xs text-gray-600">
                            {new Date(o.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedOrder(o)}
                            className="text-gray-400 hover:text-white"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                        <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        Заказов не найдено
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
                <Button variant="ghost" size="sm" onClick={() => setPage(1)} disabled={page === 1} className="text-gray-400 px-2">
                  <ChevronsLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-gray-400 px-2">
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
                        p === page ? "bg-amber-500/20 text-amber-400 font-medium" : "text-gray-400 hover:bg-gray-800"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
                <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="text-gray-400 px-2">
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPage(pages)} disabled={page === pages} className="text-gray-400 px-2">
                  <ChevronsRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}>
          <div
            className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">Заказ</h2>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={STATUS_MAP[selectedOrder.status].color}>
                    {STATUS_MAP[selectedOrder.status].label}
                  </Badge>
                  <span className="text-xs text-gray-600">
                    {new Date(selectedOrder.createdAt).toLocaleString("ru-RU")}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {selectedOrder.status !== "COMPLETED" && selectedOrder.status !== "CANCELLED" && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={updating}
                        onClick={() => handleStatusChange(selectedOrder.id, "ACCEPTED")}
                        className="text-amber-400 text-xs"
                      >
                        Принять
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={updating}
                        onClick={() => handleStatusChange(selectedOrder.id, "COMPLETED")}
                        className="text-green-400 text-xs"
                      >
                        Выполнен
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={updating}
                        onClick={() => handleStatusChange(selectedOrder.id, "CANCELLED")}
                        className="text-red-400 text-xs"
                      >
                        Отменить
                      </Button>
                    </>
                  )}
                  {selectedOrder.status === "CANCELLED" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={updating}
                      onClick={() => handleStatusChange(selectedOrder.id, "NEW")}
                      className="text-blue-400 text-xs"
                    >
                      Восстановить
                    </Button>
                  )}
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Заведение</span>
                  <span className="text-sm text-white">{selectedOrder.establishment.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Владелец</span>
                  <span className="text-sm text-gray-300">{selectedOrder.establishment.user.name || selectedOrder.establishment.user.email}</span>
                </div>
                {selectedOrder.qrCode && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">QR</span>
                    <span className="text-sm text-gray-300">{selectedOrder.qrCode.label || selectedOrder.qrCode.code}</span>
                  </div>
                )}
              </div>

              <div className="bg-gray-800/50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-medium text-gray-400 mb-1">Гость</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Имя</span>
                  <span className="text-sm text-white">{selectedOrder.guestName}</span>
                </div>
                {selectedOrder.tableNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Стол</span>
                    <span className="text-sm text-white">{selectedOrder.tableNumber}</span>
                  </div>
                )}
                {selectedOrder.guestPhone && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Телефон</span>
                    <span className="text-sm text-white">{selectedOrder.guestPhone}</span>
                  </div>
                )}
                {selectedOrder.guestEmail && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Email</span>
                    <span className="text-sm text-white">{selectedOrder.guestEmail}</span>
                  </div>
                )}
                {selectedOrder.guestAddress && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Адрес</span>
                    <span className="text-sm text-white">{selectedOrder.guestAddress}</span>
                  </div>
                )}
              </div>

              <div className="bg-gray-800/50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-medium text-gray-400">Состав заказа</p>
                {(selectedOrder.items as OrderItem[]).map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-white">
                      {item.name} <span className="text-gray-500">×{item.qty}</span>
                    </span>
                    {item.price && <span className="text-sm text-gray-300">{item.price}</span>}
                  </div>
                ))}
                {selectedOrder.totalText && (
                  <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                    <span className="text-sm font-medium text-gray-400">Итого</span>
                    <span className="text-sm font-bold text-amber-400">{selectedOrder.totalText}</span>
                  </div>
                )}
              </div>

              {selectedOrder.comment && (
                <div className="bg-gray-800/50 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-400 mb-1">Комментарий</p>
                  <p className="text-sm text-white">{selectedOrder.comment}</p>
                </div>
              )}

              <div className="bg-gray-800/50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-medium text-gray-400 mb-1">Тех. информация</p>
                {selectedOrder.guestIp && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">IP</span>
                    <span className="text-xs text-gray-400">{selectedOrder.guestIp}</span>
                  </div>
                )}
                {selectedOrder.guestRegion && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Регион</span>
                    <span className="text-xs text-gray-400">{selectedOrder.guestRegion}</span>
                  </div>
                )}
                {selectedOrder.guestBrowser && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Браузер</span>
                    <span className="text-xs text-gray-400">{selectedOrder.guestBrowser}</span>
                  </div>
                )}
                {selectedOrder.guestDevice && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Устройство</span>
                    <span className="text-xs text-gray-400">{selectedOrder.guestDevice}</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-600 text-center">
                ID: {selectedOrder.id}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
