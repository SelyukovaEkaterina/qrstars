"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import {
  Package,
  Loader2,
  Plus,
  ChevronDown,
  ChevronUp,
  Printer,
} from "lucide-react";

interface BatchQRCode {
  id: string;
  code: string;
  serialCode: string | null;
  isActive: boolean;
}

interface Batch {
  id: string;
  masterCode: string;
  status: "PENDING" | "ACTIVATED";
  label: string | null;
  qty: number;
  activatedAt: string | null;
  createdAt: string;
  qrcodes: BatchQRCode[];
  user: { id: string; email: string; name: string | null } | null;
  establishment: { id: string; name: string } | null;
}

export default function AdminBatchesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createQty, setCreateQty] = useState(5);
  const [createLabel, setCreateLabel] = useState("");
  const [createdResult, setCreatedResult] = useState<{
    masterCode: string;
    qrcodes: BatchQRCode[];
  } | null>(null);

  const fetchBatches = async () => {
    try {
      const res = await fetch("/api/admin/batches");
      const data = await res.json();
      setBatches(data.batches || []);
    } catch {
      setError("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/admin/login");
    if (status !== "authenticated") return;
    fetchBatches();
  }, [status, router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    setCreatedResult(null);

    try {
      const res = await fetch("/api/admin/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qty: createQty, label: createLabel || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка");
        return;
      }
      setCreatedResult({
        masterCode: data.batch.masterCode,
        qrcodes: data.qrcodes,
      });
      setShowCreate(false);
      setCreateLabel("");
      setCreateQty(5);
      await fetchBatches();
    } catch {
      setError("Ошибка создания");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-amber-400" />
            Наборы табличек
          </h1>
          <p className="text-gray-400 mt-1">Управление наборами для маркетплейсов</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-2" />
          Создать набор
        </Button>
      </div>

      {error && (
        <div className="bg-red-900/50 text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {createdResult && (
        <div className="bg-green-900/50 border border-green-700 rounded-xl p-6 space-y-4">
          <h3 className="text-green-300 font-semibold text-lg">Набор создан!</h3>
          <div>
            <p className="text-sm text-gray-400">Мастер-код (на упаковку):</p>
            <p className="text-2xl font-mono text-green-300 font-bold tracking-wider">
              {createdResult.masterCode}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-2">Таблички ({createdResult.qrcodes.length} шт.):</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {createdResult.qrcodes.map((qr) => (
                <div key={qr.id} className="bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400">Серийный №</p>
                  <p className="font-mono text-lg text-white">{qr.serialCode}</p>
                  <p className="text-xs text-gray-500 mt-1">QR: {qr.code}</p>
                </div>
              ))}
            </div>
          </div>
          <Button variant="ghost" onClick={() => setCreatedResult(null)} className="text-green-300">
            Закрыть
          </Button>
        </div>
      )}

      {showCreate && (
        <div className="bg-gray-800 rounded-xl p-6 space-y-4">
          <h3 className="text-white font-semibold">Новый набор табличек</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Количество табличек *</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={createQty}
                  onChange={(e) => setCreateQty(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Метка (необязательно)</label>
                <input
                  type="text"
                  value={createLabel}
                  onChange={(e) => setCreateLabel(e.target.value)}
                  placeholder="Заказ #1234"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={creating}>
                {creating ? "Создаём..." : "Создать набор"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                Отмена
              </Button>
            </div>
          </form>
        </div>
      )}

      {batches.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Нет наборов</p>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => (
            <div key={batch.id} className="bg-gray-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === batch.id ? null : batch.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-mono text-white text-sm">{batch.masterCode}</p>
                    {batch.label && (
                      <p className="text-xs text-gray-400">{batch.label}</p>
                    )}
                  </div>
                  <Badge variant={batch.status === "ACTIVATED" ? "success" : "warning"}>
                    {batch.status === "ACTIVATED" ? "Активирован" : "Ожидает"}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {batch.qty} шт.
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {batch.user && (
                    <span className="text-xs text-gray-400">
                      {batch.user.email}
                    </span>
                  )}
                  {batch.establishment && (
                    <span className="text-xs text-gray-400">
                      {batch.establishment.name}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {new Date(batch.createdAt).toLocaleDateString("ru-RU")}
                  </span>
                  <Link
                    href={`/admin/batches/${batch.id}/print`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                  >
                    <Printer className="w-3 h-3" />
                    Печать
                  </Link>
                  {expandedId === batch.id ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </div>
              </button>

              {expandedId === batch.id && (
                <div className="px-6 pb-4 border-t border-gray-700 pt-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {batch.qrcodes.map((qr) => (
                      <div
                        key={qr.id}
                        className={`rounded-lg p-3 text-center ${
                          qr.isActive ? "bg-green-900/30 border border-green-800" : "bg-gray-700"
                        }`}
                      >
                        <p className="text-xs text-gray-400">№{qr.serialCode || "—"}</p>
                        <p className="font-mono text-sm text-white">{qr.code}</p>
                        <Badge variant={qr.isActive ? "success" : "default"} className="mt-1 text-xs">
                          {qr.isActive ? "Активен" : "Нет"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
