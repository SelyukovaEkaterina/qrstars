"use client";

import { Suspense, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import DashboardOnboardingBanner from "@/components/dashboard/DashboardOnboardingBanner";
import { pickAutoLinkQrId } from "@/lib/dashboard-onboarding";
import { pluralize } from "@/lib/utils";
import {
  Store,
  Plus,
  Trash2,
  Loader2,
  QrCode,
  Star,
  MousePointerClick,
  X,
  Settings,
  Crown,
  Layout,
} from "lucide-react";
import Link from "next/link";
import {
  projectHomePath,
  projectPagePath,
  projectQrNewPath,
  projectQrPath,
  projectQrcodesPath,
  projectSettingsPath,
  UNASSIGNED_PROJECT_ID,
} from "@/lib/project-routes";

interface Establishment {
  id: string;
  isOwner?: boolean;
  name: string;
  address: string | null;
  phone: string | null;
  yandexMapsUrl: string | null;
  twoGisUrl: string | null;
  avitoUrl: string | null;
  qrcodesCount: number;
  reviewsCount: number;
  totalScans: number;
  createdAt: string;
}

interface QRCodeBrief {
  id: string;
  code: string;
  label: string | null;
  establishmentId: string | null;
  isActive: boolean;
}

function EstablishmentsPageContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [qrcodes, setQrcodes] = useState<QRCodeBrief[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [canAddEstablishment, setCanAddEstablishment] = useState(true);
  const [upgradeRequired, setUpgradeRequired] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    yandexMapsUrl: "",
    twoGisUrl: "",
    avitoUrl: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;

    Promise.all([
      fetch("/api/establishments").then((r) => r.json()),
      fetch("/api/qrcodes").then((r) => r.json()),
      fetch("/api/subscription").then((r) => r.json()),
    ])
      .then(([estData, qrData, subData]) => {
        setEstablishments(estData.establishments || []);
        setQrcodes(qrData.qrcodes || []);
        setCanAddEstablishment(subData.canAddEstablishment !== false);
        setUpgradeRequired(
          subData.upgradeHint?.requiredPlan || null
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, router]);

  useEffect(() => {
    let isMounted = true;
    if (searchParams.get("create") === "1" && isMounted) {
      setShowCreate(true);
    }
    return () => { isMounted = false; };
  }, [searchParams]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      setError("Название обязательно");
      return;
    }
    setCreating(true);
    setError("");

    try {
      const wasFirst = establishments.length === 0;
      const preferredQrId = searchParams.get("linkQr");
      const qrCodeId = wasFirst ? pickAutoLinkQrId(qrcodes, preferredQrId) : undefined;

      const res = await fetch("/api/establishments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, qrCodeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка");
        if (data.upgradeRequired) {
          setUpgradeRequired(data.upgradeRequired);
          setCanAddEstablishment(false);
        }
        return;
      }

      if (data.linkedQrId) {
        router.push(projectQrPath(data.establishment?.id || "", data.linkedQrId));
        return;
      }

      if (data.establishment?.id) {
        router.push(projectHomePath(data.establishment.id));
        return;
      }

      setEstablishments((prev) => [
        {
          ...data.establishment,
          qrcodesCount: data.linkedQrId ? 1 : 0,
          reviewsCount: 0,
          totalScans: 0,
          createdAt: data.establishment.createdAt || new Date().toISOString(),
        },
        ...prev,
      ]);
      setForm({
        name: "",
        address: "",
        phone: "",
        yandexMapsUrl: "",
        twoGisUrl: "",
        avitoUrl: "",
      });
      setShowCreate(false);

      if (wasFirst) {
        const qrRes = await fetch("/api/qrcodes");
        const qrData = await qrRes.json();
        setQrcodes(qrData.qrcodes || []);
      }
    } catch {
      setError("Ошибка соединения");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить проект и все связанные данные?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/establishments?id=${id}`, { method: "DELETE" });
      setEstablishments((prev) => prev.filter((e) => e.id !== id));
    } catch {
    } finally {
      setDeleting(null);
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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Все проекты
              </h1>
              <p className="text-gray-500 mt-1">
                Заведения, доклады, мероприятия и бренды — у каждого свои QR-коды и микросайт
              </p>
            </div>
            <Button
              onClick={() => setShowCreate(true)}
              disabled={!canAddEstablishment}
            >
              <Plus className="w-4 h-4 mr-2" />
              Создать проект
            </Button>
          </div>

          {!canAddEstablishment && (
            <Card className="border-amber-200 bg-amber-50/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Crown className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-900">
                      Лимит проектов на текущем тарифе
                    </p>
                    <p className="text-sm text-amber-800 mt-0.5">
                      {upgradeRequired === "NETWORK"
                        ? "Для второй и следующих точек подключите тариф «Сеть»."
                        : "На FREE и PRO доступен 1 проект."}
                    </p>
                  </div>
                </div>
                <Link
                  href="/dashboard/subscription"
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 shrink-0"
                >
                  Сменить тариф →
                </Link>
              </div>
            </Card>
          )}

          <DashboardOnboardingBanner
            establishments={establishments.map((e) => ({ id: e.id, name: e.name }))}
            qrcodes={qrcodes}
            onCreateEstablishment={() => setShowCreate(true)}
            onCreateQr={(estId) => router.push(projectQrNewPath(estId))}
            onLinkQr={(estId) =>
              router.push(`${projectQrcodesPath(estId)}`)
            }
          />

          {showCreate && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">
                  Новый проект
                </h3>
                <button
                  onClick={() => {
                    setShowCreate(false);
                    setError("");
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                {error && (
                  <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                {establishments.length === 0 && qrcodes.filter((q) => !q.establishmentId).length === 1 && (
                  <div className="bg-indigo-50 text-indigo-800 px-4 py-3 rounded-lg text-sm">
                    Найден непривязанный QR-код{" "}
                    <span className="font-mono">
                      {qrcodes.find((q) => !q.establishmentId)?.code}
                    </span>{" "}
                    — после создания проекта он будет привязан автоматически
                  </div>
                )}
                <Input
                  label="Название проекта *"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  placeholder="Кафе, салон, клиника, автосервис…"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Адрес"
                    value={form.address}
                    onChange={(e) =>
                      setForm({ ...form, address: e.target.value })
                    }
                    placeholder="г. Москва, ул. Примерная, 1"
                  />
                  <Input
                    label="Телефон"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    placeholder="+7 (999) 123-45-67"
                  />
                </div>
                <Input
                  label="Ссылка на Яндекс.Карты"
                  type="url"
                  value={form.yandexMapsUrl}
                  onChange={(e) =>
                    setForm({ ...form, yandexMapsUrl: e.target.value })
                  }
                  placeholder="https://yandex.ru/maps/org/..."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="2GIS"
                    type="url"
                    value={form.twoGisUrl}
                    onChange={(e) =>
                      setForm({ ...form, twoGisUrl: e.target.value })
                    }
                    placeholder="https://2gis.ru/..."
                  />
                  <Input
                    label="Авито"
                    type="url"
                    value={form.avitoUrl}
                    onChange={(e) =>
                      setForm({ ...form, avitoUrl: e.target.value })
                    }
                    placeholder="https://avito.ru/..."
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" disabled={creating}>
                    {creating ? "Создаём..." : "Создать проект"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowCreate(false);
                      setError("");
                    }}
                  >
                    Отмена
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {establishments.length === 0 ? (
            <Card className="text-center py-12">
              <Store className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900">
                Пока нет проектов
              </h2>
              <p className="text-gray-500 mt-2">
                Создайте первый проект — для кафе, доклада, видео или личного бренда
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {establishments.map((est) => (
                <Card key={est.id}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Store className="w-5 h-5 text-indigo-600" />
                        <Link
                          href={projectHomePath(est.id)}
                          className="font-semibold text-gray-900 text-lg hover:text-indigo-600 transition-colors"
                          title="Открыть проект"
                        >
                          {est.name}
                        </Link>
                        {est.isOwner === false && (
                          <Badge variant="warning" className="text-xs">
                            Совместный доступ
                          </Badge>
                        )}
                      </div>
                      {est.address && (
                        <p className="text-sm text-gray-500 mb-3">
                          {est.address}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-4">
                        <Link
                          href={projectQrcodesPath(est.id)}
                          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-indigo-600 transition-colors"
                          title="QR-коды проекта"
                        >
                          <QrCode className="w-4 h-4 text-indigo-500" />
                          <span className="underline-offset-2 hover:underline">
                            {est.qrcodesCount}{" "}
                            {pluralize(est.qrcodesCount, "QR-код", "QR-кода", "QR-кодов")}
                          </span>
                        </Link>
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span>{est.reviewsCount} {pluralize(est.reviewsCount, "отзыв", "отзыва", "отзывов")}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <MousePointerClick className="w-4 h-4 text-blue-500" />
                          <span>{est.totalScans} {pluralize(est.totalScans, "сканирование", "сканирования", "сканирований")}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Link
                        href={projectPagePath(est.id)}
                        className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                        title="Микросайт"
                      >
                        <Layout className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => router.push(projectSettingsPath(est.id))}
                        className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                        title="Настройки проекта"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <Badge variant="info" className="text-xs">
                        {new Date(est.createdAt).toLocaleDateString("ru-RU")}
                      </Badge>
                      {est.isOwner !== false && (
                        <button
                          onClick={() => handleDelete(est.id)}
                          disabled={deleting === est.id}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                          title="Удалить проект"
                        >
                          {deleting === est.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
              {qrcodes.some((q) => !q.establishmentId) && (
                <Card>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">Без проекта</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Старые QR-коды без привязки. Новые коды создаются только внутри проекта.
                      </p>
                    </div>
                    <Link
                      href={projectQrcodesPath(UNASSIGNED_PROJECT_ID)}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      Открыть
                    </Link>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function EstablishmentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen bg-gray-50">
              <main className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </main>
        </div>
      }
    >
      <EstablishmentsPageContent />
    </Suspense>
  );
}
