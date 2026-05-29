"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import {
  Users,
  Search,
  Loader2,
  Eye,
  Edit,
  ChevronLeft,
  ChevronRight,
  Crown,
  Shield,
  X,
  ExternalLink,
  Building2,
  QrCode,
  Star,
} from "lucide-react";

interface UserEstablishment {
  id: string;
  name: string;
  _count: { reviews: number; qrcodes: number };
}

interface UserSubscription {
  id: string;
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  createdAt: string;
  establishmentsCount: number;
  establishments: UserEstablishment[];
  subscription: UserSubscription | null;
}

export default function AdminUsersPage() {
  const { status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [editModal, setEditModal] = useState<AdminUser | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [viewModal, setViewModal] = useState<AdminUser | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/admin/login");
    if (status !== "authenticated") return;

    const params = new URLSearchParams({ page: String(page), search });
    fetch(`/api/admin/users?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users || []);
        setPages(data.pages || 1);
        setTotal(data.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, router, page, search]);


  const handleSaveEdit = async () => {
    if (!editModal) return;
    setEditLoading(true);
    try {
      const body: Record<string, string> = {};
      if (editModal.role) body.role = editModal.role;
      if (editModal.subscription?.plan) {
        body.subscriptionPlan = editModal.subscription.plan;
        body.subscriptionStatus = editModal.subscription.status;
      }

      await fetch(`/api/admin/users/${editModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setEditModal(null);
      const params = new URLSearchParams({ page: String(page), search });
      const refreshRes = await fetch(`/api/admin/users?${params}`);
      const refreshData = await refreshRes.json();
      setUsers(refreshData.users || []);
      setPages(refreshData.pages || 1);
      setTotal(refreshData.total || 0);
    } finally {
      setEditLoading(false);
    }
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
              <h1 className="text-2xl font-bold text-white">Пользователи</h1>
              <p className="text-gray-400 mt-1">{total} всего</p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Поиск по email или имени..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
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
                        Роль
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                        Тариф
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                        Заведения
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                        Регистрация
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr
                        key={u.id}
                        className="border-b border-gray-800/50 hover:bg-gray-800/30"
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {u.name || "Без имени"}
                            </p>
                            <p className="text-xs text-gray-500">{u.email}</p>
                            {u.phone && (
                              <p className="text-xs text-gray-600">{u.phone}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {u.role === "ADMIN" ? (
                            <Badge
                              variant="warning"
                              className="bg-amber-500/10 text-amber-400"
                            >
                              <Shield className="w-3 h-3 mr-1" />
                              ADMIN
                            </Badge>
                          ) : (
                            <Badge
                              variant="default"
                              className="bg-gray-700 text-gray-300"
                            >
                              OWNER
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {u.subscription?.plan === "PRO" ||
                          u.subscription?.plan === "NETWORK" ? (
                            <div>
                              <Badge
                                variant="success"
                                className="bg-green-500/10 text-green-400"
                              >
                                <Crown className="w-3 h-3 mr-1" />
                                {u.subscription.plan === "NETWORK"
                                  ? "Сеть"
                                  : "PRO"}
                              </Badge>
                              {u.subscription.currentPeriodEnd && (
                                <p className="text-[10px] text-gray-600 mt-1">
                                  до{" "}
                                  {new Date(
                                    u.subscription.currentPeriodEnd
                                  ).toLocaleDateString("ru-RU")}
                                </p>
                              )}
                            </div>
                          ) : (
                            <Badge
                              variant="default"
                              className="bg-gray-700 text-gray-400"
                            >
                              FREE
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-300">
                            {u.establishmentsCount}
                          </span>
                          {u.establishments.length > 0 && (
                            <div className="mt-1">
                              {u.establishments.slice(0, 2).map((e) => (
                                <p
                                  key={e.id}
                                  className="text-[10px] text-gray-500 truncate max-w-[150px]"
                                >
                                  {e.name} ({e._count.reviews} отз.)
                                </p>
                              ))}
                              {u.establishments.length > 2 && (
                                <p className="text-[10px] text-gray-600">
                                  +ещё {u.establishments.length - 2}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-500">
                            {new Date(u.createdAt).toLocaleDateString("ru-RU")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setViewModal(u)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-gray-800 transition-colors"
                              title="Просмотр профиля"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditModal(u)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                              title="Редактировать"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-12 text-center text-gray-500"
                        >
                          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          Пользователи не найдены
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
                    className="text-gray-400 hover:text-white"
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
                    className="text-gray-400 hover:text-white"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}

          {viewModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">
                {viewModal.name || "Без имени"}
              </h2>
              <button onClick={() => setViewModal(null)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Email</p>
                  <p className="text-white break-all">{viewModal.email}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Телефон</p>
                  <p className="text-white">{viewModal.phone || "—"}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Роль</p>
                  <p className="text-white">{viewModal.role}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Тариф</p>
                  <p
                    className={
                      viewModal.subscription?.plan === "PRO" ||
                      viewModal.subscription?.plan === "NETWORK"
                        ? "text-amber-400 font-semibold"
                        : "text-white"
                    }
                  >
                    {viewModal.subscription?.plan === "NETWORK"
                      ? "Сеть"
                      : viewModal.subscription?.plan || "FREE"}
                    {viewModal.subscription?.status === "ACTIVE" &&
                      (viewModal.subscription.plan === "PRO" ||
                        viewModal.subscription.plan === "NETWORK") &&
                      " ✓"}
                  </p>
                </div>
              </div>

              {viewModal.establishments.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> Заведения
                  </p>
                  <div className="space-y-2">
                    {viewModal.establishments.map((e) => (
                      <div key={e.id} className="bg-gray-800 rounded-lg px-3 py-2 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-white">{e.name}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-0.5"><QrCode className="w-3 h-3" />{e._count.qrcodes} QR</span>
                            <span className="flex items-center gap-0.5"><Star className="w-3 h-3" />{e._count.reviews} отз.</span>
                          </p>
                        </div>
                        <a
                          href={`/dashboard`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-500 hover:text-amber-400"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-gray-800">
                <p className="text-xs text-gray-500">
                  Зарегистрирован: {new Date(viewModal.createdAt).toLocaleDateString("ru-RU")}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setViewModal(null); setEditModal(viewModal); }} className="text-gray-400">
                    <Edit className="w-3.5 h-3.5 mr-1" />
                    Редактировать
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setViewModal(null)} className="text-gray-400">
                    Закрыть
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md">
                <h2 className="text-lg font-semibold text-white mb-4">
                  Редактировать пользователя
                </h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Email</p>
                    <p className="text-sm text-white">{editModal.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Роль
                    </label>
                    <select
                      value={editModal.role}
                      onChange={(e) =>
                        setEditModal({ ...editModal, role: e.target.value })
                      }
                      className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="OWNER">OWNER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Тариф
                    </label>
                    <select
                      value={editModal.subscription?.plan || "FREE"}
                      onChange={(e) =>
                        setEditModal({
                          ...editModal,
                          subscription: editModal.subscription
                            ? { ...editModal.subscription, plan: e.target.value }
                            : {
                                id: "",
                                plan: e.target.value,
                                status: "ACTIVE",
                                currentPeriodEnd: null,
                              },
                        })
                      }
                      className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="FREE">FREE</option>
                      <option value="PRO">PRO</option>
                      <option value="NETWORK">Сеть</option>
                    </select>
                  </div>
                  {(editModal.subscription?.plan === "PRO" ||
                    editModal.subscription?.plan === "NETWORK") && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">
                        Статус подписки
                      </label>
                      <select
                        value={editModal.subscription.status}
                        onChange={(e) =>
                          setEditModal({
                            ...editModal,
                            subscription: editModal.subscription
                              ? {
                                  ...editModal.subscription,
                                  status: e.target.value,
                                }
                              : null,
                          })
                        }
                        className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="PAST_DUE">PAST_DUE</option>
                        <option value="CANCELED">CANCELED</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditModal(null)}
                    className="text-gray-400"
                  >
                    Отмена
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={editLoading}
                    className="bg-amber-500 text-gray-900 hover:bg-amber-400"
                  >
                    {editLoading ? "Сохраняем..." : "Сохранить"}
                  </Button>
                </div>
              </div>
        </div>
      )}
    </div>
  );
}
