"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useLockedProjectId } from "@/components/dashboard/ProjectScope";
import { projectHomePath } from "@/lib/project-routes";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { Save, Loader2, ArrowLeft, Crown, Trash2, AlertTriangle } from "lucide-react";
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

type SaveStatus = { kind: "success" | "error"; text: string } | null;

function savePayload(data: EstablishmentSettings, yandexConfirmedUrl: string | null) {
  return {
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
    platformRotation: data.platformRotation,
    workingHours: data.workingHours,
  };
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
  const [saveStatus, setStatus] = useState<SaveStatus>(null);
  const [data, setData] = useState<EstablishmentSettings | null>(null);
  const [yandexConfirmedUrl, setYandexConfirmedUrl] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [hasPaid, setHasPaid] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const currentSnapshot = useMemo(
    () => (data ? JSON.stringify(savePayload(data, yandexConfirmedUrl)) : ""),
    [data, yandexConfirmedUrl],
  );
  const isDirty = Boolean(data) && currentSnapshot !== savedSnapshot;

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;

    fetch(`/api/settings?id=${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.establishment) {
          setData(res.establishment);
          setSavedSnapshot(JSON.stringify(savePayload(res.establishment, null)));
          setIsOwner(Boolean(res.access?.isOwner));
          setHasPaid(Boolean(res.access?.hasPaidFeatures));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, router, id]);

  const updateField = (field: keyof EstablishmentSettings, value: string | boolean) => {
    setData((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSave = useCallback(async () => {
    if (!data) return;
    setSaving(true);
    setStatus(null);

    const payload = savePayload(data, yandexConfirmedUrl);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSavedSnapshot(JSON.stringify(payload));
        setStatus({ kind: "success", text: "Настройки сохранены" });
        setTimeout(() => setStatus((s) => (s?.kind === "success" ? null : s)), 3000);
      } else {
        const err = await res.json().catch(() => ({}));
        setStatus({
          kind: "error",
          text: typeof err.error === "string" ? err.error : "Не удалось сохранить настройки",
        });
      }
    } catch {
      setStatus({ kind: "error", text: "Нет соединения с сервером. Изменения не сохранены." });
    } finally {
      setSaving(false);
    }
  }, [data, yandexConfirmedUrl]);

  const handleDelete = async () => {
    if (!data || deleteConfirm.trim() !== data.name.trim()) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/establishments?id=${encodeURIComponent(data.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setDeleteError(
          typeof err.error === "string" ? err.error : "Не удалось удалить проект",
        );
        return;
      }
      setSavedSnapshot(currentSnapshot);
      window.dispatchEvent(new Event("qrstars:projects-changed"));
      router.push("/dashboard");
      router.refresh();
    } catch {
      setDeleteError("Нет соединения с сервером. Проект не удалён.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex bg-gray-50">
        <main className="min-w-0 flex-1 flex items-center justify-center p-4 sm:p-8">
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
    <div className="flex bg-gray-50">
      <main className="min-w-0 flex-1 p-4 pb-0 sm:p-6 sm:pb-0 lg:p-8 lg:pb-0">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href={projectHomePath(id)}
              aria-label="Назад к проекту"
              title="Назад к проекту"
              className="-ml-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 break-words">{data.name}</h1>
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
                placeholder="Например: проект, кампания или заведение"
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
                label="Адрес (необязательно)"
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
                label="Яндекс.Карты (необязательно)"
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
              <label
                className={`flex items-start gap-3 ${hasPaid ? "cursor-pointer" : "cursor-not-allowed"}`}
              >
                <input
                  type="checkbox"
                  checked={data.platformRotation}
                  disabled={!hasPaid && !data.platformRotation}
                  onChange={(e) => updateField("platformRotation", e.target.checked)}
                  className="mt-0.5 w-5 h-5 shrink-0 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 disabled:opacity-50"
                />
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${hasPaid ? "text-gray-700" : "text-gray-500"}`}>
                    Умная ротация площадок
                  </p>
                  <p className="text-xs text-gray-400">
                    При ротации ссылка выбирается автоматически, если в сценарии не задана конкретная площадка
                  </p>
                  {!hasPaid && (
                    <Link
                      href="/dashboard/subscription"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      <Crown className="h-3.5 w-3.5" />
                      Доступно на PRO
                    </Link>
                  )}
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

          {isOwner && (
            <Card className="border-red-200">
              <h3 className="font-semibold text-red-700 mb-1 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Удаление проекта
              </h3>
              <p className="text-sm text-gray-600">
                Все QR-коды проекта перестанут работать: напечатанные таблички и наклейки будут
                открывать заглушку «QR-код не активирован». Микросайт, отзывы, заявки и статистика
                удалятся без возможности восстановления.
              </p>
              {!deleteOpen ? (
                <Button
                  variant="outline"
                  className="mt-4 border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Удалить проект
                </Button>
              ) : (
                <div className="mt-4 space-y-3">
                  <Input
                    label={`Введите название проекта «${data.name}», чтобы подтвердить`}
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    autoComplete="off"
                  />
                  {deleteError && (
                    <p role="alert" className="text-sm text-red-700">
                      {deleteError}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="danger"
                      onClick={handleDelete}
                      disabled={deleting || deleteConfirm.trim() !== data.name.trim()}
                    >
                      {deleting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-2" />
                      )}
                      Удалить навсегда
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setDeleteOpen(false);
                        setDeleteConfirm("");
                        setDeleteError("");
                      }}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          <div className="sticky bottom-0 z-10 -mx-4 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-t-xl sm:border-x sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 text-sm" aria-live="polite">
                {saveStatus ? (
                  <span className={saveStatus.kind === "error" ? "text-red-700" : "text-green-700"}>
                    {saveStatus.text}
                  </span>
                ) : isDirty ? (
                  <span className="inline-flex items-center gap-2 text-amber-700">
                    <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                    Есть несохранённые изменения
                  </span>
                ) : (
                  <span className="text-gray-400">Все изменения сохранены</span>
                )}
              </div>
              <Button onClick={handleSave} disabled={saving || !isDirty} className="w-full sm:w-auto">
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {saving ? "Сохраняем..." : "Сохранить"}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
