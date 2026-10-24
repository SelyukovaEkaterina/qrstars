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
import { PLANS, PLAN_PRICING, type PlanId } from "@/lib/plans";
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
  const [plan, setPlan] = useState<PlanId>("FREE");
  const [actionError, setActionError] = useState("");

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
        if (subData.plan === "PRO" || subData.plan === "NETWORK") setPlan(subData.plan);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, router]);

  // ?create=1 (кнопка «+» в сайдбаре) открывает форму, в том числе при повторном переходе.
  const createParam = searchParams.get("create") === "1";
  const [prevCreateParam, setPrevCreateParam] = useState(false);
  if (createParam !== prevCreateParam) {
    setPrevCreateParam(createParam);
    if (createParam) setShowCreate(true);
  }

  const notifyProjectsChanged = () => {
    window.dispatchEvent(new Event("qrstars:projects-changed"));
  };

  const openCreate = () => {
    // При исчерпанном лимите вместо формы показываем карточку смены тарифа.
    if (!canAddEstablishment) {
      document.getElementById("projects-limit")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setShowCreate(true);
  };

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
          setCanAddEstablishment(false);
          setShowCreate(true);
        }
        return;
      }

      notifyProjectsChanged();

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

  const handleDelete = async (est: Establishment) => {
    const qrNote =
      est.qrcodesCount > 0
        ? `\n\nВсе ${est.qrcodesCount} ${pluralize(est.qrcodesCount, "QR-код", "QR-кода", "QR-кодов")} проекта перестанут работать — напечатанные таблички и наклейки будут вести на заглушку.`
        : "";
    if (
      !confirm(
        `Удалить проект «${est.name}»?${qrNote}\n\nОтзывы, заявки, микросайт и статистика проекта удалятся без возможности восстановления.`,
      )
    )
      return;
    setDeleting(est.id);
    setActionError("");
    try {
      const res = await fetch(`/api/establishments?id=${encodeURIComponent(est.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError(
          typeof data.error === "string" ? data.error : "Не удалось удалить проект. Попробуйте ещё раз.",
        );
        return;
      }
      setEstablishments((prev) => prev.filter((e) => e.id !== est.id));
      setCanAddEstablishment(true);
      notifyProjectsChanged();
      router.refresh();
    } catch {
      setActionError("Нет соединения с сервером. Проект не удалён.");
    } finally {
      setDeleting(null);
    }
  };

  const showCreateForm = showCreate && canAddEstablishment;
  const networkLimit = PLAN_PRICING.NETWORK.includedEstablishments;
  const limitText =
    plan === "NETWORK"
      ? `На тарифе «${PLANS.NETWORK.name}» — ${PLANS.NETWORK.establishmentLimitNote}. Нужно больше — напишите в поддержку, подберём тариф.`
      : `На тарифе ${PLANS[plan].name} — ${PLANS[plan].establishmentLimitNote}. «${PLANS.NETWORK.name}» — до ${networkLimit} проектов за ${PLAN_PRICING.NETWORK.yearlyRub.toLocaleString("ru-RU")} ₽/год.`;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex bg-gray-50">
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">
                Все проекты
              </h1>
              <p className="text-gray-500 mt-1">
                Заведения, доклады, мероприятия и бренды — у каждого свои QR-коды и микросайт
              </p>
            </div>
            <Button onClick={openCreate} disabled={!canAddEstablishment}>
              <Plus className="w-4 h-4 mr-2" />
              Создать проект
            </Button>
          </div>

          {!canAddEstablishment && (
            <Card
              id="projects-limit"
              className={`border-amber-200 bg-amber-50! ${showCreate ? "ring-2 ring-amber-300" : ""}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Crown className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-900">
                      {showCreate
                        ? "Новый проект не поместится в текущий тариф"
                        : "Лимит проектов на текущем тарифе"}
                    </p>
                    <p className="text-sm text-amber-800 mt-0.5">{limitText}</p>
                  </div>
                </div>
                {plan !== "NETWORK" ? (
                  <Link
                    href="/dashboard/subscription"
                    className="inline-flex min-h-10 items-center text-sm font-semibold text-indigo-600 hover:text-indigo-800 shrink-0"
                  >
                    {`Подключить «${PLANS.NETWORK.name}» →`}
                  </Link>
                ) : (
                  <Link
                    href="/dashboard/support"
                    className="inline-flex min-h-10 items-center text-sm font-semibold text-indigo-600 hover:text-indigo-800 shrink-0"
                  >
                    Написать в поддержку →
                  </Link>
                )}
              </div>
            </Card>
          )}

          <DashboardOnboardingBanner
            establishments={establishments.map((e) => ({ id: e.id, name: e.name }))}
            qrcodes={qrcodes}
            onCreateEstablishment={openCreate}
            onCreateQr={(estId) => router.push(projectQrNewPath(estId))}
            onLinkQr={(estId) =>
              router.push(`${projectQrcodesPath(estId)}?linkEst=${encodeURIComponent(estId)}`)
            }
          />

          {actionError && (
            <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {actionError}
            </div>
          )}

          {showCreateForm && (
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
                  className="-m-2 p-2 text-gray-400 hover:text-gray-600"
                  aria-label="Закрыть форму"
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
                  placeholder="Например: проект, кампания или заведение"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Адрес (необязательно)"
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
                  label="Ссылка на Яндекс.Карты (необязательно)"
                  type="url"
                  value={form.yandexMapsUrl}
                  onChange={(e) =>
                    setForm({ ...form, yandexMapsUrl: e.target.value })
                  }
                  placeholder="https://yandex.ru/maps/org/..."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="2GIS (необязательно)"
                    type="url"
                    value={form.twoGisUrl}
                    onChange={(e) =>
                      setForm({ ...form, twoGisUrl: e.target.value })
                    }
                    placeholder="https://2gis.ru/..."
                  />
                  <Input
                    label="Авито (необязательно)"
                    type="url"
                    value={form.avitoUrl}
                    onChange={(e) =>
                      setForm({ ...form, avitoUrl: e.target.value })
                    }
                    placeholder="https://avito.ru/..."
                  />
                </div>
                <div className="flex flex-wrap gap-3">
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

          {/* Пустое состояние показывает DashboardOnboardingBanner выше — без второй карточки. */}
          {(establishments.length > 0 || qrcodes.some((q) => !q.establishmentId)) && (
            <div className="space-y-4">
              {establishments.map((est) => (
                <Card key={est.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                        <Store className="w-5 h-5 shrink-0 text-indigo-600" />
                        <Link
                          href={projectHomePath(est.id)}
                          className="min-w-0 break-words font-semibold text-gray-900 text-lg hover:text-indigo-600 transition-colors"
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
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
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
                    <div className="flex items-center gap-1 border-t border-gray-100 pt-2 sm:ml-4 sm:border-0 sm:pt-0">
                      <Badge variant="info" className="mr-auto text-xs sm:order-last sm:mr-0 sm:ml-1">
                        {new Date(est.createdAt).toLocaleDateString("ru-RU")}
                      </Badge>
                      <Link
                        href={projectPagePath(est.id)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-50 hover:text-indigo-600 sm:h-9 sm:w-9"
                        title="Микросайт"
                        aria-label={`Микросайт проекта «${est.name}»`}
                      >
                        <Layout className="w-5 h-5 sm:w-4 sm:h-4" />
                      </Link>
                      <Link
                        href={projectSettingsPath(est.id)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-50 hover:text-indigo-600 sm:h-9 sm:w-9"
                        title="Настройки проекта"
                        aria-label={`Настройки проекта «${est.name}»`}
                      >
                        <Settings className="w-5 h-5 sm:w-4 sm:h-4" />
                      </Link>
                      {est.isOwner !== false && (
                        <button
                          type="button"
                          onClick={() => handleDelete(est)}
                          disabled={deleting === est.id}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 sm:h-9 sm:w-9"
                          title="Удалить проект"
                          aria-label={`Удалить проект «${est.name}»`}
                        >
                          {deleting === est.id ? (
                            <Loader2 className="w-5 h-5 animate-spin sm:w-4 sm:h-4" />
                          ) : (
                            <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
              {qrcodes.some((q) => !q.establishmentId) && (
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
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
        <div className="flex min-h-[60vh] items-center justify-center">
          <main className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </main>
        </div>
      }
    >
      <EstablishmentsPageContent />
    </Suspense>
  );
}
