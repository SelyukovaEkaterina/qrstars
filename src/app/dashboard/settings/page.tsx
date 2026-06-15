"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Sidebar from "@/components/dashboard/Sidebar";
import MessengerContactsManager from "@/components/dashboard/MessengerContactsManager";
import { Loader2 } from "lucide-react";

interface Establishment {
  id: string;
  name: string;
}

export default function SettingsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;

    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.establishments?.length > 0) {
          setEstablishments(data.establishments);
          setActiveId(data.establishments[0].id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, router]);

  const current = establishments.find((e) => e.id === activeId);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>

          {establishments.length > 1 && (
            <div className="flex gap-2">
              {establishments.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setActiveId(e.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    e.id === activeId
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-gray-700 border hover:bg-gray-50"
                  }`}
                >
                  {e.name}
                </button>
              ))}
            </div>
          )}

          {current ? (
            <div className="space-y-6">
              <Card>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{current.name}</h3>
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/establishments/${activeId}`)}
                    className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    Настройки заведения →
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Площадки для отзывов (Яндекс.Карты, 2GIS, Авито) — в настройках заведения. Каналы уведомлений — ниже.
                </p>
              </Card>

              <MessengerContactsManager
                establishmentId={activeId}
                establishmentName={current.name}
              />

              <Card className="border-dashed">
                <h3 className="font-semibold text-gray-900 mb-1">Мастер настройки QR</h3>
                <p className="text-sm text-gray-500 mb-3">
                  Создать новый QR для существующего заведения или добавить ещё одно — пошаговый мастер как при первом запуске.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/dashboard/start")}
                  >
                    Открыть мастер
                  </Button>
                  
                </div>
              </Card>
            </div>
          ) : (
            <Card className="text-center py-12">
              <p className="text-gray-500">Заведения не найдены.</p>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
