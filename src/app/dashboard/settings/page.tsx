"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Sidebar from "@/components/dashboard/Sidebar";
import { Save, Loader2 } from "lucide-react";

interface Establishment {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  yandexMapsUrl: string | null;
  twoGisUrl: string | null;
  avitoUrl: string | null;
  platformRotation: boolean;
  watermarkEnabled: boolean;
  tipsEnabled: boolean;
}

export default function SettingsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
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

  const updateField = (field: keyof Establishment, value: string | boolean) => {
    setEstablishments((prev) =>
      prev.map((e) => (e.id === activeId ? { ...e, [field]: value } : e))
    );
  };

  const handleSave = async () => {
    if (!current) return;
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(current),
      });

      if (res.ok) {
        setMessage("Настройки сохранены");
      } else {
        setMessage("Ошибка сохранения");
      }
    } catch {
      setMessage("Ошибка соединения");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

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
        <div className="max-w-2xl mx-auto space-y-6">
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">
                    {current.name}
                  </h3>
                  <button
                    onClick={() => router.push(`/dashboard/establishments/${activeId}`)}
                    className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    Настройки заведения →
                  </button>
                </div>
              </Card>

              <Card>
                <h3 className="font-semibold text-gray-900 mb-4">Площадки для отзывов</h3>
                <div className="space-y-4">
                  <Input
                    label="Яндекс.Карты"
                    type="url"
                    value={current.yandexMapsUrl || ""}
                    onChange={(e) => updateField("yandexMapsUrl", e.target.value)}
                    placeholder="https://yandex.ru/maps/org/..."
                  />
                  <Input
                    label="2GIS"
                    type="url"
                    value={current.twoGisUrl || ""}
                    onChange={(e) => updateField("twoGisUrl", e.target.value)}
                    placeholder="https://2gis.ru/..."
                  />
                  <Input
                    label="Авито"
                    type="url"
                    value={current.avitoUrl || ""}
                    onChange={(e) => updateField("avitoUrl", e.target.value)}
                    placeholder="https://avito.ru/..."
                  />
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={current.platformRotation}
                      onChange={(e) => updateField("platformRotation", e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Умная ротация площадок (PRO)
                      </p>
                      <p className="text-xs text-gray-400">
                        Гостей будет перенаправлять на разные площадки по очереди
                      </p>
                    </div>
                  </label>
                </div>
              </Card>

              <Card>
                <h3 className="font-semibold text-gray-900 mb-4">Брендинг</h3>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!current.watermarkEnabled}
                    onChange={(e) => updateField("watermarkEnabled", !e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      White-label — скрыть водяной знак (PRO)
                    </p>
                    <p className="text-xs text-gray-400">
                      Убрать надпись «Сделано в QrStars.ru»
                    </p>
                  </div>
                </label>
              </Card>

              <Card>
                <h3 className="font-semibold text-gray-900 mb-4">Чаевые (PRO)</h3>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={current.tipsEnabled}
                    onChange={(e) => updateField("tipsEnabled", e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Включить чаевые для персонала
                    </p>
                    <p className="text-xs text-gray-400">
                      Гости смогут оставить чаевые после положительного отзыва
                    </p>
                  </div>
                </label>
              </Card>

              {message && (
                <div
                  className={`px-4 py-3 rounded-lg text-sm ${
                    message.includes("Ошибка")
                      ? "bg-red-50 text-red-700"
                      : "bg-green-50 text-green-700"
                  }`}
                >
                  {message}
                </div>
              )}

              <Button size="lg" onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Сохраняем..." : "Сохранить настройки"}
              </Button>
            </div>
          ) : (
            <Card className="text-center py-12">
              <p className="text-gray-500">Заведения не найдены. Активируйте табличку.</p>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
