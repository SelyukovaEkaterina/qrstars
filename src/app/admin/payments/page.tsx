"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import {
  CreditCard,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Crown,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";

interface Subscription {
  id: string;
  plan: string;
  status: string;
  invoiceId: number | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
}

const statusConfig: Record<string, { variant: "success" | "warning" | "danger"; label: string; icon: typeof CheckCircle }> = {
  ACTIVE: { variant: "success", label: "Активна", icon: CheckCircle },
  PAST_DUE: { variant: "warning", label: "Просрочена", icon: Clock },
  CANCELED: { variant: "danger", label: "Отменена", icon: XCircle },
};

export default function AdminPaymentsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalActivePro, setTotalActivePro] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/admin/login");
    if (status !== "authenticated") return;

    const params = new URLSearchParams({ page: String(page) });
    fetch(`/api/admin/payments?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setSubscriptions(data.subscriptions || []);
        setPages(data.pages || 1);
        setTotal(data.total || 0);
        setTotalActivePro(data.totalActivePro || 0);
        setTotalRevenue(data.totalRevenue || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, router, page]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen bg-gray-950 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Подписки и платежи</h1>
            <p className="text-gray-400 mt-1">{total} записей</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-sm text-gray-400">Активные PRO</p>
              <p className="text-2xl font-bold text-white mt-1">{totalActivePro}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-sm text-gray-400">Ожидаемый MRR</p>
              <p className="text-2xl font-bold text-white mt-1">
                {totalRevenue.toLocaleString("ru-RU")} ₽
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-sm text-gray-400">Всего подписок</p>
              <p className="text-2xl font-bold text-white mt-1">{total}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            </div>
          ) : (
            <>
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                        Пользователь
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                        Тариф
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                        Статус
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                        Период
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                        Yookassa ID
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                        Создана
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((s) => {
                      const sc = statusConfig[s.status] || statusConfig.ACTIVE;
                      const Icon = sc.icon;
                      return (
                        <tr
                          key={s.id}
                          className="border-b border-gray-800/50 hover:bg-gray-800/30"
                        >
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-white">
                              {s.user.name || "Без имени"}
                            </p>
                            <p className="text-xs text-gray-500">{s.user.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            {s.plan === "PRO" ? (
                              <Badge className="bg-amber-500/10 text-amber-400">
                                <Crown className="w-3 h-3 mr-1" />
                                PRO
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-700 text-gray-400">FREE</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={sc.variant}
                              className={`flex items-center gap-1 w-fit ${
                                s.status === "ACTIVE"
                                  ? "bg-green-500/10 text-green-400"
                                  : s.status === "PAST_DUE"
                                  ? "bg-yellow-500/10 text-yellow-400"
                                  : "bg-red-500/10 text-red-400"
                              }`}
                            >
                              <Icon className="w-3 h-3" />
                              {sc.label}
                            </Badge>
                            {s.cancelAtPeriodEnd && (
                              <p className="text-[10px] text-orange-400 mt-1">
                                Отменена в конце периода
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {s.currentPeriodStart && s.currentPeriodEnd ? (
                              <div>
                                <p className="text-xs text-gray-300">
                                  {new Date(s.currentPeriodStart).toLocaleDateString("ru-RU")}
                                </p>
                                <p className="text-[10px] text-gray-600">—</p>
                                <p className="text-xs text-gray-300">
                                  {new Date(s.currentPeriodEnd).toLocaleDateString("ru-RU")}
                                </p>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-600">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-gray-500 font-mono">
                              {s.invoiceId != null ? `#${s.invoiceId}` : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-gray-500">
                              {new Date(s.createdAt).toLocaleDateString("ru-RU")}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {subscriptions.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-12 text-center text-gray-500"
                        >
                          <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          Подписок пока нет
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {pages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="text-gray-400"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-400">
                    {page} / {pages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    disabled={page === pages}
                    className="text-gray-400"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      );
}
