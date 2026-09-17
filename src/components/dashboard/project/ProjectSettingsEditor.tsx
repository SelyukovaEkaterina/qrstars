"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useLockedProjectId } from "@/components/dashboard/ProjectScope";
import { projectHomePath } from "@/lib/project-routes";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { Save, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import WorkingHoursEditor from "@/components/dashboard/WorkingHoursEditor";
import EstablishmentTeamAccess from "@/components/dashboard/EstablishmentTeamAccess";
import YandexMapsOrgConfirm from "@/components/dashboard/YandexMapsOrgConfirm";
import { parseWorkingHours, type WorkingHours } from "@/lib/working-hours";
import {
  LEGAL_REQUISITES_HINT,
  LEGAL_REQUISITES_INCOMPLETE,
  LEGAL_REQUISITES_READY,
} from "@/lib/pd-consent";
import {
  INDUSTRY_OPTIONS,
  type EstablishmentIndustry,
} from "@/lib/establishment-industry";

interface EstablishmentSettings {
  id: string;
  name: string;
  industry: EstablishmentIndustry | null;
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

export default function EstablishmentSettingsPage() {
  const params = useParams();
  const lockedProjectId = useLockedProjectId();
  const id =
    lockedProjectId ||
    (typeof params.projectId === "string" ? params.projectId : "") ||
    (typeof params.id === "string" ? params.id : "");
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [data, setData] = useState<EstablishmentSettings | null>(null);
  const [yandexConfirmedUrl, setYandexConfirmedUrl] = useState<string | null>(null);

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
        body: JSON.stringify({
          id: data.id,
          name: data.name,
          industry: data.industry,
          address: data.address,
          phone: data.phone,
          legalName: data.legalName,
          inn: data.inn,
          yandexMapsUrl: yandexConfirmedUrl || data.yandexMapsUrl,
          twoGisUrl: data.twoGisUrl,
          avitoUrl: data.avitoUrl,
          workingHours: data.workingHours,
        }),
      });

      if (res.ok) {
        setMessage("Настройки сохранены");
      } else {
        const err = await res.json().catch(() => ({}));
        setMessage(
          typeof err.error === "string" ? err.error : "Ошибка сохранения",
        );
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
          <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen bg-gray-50">
          <main className="flex-1 flex items-center justify-center">
          <Card className="text-center py-12 px-8">
            <p className="text-gray-500">Проект не найден</p>
            <Button variant="ghost" className="mt-4" onClick={() => router.push("/dashboard/projects")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад к проектам
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <main className="flex-1 p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(projectHomePath(id))}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
              <p className="text-gray-500 text-sm mt-0.5">Настройки проекта</p>
            </div>
          </div>

          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Основное</h3>
            <div className="space-y-4">
              <Input
                label="Название проекта"
                value={data.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Кафе, салон, клиника, автосервис…"
              />
              <label className="block space-y-1">
                <span className="block text-sm font-medium text-gray-700">Отрасль</span>
                <select
                  value={data.industry || ""}
                  onChange={(e) => updateField("industry", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Не выбрана</option>
                  {INDUSTRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
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
              Показываются на микросайте («Открыто до 22:00» / «Откроется завтра в 09:00»).
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
              {LEGAL_REQUISITES_HINT}
            </p>
            <div className="space-y-4">
              <Input
                label="Юридическое наименование"
                value={data.legalName || ""}
                onChange={(e) => updateField("legalName", e.target.value)}
                placeholder="ИП Иванов Иван Иванович / ООО «Название»"
              />
              <Input
                label="ИНН"
                value={data.inn || ""}
                onChange={(e) => updateField("inn", e.target.value)}
                placeholder="123456789012"
              />
            </div>
            {(data.legalName && data.inn) ? (
              <p className="mt-3 text-xs text-green-600">✓ {LEGAL_REQUISITES_READY}</p>
            ) : (
              <p className="mt-3 text-xs text-amber-600">⚠ {LEGAL_REQUISITES_INCOMPLETE}</p>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Площадки для отзывов</h3>
            <p className="text-sm text-gray-500 mb-4">
              Ссылки используются в сценариях «Сбор отзывов» при выборе действия «Яндекс.Карты», «2GIS» или «Авито».
            </p>
            <div className="space-y-4">
              <YandexMapsOrgConfirm
                label="Яндекс.Карты"
                value={data.yandexMapsUrl || ""}
                onChange={(url) => updateField("yandexMapsUrl", url)}
                onConfirmedChange={setYandexConfirmedUrl}
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
