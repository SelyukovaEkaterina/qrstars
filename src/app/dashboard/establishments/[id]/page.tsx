"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Sidebar from "@/components/dashboard/Sidebar";
import { Save, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import WorkingHoursEditor from "@/components/dashboard/WorkingHoursEditor";
import EstablishmentTeamAccess from "@/components/dashboard/EstablishmentTeamAccess";
import { parseWorkingHours, type WorkingHours } from "@/lib/working-hours";

interface EstablishmentSettings {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  legalName: string | null;
  inn: string | null;
  yandexMapsUrl: string | null;
  twoGisUrl: string | null;
  avitoUrl: string | null;
  platformRotation: boolean;
  notificationEmail: string | null;
  notificationEmailEnabled: boolean;
  notificationTelegramChatId: string | null;
  notificationTelegramEnabled: boolean;
  notificationMaxUserId: string | null;
  notificationMaxEnabled: boolean;
  workingHours: unknown;
}

export default function EstablishmentSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [data, setData] = useState<EstablishmentSettings | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;

    fetch(`/api/settings?id=${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.establishment) {
          setData(res.establishment);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, router, id]);

  const updateField = (field: keyof EstablishmentSettings, value: string | boolean) => {
    setData((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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

  if (!data) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Card className="text-center py-12 px-8">
            <p className="text-gray-500">Заведение не найдено</p>
            <Button variant="ghost" className="mt-4" onClick={() => router.push("/dashboard/establishments")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад к заведениям
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard/establishments")}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
              <p className="text-gray-500 text-sm mt-0.5">Настройки заведения</p>
            </div>
          </div>

          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Основное</h3>
            <div className="space-y-4">
              <Input
                label="Название заведения"
                value={data.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Кафе, салон, клиника, автосервис…"
              />
              <Input
                label="Адрес"
                value={data.address || ""}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="г. Москва, ул. Примерная, 42"
              />
              <Input
                label="Телефон"
                value={data.phone || ""}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="+7 (999) 123-45-67"
              />
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-gray-900 mb-1">Часы работы</h3>
            <p className="text-sm text-gray-500 mb-4">
              Показываются на микро-лендинге («Открыто до 22:00» / «Откроется завтра в 09:00»).
            </p>
            <WorkingHoursEditor
              value={parseWorkingHours(data.workingHours)}
              onChange={(wh: WorkingHours | null) =>
                setData((prev) => (prev ? { ...prev, workingHours: wh } : prev))
              }
            />
          </Card>

          <Card>
            <h3 className="font-semibold text-gray-900 mb-1">Реквизиты для политики персональных данных</h3>
            <p className="text-sm text-gray-500 mb-4">
              Необходимо для форм, собирающих телефон или email гостей. Пока не заполнено — такие поля не будут показываться гостям.
            </p>
            <div className="space-y-4">
              <Input
                label="Юридическое наименование *"
                value={data.legalName || ""}
                onChange={(e) => updateField("legalName", e.target.value)}
                placeholder="ИП Иванов Иван Иванович / ООО «Название»"
              />
              <Input
                label="ИНН *"
                value={data.inn || ""}
                onChange={(e) => updateField("inn", e.target.value)}
                placeholder="123456789012"
              />
            </div>
            {(data.legalName && data.inn) ? (
              <p className="mt-3 text-xs text-green-600">✓ Политика ПД активна — формы с телефоном/email доступны гостям.</p>
            ) : (
              <p className="mt-3 text-xs text-amber-600">⚠ Заполните оба поля, чтобы разблокировать формы с телефоном и email.</p>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Площадки для отзывов</h3>
            <p className="text-sm text-gray-500 mb-4">
              Ссылки используются в сценариях «Сбор отзывов» при выборе действия «Яндекс.Карты», «2GIS» или «Авито».
            </p>
            <div className="space-y-4">
              <Input
                label="Яндекс.Карты"
                type="url"
                value={data.yandexMapsUrl || ""}
                onChange={(e) => updateField("yandexMapsUrl", e.target.value)}
                placeholder="https://yandex.ru/maps/org/..."
              />
              <Input
                label="2GIS"
                type="url"
                value={data.twoGisUrl || ""}
                onChange={(e) => updateField("twoGisUrl", e.target.value)}
                placeholder="https://2gis.ru/..."
              />
              <Input
                label="Авито"
                type="url"
                value={data.avitoUrl || ""}
                onChange={(e) => updateField("avitoUrl", e.target.value)}
                placeholder="https://avito.ru/..."
              />
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.platformRotation}
                  onChange={(e) => updateField("platformRotation", e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-700">Умная ротация площадок (PRO)</p>
                  <p className="text-xs text-gray-400">
                    При ротации ссылка выбирается автоматически, если в сценарии не задана конкретная площадка
                  </p>
                </div>
              </label>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-gray-900 mb-1">Уведомления</h3>
            <p className="text-sm text-gray-500">
              Каналы (Telegram, MAX, email) и галочки «Отзывы» / «Заявки» — в{" "}
              <Link
                href="/dashboard/settings#notification-channels"
                className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
              >
                настройках аккаунта
              </Link>
              .
            </p>
          </Card>

          <EstablishmentTeamAccess establishmentId={id} />

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
      </main>
    </div>
  );
}
