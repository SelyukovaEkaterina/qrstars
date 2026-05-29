"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Sidebar from "@/components/dashboard/Sidebar";
import { Loader2, Package, CheckCircle2 } from "lucide-react";

interface TabletInfo {
  id: string;
  code: string;
  serialCode: string | null;
  label: string | null;
}

interface Establishment {
  id: string;
  name: string;
}

type Step = "enterCode" | "form" | "success";

export default function DashboardActivatePage() {
  const { status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<Step>("enterCode");
  const [loading, setLoading] = useState(false);
  const [checkingCode, setCheckingCode] = useState(false);
  const [error, setError] = useState("");
  const [masterCode, setMasterCode] = useState("");
  const [linkMode, setLinkMode] = useState<"new" | "existing">("new");
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [selectedEstId, setSelectedEstId] = useState("");
  const [tablets, setTablets] = useState<TabletInfo[]>([]);

  const [form, setForm] = useState({
    establishmentName: "",
    yandexMapsUrl: "",
    twoGisUrl: "",
    phone: "",
  });

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/establishments")
      .then((r) => r.json())
      .then((data) => {
        const ests = data.establishments || [];
        setEstablishments(ests);
        if (ests.length > 0) {
          setLinkMode("existing");
          setSelectedEstId(ests[0].id);
        }
      })
      .catch(() => {});
  }, [status]);

  const handleCheckCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterCode.trim()) {
      setError("Введите мастер-код");
      return;
    }
    setCheckingCode(true);
    setError("");
    try {
      const res = await fetch(`/api/activate-batch?masterCode=${encodeURIComponent(masterCode.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Набор не найден");
        return;
      }
      if (data.status === "ACTIVATED") {
        setError("Этот набор уже активирован");
        return;
      }
      setTablets(data.tablets || []);
      setStep("form");
    } catch {
      setError("Ошибка соединения");
    } finally {
      setCheckingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload: Record<string, string> = { masterCode };

      if (linkMode === "existing" && selectedEstId) {
        payload.establishmentId = selectedEstId;
      } else {
        payload.establishmentName = form.establishmentName;
        payload.phone = form.phone;
        payload.yandexMapsUrl = form.yandexMapsUrl;
        payload.twoGisUrl = form.twoGisUrl;
      }

      const res = await fetch("/api/activate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка активации");
        return;
      }

      setStep("success");
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </main>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-6 h-6 text-indigo-600" />
              Активация набора табличек
            </h1>
            <p className="text-gray-500 mt-1">
              Введите мастер-код с упаковки для привязки табличек к вашему заведению
            </p>
          </div>

          {step === "success" ? (
            <Card>
              <div className="text-center space-y-4 py-4">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                <h2 className="text-xl font-bold text-gray-900">Набор активирован!</h2>
                <p className="text-gray-600">
                  Активировано табличек: {tablets.length}. Теперь они привязаны к вашему заведению.
                </p>
                {tablets.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {tablets.map((t) => (
                      <span key={t.id} className="inline-flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-sm font-mono">
                        {t.serialCode || t.code}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-3 justify-center mt-4">
                  <Button onClick={() => router.push("/dashboard/qrcodes")}>
                    Перейти к QR-кодам
                  </Button>
                  <Button variant="outline" onClick={() => router.push("/dashboard")}>
                    На дашборд
                  </Button>
                </div>
              </div>
            </Card>
          ) : step === "enterCode" ? (
            <Card>
              <form onSubmit={handleCheckCode} className="space-y-4">
                {error && (
                  <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
                )}
                <Input
                  id="masterCode"
                  label="Мастер-код"
                  required
                  value={masterCode}
                  onChange={(e) => setMasterCode(e.target.value.toUpperCase())}
                  placeholder="MC-XXXX-XXXX"
                />
                <p className="text-xs text-gray-400">
                  Мастер-код напечатан на упаковке набора табличек или в инструкции
                </p>
                <Button type="submit" disabled={checkingCode}>
                  {checkingCode ? "Проверяем..." : "Проверить код"}
                </Button>
              </form>
            </Card>
          ) : (
            <Card>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-indigo-50 text-indigo-800 px-4 py-3 rounded-lg">
                  <p className="font-medium">Мастер-код: {masterCode}</p>
                  <p className="text-sm mt-1">Табличек в наборе: {tablets.length}</p>
                  {tablets.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {tablets.map((t) => (
                        <span key={t.id} className="bg-white px-2 py-0.5 rounded text-xs font-mono">
                          {t.serialCode || t.code}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
                )}

                {establishments.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button
                        type="button"
                        onClick={() => setLinkMode("existing")}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          linkMode === "existing"
                            ? "bg-white text-indigo-700 shadow-sm"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        Существующее заведение
                      </button>
                      <button
                        type="button"
                        onClick={() => setLinkMode("new")}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          linkMode === "new"
                            ? "bg-white text-indigo-700 shadow-sm"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        Новое заведение
                      </button>
                    </div>

                    {linkMode === "existing" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Заведение
                        </label>
                        <select
                          value={selectedEstId}
                          onChange={(e) => setSelectedEstId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {establishments.map((est) => (
                            <option key={est.id} value={est.id}>
                              {est.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {(linkMode === "new" || establishments.length === 0) && (
                  <>
                    <Input
                      id="establishmentName"
                      label="Название заведения *"
                      required
                      value={form.establishmentName}
                      onChange={(e) => setForm({ ...form, establishmentName: e.target.value })}
                      placeholder="Кафе, салон, клиника, автосервис…"
                    />
                    <Input
                      id="phone"
                      label="Телефон"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+7 (999) 123-45-67"
                    />
                    <Input
                      id="yandexMapsUrl"
                      label="Ссылка на Яндекс.Карты"
                      type="url"
                      value={form.yandexMapsUrl}
                      onChange={(e) => setForm({ ...form, yandexMapsUrl: e.target.value })}
                      placeholder="https://yandex.ru/maps/org/..."
                    />
                    <Input
                      id="twoGisUrl"
                      label="Ссылка на 2GIS"
                      type="url"
                      value={form.twoGisUrl}
                      onChange={(e) => setForm({ ...form, twoGisUrl: e.target.value })}
                      placeholder="https://2gis.ru/..."
                    />
                  </>
                )}

                <div className="flex gap-3">
                  <Button type="submit" disabled={loading}>
                    {loading ? "Активируем..." : `Активировать (${tablets.length} табличек)`}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => { setStep("enterCode"); setError(""); }}>
                    Назад
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
