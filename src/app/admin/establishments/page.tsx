"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import {
  Store,
  Loader2,
  ExternalLink,
  MapPin,
  Phone,
  Search,
} from "lucide-react";

interface Establishment {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  yandexMapsUrl: string | null;
  twoGisUrl: string | null;
  avitoUrl: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
  _count: { reviews: number; qrcodes: number; promocodes: number };
  totalScans: number;
}

export default function AdminEstablishmentsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/admin/login");
    if (status !== "authenticated") return;

    fetch("/api/admin/establishments")
      .then((r) => r.json())
      .then((data) => {
        setEstablishments(data.establishments || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, router]);

  const filtered = establishments.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.user.email.toLowerCase().includes(q) ||
      (e.user.name || "").toLowerCase().includes(q) ||
      (e.address || "").toLowerCase().includes(q)
    );
  });

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
              <h1 className="text-2xl font-bold text-white">Заведения</h1>
              <p className="text-gray-400 mt-1">
                {filtered.length} из {establishments.length}
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Поиск по названию, владельцу, адресу..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((e) => (
                <div
                  key={e.id}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {e.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Владелец: {e.user.name || e.user.email}
                      </p>
                    </div>
                    <span className="text-xs text-gray-600">
                      {new Date(e.createdAt).toLocaleDateString("ru-RU")}
                    </span>
                  </div>

                  {e.description && (
                    <p className="text-sm text-gray-400 mb-3">{e.description}</p>
                  )}

                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                    {e.address && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {e.address}
                      </span>
                    )}
                    {e.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {e.phone}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mb-3">
                    <Badge className="bg-blue-500/10 text-blue-400">
                      {e._count.reviews} отзывов
                    </Badge>
                    <Badge className="bg-purple-500/10 text-purple-400">
                      {e._count.qrcodes} QR-кодов
                    </Badge>
                    <Badge className="bg-green-500/10 text-green-400">
                      {e.totalScans} сканирований
                    </Badge>
                    {e._count.promocodes > 0 && (
                      <Badge className="bg-amber-500/10 text-amber-400">
                        {e._count.promocodes} промокодов
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {e.yandexMapsUrl && (
                      <a
                        href={e.yandexMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-yellow-500 hover:text-yellow-400 flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Яндекс
                      </a>
                    )}
                    {e.twoGisUrl && (
                      <a
                        href={e.twoGisUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-500 hover:text-green-400 flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        2GIS
                      </a>
                    )}
                    {e.avitoUrl && (
                      <a
                        href={e.avitoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Авито
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-20 text-gray-500">
                  <Store className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  {search ? "Ничего не найдено" : "Заведений пока нет"}
                </div>
              )}
        </div>
      )}
    </div>
  );
}
