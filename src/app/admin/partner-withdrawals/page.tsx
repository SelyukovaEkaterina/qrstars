"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import {
  Wallet,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  Banknote,
  Filter,
  X,
} from "lucide-react";

interface Withdrawal {
  id: string;
  amount: number;
  status: string;
  recepientName: string;
  recepientInn: string;
  recepientType: string;
  bankName: string | null;
  bankBik: string | null;
  bankAccount: string | null;
  corrAccount: string | null;
  comment: string | null;
  adminComment: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  PENDING:  { label: "Ожидает",  color: "bg-yellow-500/10 text-yellow-400", icon: Clock },
  APPROVED: { label: "Одобрена", color: "bg-blue-500/10 text-blue-400",    icon: CheckCircle },
  REJECTED: { label: "Отклонена",color: "bg-red-500/10 text-red-400",      icon: XCircle },
  PAID:     { label: "Выплачено",color: "bg-green-500/10 text-green-400",  icon: Banknote },
};

export default function AdminPartnerWithdrawalsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");

  const [actionModal, setActionModal] = useState<{ w: Withdrawal; newStatus: string } | null>(null);
  const [adminComment, setAdminComment] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/admin/partner-withdrawals?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setWithdrawals(d.withdrawals || []);
        setPages(d.pages || 1);
        setTotal(d.total || 0);
        setPendingCount(d.pendingCount || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status, page, statusFilter]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/admin/login");
    if (status !== "authenticated") return;
    fetchData();
  }, [fetchData, status, router]);

  const openAction = (w: Withdrawal, newStatus: string) => {
    setActionModal({ w, newStatus });
    setAdminComment(w.adminComment || "");
  };

  const handleSave = async () => {
    if (!actionModal) return;
    setSaving(true);
    try {
      await fetch("/api/admin/partner-withdrawals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: actionModal.w.id, status: actionModal.newStatus, adminComment }),
      });
      setActionModal(null);
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  if (status !== "authenticated") {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-amber-400" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-amber-400" />
            Заявки на вывод
          </h1>
          <p className="text-gray-400 mt-1">{total} всего{pendingCount > 0 && <span className="ml-2 text-yellow-400 font-medium">· {pendingCount} ожидают</span>}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">Все статусы</option>
            <option value="PENDING">Ожидают</option>
            <option value="APPROVED">Одобрены</option>
            <option value="REJECTED">Отклонены</option>
            <option value="PAID">Выплачены</option>
          </select>
          {statusFilter && (
            <Button variant="ghost" size="sm" onClick={() => setStatusFilter("")} className="text-gray-400">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-5 py-3 flex items-center gap-3">
          <Clock className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-yellow-300">
            <span className="font-semibold">{pendingCount} заявок</span> ожидают обработки. Рассмотрите и выполните или отклоните их.
          </p>
          <button
            onClick={() => { setStatusFilter("PENDING"); setPage(1); }}
            className="ml-auto text-xs text-yellow-400 hover:text-yellow-300 font-medium underline"
          >
            Показать только ожидающие
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-amber-400" /></div>
      ) : (
        <>
          <div className="space-y-3">
            {withdrawals.map((w) => {
              const sc = STATUS_CONFIG[w.status] || STATUS_CONFIG.PENDING;
              const Icon = sc.icon;
              return (
                <div key={w.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="text-lg font-bold text-white">{w.amount.toLocaleString("ru-RU")} ₽</p>
                        <Badge className={sc.color}>
                          <Icon className="w-3 h-3 mr-1" />
                          {sc.label}
                        </Badge>
                        <span className="text-xs text-gray-500">{new Date(w.createdAt).toLocaleDateString("ru-RU")}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Партнёр</p>
                          <p className="text-white">{w.user.name || w.user.email}</p>
                          <p className="text-xs text-gray-500">{w.user.email}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Получатель</p>
                          <p className="text-white">{w.recepientName}</p>
                          <p className="text-xs text-gray-500">ИНН: {w.recepientInn} · {w.recepientType === "IP" ? "ИП" : "ООО"}</p>
                        </div>
                        {(w.bankName || w.bankAccount) && (
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Банк</p>
                            <p className="text-white text-xs">{w.bankName}</p>
                            <p className="text-xs text-gray-500 font-mono">{w.bankAccount}</p>
                            {w.bankBik && <p className="text-xs text-gray-500">БИК: {w.bankBik}</p>}
                          </div>
                        )}
                      </div>

                      {w.comment && (
                        <div className="mt-2 bg-gray-800 rounded-lg px-3 py-2">
                          <p className="text-xs text-gray-400">Комментарий партнёра:</p>
                          <p className="text-sm text-gray-300 mt-0.5">{w.comment}</p>
                        </div>
                      )}
                      {w.adminComment && (
                        <div className="mt-2 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                          <p className="text-xs text-amber-400">Ответ администратора:</p>
                          <p className="text-sm text-gray-300 mt-0.5">{w.adminComment}</p>
                        </div>
                      )}
                    </div>

                    {w.status === "PENDING" && (
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          onClick={() => openAction(w, "APPROVED")}
                          className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20"
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                          Одобрить
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openAction(w, "REJECTED")}
                          className="text-red-400 hover:bg-red-500/10"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Отклонить
                        </Button>
                      </div>
                    )}
                    {w.status === "APPROVED" && (
                      <Button
                        size="sm"
                        onClick={() => openAction(w, "PAID")}
                        className="flex-shrink-0 bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20"
                      >
                        <Banknote className="w-3.5 h-3.5 mr-1" />
                        Отметить выплаченным
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {withdrawals.length === 0 && (
              <div className="text-center py-20 text-gray-500">
                <Wallet className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>{statusFilter ? "Заявок с таким статусом нет" : "Заявок на вывод пока нет"}</p>
              </div>
            )}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-gray-400">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-gray-400">{page} / {pages}</span>
              <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="text-gray-400">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {actionModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-1">
              {actionModal.newStatus === "APPROVED" && "Одобрить заявку"}
              {actionModal.newStatus === "REJECTED" && "Отклонить заявку"}
              {actionModal.newStatus === "PAID" && "Отметить как выплаченную"}
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              {actionModal.w.recepientName} · {actionModal.w.amount.toLocaleString("ru-RU")} ₽
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Комментарий администратора (необязательно)
              </label>
              <textarea
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                rows={3}
                placeholder={
                  actionModal.newStatus === "REJECTED"
                    ? "Укажите причину отклонения..."
                    : "Дополнительная информация..."
                }
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="ghost" size="sm" onClick={() => setActionModal(null)} className="text-gray-400">
                Отмена
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className={
                  actionModal.newStatus === "REJECTED"
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    : actionModal.newStatus === "PAID"
                    ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                    : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                }
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Подтвердить"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
