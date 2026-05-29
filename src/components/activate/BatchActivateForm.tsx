"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { generatePassword } from "@/lib/utils";

interface TabletInfo {
  id: string;
  code: string;
  serialCode: string | null;
  label: string | null;
}

interface BatchActivateFormProps {
  initialMasterCode?: string;
}

interface Establishment {
  id: string;
  name: string;
}

type Step = "enterCode" | "form" | "success";

export default function BatchActivateForm({ initialMasterCode }: BatchActivateFormProps) {
  const { status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialMasterCode ? "form" : "enterCode");
  const [loading, setLoading] = useState(false);
  const [checkingCode, setCheckingCode] = useState(false);
  const [error, setError] = useState("");
  const [masterCode, setMasterCode] = useState(initialMasterCode || "");
  const [linkMode, setLinkMode] = useState<"new" | "existing">("new");
  const [userEstablishments, setUserEstablishments] = useState<Establishment[]>([]);
  const [selectedEstId, setSelectedEstId] = useState("");
  const [tablets, setTablets] = useState<TabletInfo[]>([]);

  const [form, setForm] = useState({
    establishmentName: "",
    email: "",
    password: generatePassword(),
    yandexMapsUrl: "",
    twoGisUrl: "",
    ownerName: "",
    phone: "",
  });

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/establishments")
        .then((r) => r.json())
        .then((data) => {
          const ests = data.establishments || [];
          setUserEstablishments(ests);
          if (ests.length > 0) {
            setLinkMode("existing");
            setSelectedEstId(ests[0].id);
          }
        })
        .catch(() => {});
    }
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
      const payload: Record<string, string> = {
        masterCode,
        establishmentName: form.establishmentName,
        email: form.email,
        password: form.password,
        ownerName: form.ownerName,
        phone: form.phone,
        yandexMapsUrl: form.yandexMapsUrl,
        twoGisUrl: form.twoGisUrl,
      };

      if (status === "authenticated" && linkMode === "existing" && selectedEstId) {
        payload.establishmentId = selectedEstId;
        delete payload.establishmentName;
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

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-6xl">✅</div>
          <h1 className="text-2xl font-bold text-gray-900">Набор табличек активирован!</h1>
          <p className="text-gray-600">
            Активировано табличек: {tablets.length}. Поставьте их на видное место — гости смогут оставлять отзывы, сканируя QR-код.
          </p>
          {tablets.length > 0 && (
            <div className="bg-white p-4 rounded-xl border mt-4">
              <p className="text-sm text-gray-500 mb-2">Таблички в наборе:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {tablets.map((t) => (
                  <span key={t.id} className="inline-flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-sm font-mono">
                    {t.serialCode || t.code}
                  </span>
                ))}
              </div>
            </div>
          )}
          {form.email && (
            <div className="bg-white p-6 rounded-xl border mt-4 text-left space-y-2">
              <p className="text-sm text-gray-500">Данные для входа в кабинет:</p>
              <p className="font-mono text-sm">Email: <strong>{form.email}</strong></p>
              <p className="font-mono text-sm">Пароль: <strong>{form.password}</strong></p>
            </div>
          )}
          <a href="/dashboard">
            <Button size="lg" className="w-full mt-4">Войти в личный кабинет</Button>
          </a>
        </div>
      </div>
    );
  }

  if (step === "enterCode") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center px-4 py-8">
        <form onSubmit={handleCheckCode} className="max-w-md w-full space-y-5">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">📦</div>
            <h1 className="text-2xl font-bold text-gray-900">Активация набора табличек</h1>
            <p className="text-gray-500 mt-2">
              Введите мастер-код с упаковки вашего набора
            </p>
          </div>
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
            className="text-center text-lg font-mono tracking-wider"
          />
          <Button type="submit" size="lg" className="w-full" disabled={checkingCode}>
            {checkingCode ? "Проверяем..." : "Проверить код"}
          </Button>
          <p className="text-xs text-gray-400 text-center">
            Мастер-код напечатан на упаковке набора табличек
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center px-4 py-8">
      <form onSubmit={handleSubmit} className="max-w-md w-full space-y-5">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Активация набора</h1>
          <p className="text-sm text-indigo-600 font-mono mt-1">Мастер-код: {masterCode}</p>
        </div>

        {tablets.length > 0 && (
          <div className="bg-white p-4 rounded-xl border">
            <p className="text-sm text-gray-500 mb-2">Таблички в наборе ({tablets.length} шт.):</p>
            <div className="flex flex-wrap gap-2">
              {tablets.map((t) => (
                <span key={t.id} className="inline-flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-sm font-mono">
                  {t.serialCode || t.code}
                  {t.label && <span className="text-gray-400 font-sans">({t.label})</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {status === "authenticated" && userEstablishments.length > 0 && (
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
                  Привязать к заведению
                </label>
                <select
                  value={selectedEstId}
                  onChange={(e) => setSelectedEstId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {userEstablishments.map((est) => (
                    <option key={est.id} value={est.id}>
                      {est.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Все таблички набора будут привязаны к выбранному заведению
                </p>
              </div>
            )}
          </div>
        )}

        {(linkMode === "new" || status !== "authenticated") && (
          <>
            <Input
              id="establishmentName"
              label="Название заведения *"
              required
              value={form.establishmentName}
              onChange={(e) => setForm({ ...form, establishmentName: e.target.value })}
              placeholder="Кафе, салон, клиника, автосервис…"
            />

            {status !== "authenticated" && (
              <>
                <Input
                  id="ownerName"
                  label="Ваше имя *"
                  required
                  value={form.ownerName}
                  onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                  placeholder="Иван Петров"
                />
                <Input
                  id="email"
                  label="Email *"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="owner@example.com"
                />
              </>
            )}

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
              label="Ссылка на 2GIS (необязательно)"
              type="url"
              value={form.twoGisUrl}
              onChange={(e) => setForm({ ...form, twoGisUrl: e.target.value })}
              placeholder="https://2gis.ru/..."
            />
          </>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Активируем..." : `Активировать набор (${tablets.length} табличек)`}
        </Button>

        {status !== "authenticated" && (
          <p className="text-xs text-gray-400 text-center">
            Пароль для входа будет отправлен на вашу почту
          </p>
        )}
      </form>
    </div>
  );
}
