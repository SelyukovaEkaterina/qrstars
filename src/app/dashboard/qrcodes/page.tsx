"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Sidebar from "@/components/dashboard/Sidebar";
import DashboardOnboardingBanner from "@/components/dashboard/DashboardOnboardingBanner";
import Link from "next/link";
import {
  QrCode,
  Plus,
  Loader2,
  X,
  Store,
  Tag,
  Download,
  ExternalLink,
  Settings,
  Link2,
  Copy,
  Check,
} from "lucide-react";
import { qrPreviewDataUrl } from "@/lib/qr-preview";
import { pickAutoLinkQrId } from "@/lib/dashboard-onboarding";
import { scanUrlForCode } from "@/lib/utils";
import type { QrStyleTemplateSource } from "@/lib/qr-code-templates";

interface QRCodeItem {
  id: string;
  code: string;
  label: string | null;
  isActive: boolean;
  mode: "REVIEW" | "REDIRECT" | "BUSINESS_CARD" | "WIFI" | "FILE" | "MENU" | "LANDING";
  redirectUrl: string | null;
  scansCount: number;
  establishmentId: string | null;
  qrStyleTemplateId: string | null;
  qrStyleTemplate: QrStyleTemplateSource | null;
  source: "DASHBOARD" | "MARKETPLACE";
  serialCode: string | null;
  batch: { id: string; masterCode: string; status: string } | null;
  establishment: { name: string } | null;
  imageUrl: string;
}

interface Establishment {
  id: string;
  name: string;
}

function QRCodesPageContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [qrcodes, setQrcodes] = useState<QRCodeItem[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [filterEstId, setFilterEstId] = useState<string>("all");
  const [showCreateEst, setShowCreateEst] = useState(false);
  const [showLinkQr, setShowLinkQr] = useState(false);
  const [linkEstId, setLinkEstId] = useState("");
  const [selectedLinkQrId, setSelectedLinkQrId] = useState("");
  const [creatingEst, setCreatingEst] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [estForm, setEstForm] = useState({
    name: "",
    address: "",
    phone: "",
    yandexMapsUrl: "",
    twoGisUrl: "",
    avitoUrl: "",
  });

  const unlinkedQrcodes = qrcodes.filter((q) => !q.establishmentId);

  const generateQRImage = useCallback(
    async (
      text: string,
      isPro: boolean,
      qrStyleTemplateId?: string | null,
      qrStyleTemplate?: QrStyleTemplateSource | null,
    ) => {
      const templates = qrStyleTemplate ? [qrStyleTemplate] : [];
      return qrPreviewDataUrl(text, {
        qrStyleTemplateId,
        qrStyleTemplates: templates,
        isPro,
        size: 256,
      });
    },
    [],
  );

  const fetchQRCodes = useCallback(
    async (estId?: string) => {
      const url = estId && estId !== "all"
        ? `/api/qrcodes?establishmentId=${estId}`
        : "/api/qrcodes";
      const res = await fetch(url);
      const data = await res.json();
      const codes = data.qrcodes || [];
      const pro = data.isPro || false;

      const withImages = await Promise.all(
        codes.map(async (q: QRCodeItem) => ({
          ...q,
          imageUrl: await generateQRImage(
            scanUrlForCode(q.code),
            pro,
            q.qrStyleTemplateId,
            q.qrStyleTemplate,
          ),
        }))
      );
      setQrcodes(withImages);
    },
    [generateQRImage]
  );

  const refreshData = useCallback(async () => {
    const [estData] = await Promise.all([
      fetch("/api/establishments").then((r) => r.json()),
      fetchQRCodes(filterEstId),
    ]);
    setEstablishments(estData.establishments || []);
  }, [fetchQRCodes, filterEstId]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;

    queueMicrotask(() => {
      void refreshData().finally(() => setLoading(false));
    });
  }, [status, router, refreshData]);

  useEffect(() => {
    let isMounted = true;
    if (searchParams.get("createEst") === "1" && isMounted) {
      setShowCreateEst(true);
    }
    const linkEst = searchParams.get("linkEst");
    if (linkEst) {
      const first = qrcodes.find((q) => !q.establishmentId);
      setLinkEstId(linkEst);
      setSelectedLinkQrId(first?.id || "");
      setShowLinkQr(true);
    }
    const est = searchParams.get("est");
    if (est) {
      router.replace(`/dashboard/qrcodes/new?est=${est}`);
    }
  }, [searchParams, qrcodes, router]);

  const handleFilterChange = async (estId: string) => {
    setFilterEstId(estId);
    await fetchQRCodes(estId);
  };

  const handleCreateEstablishment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!estForm.name) {
      setError("Название обязательно");
      return;
    }
    setCreatingEst(true);
    setError("");

    try {
      const preferredQrId = searchParams.get("linkQr");
      const qrCodeId = pickAutoLinkQrId(qrcodes, preferredQrId);

      const res = await fetch("/api/establishments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...estForm, qrCodeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка");
        return;
      }

      setShowCreateEst(false);
      setEstForm({
        name: "",
        address: "",
        phone: "",
        yandexMapsUrl: "",
        twoGisUrl: "",
        avitoUrl: "",
      });

      if (data.linkedQrId) {
        router.push(`/dashboard/qrcodes/${data.linkedQrId}`);
        return;
      }

      await refreshData();
    } catch {
      setError("Ошибка соединения");
    } finally {
      setCreatingEst(false);
    }
  };

  const handleLinkQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLinkQrId || !linkEstId) return;
    setLinking(true);
    setError("");

    try {
      const res = await fetch("/api/qrcodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedLinkQrId,
          establishmentId: linkEstId,
          isActive: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка привязки");
        return;
      }
      setShowLinkQr(false);
      setSelectedLinkQrId("");
      setLinkEstId("");
      router.push(`/dashboard/qrcodes/${selectedLinkQrId}`);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLinking(false);
    }
  };

  const openLinkQr = (establishmentId: string) => {
    const first = unlinkedQrcodes[0];
    setLinkEstId(establishmentId);
    setSelectedLinkQrId(first?.id || "");
    setShowLinkQr(true);
    setError("");
  };

  const openCreateQr = (establishmentId: string) => {
    setError("");
    router.push(
      establishmentId
        ? `/dashboard/qrcodes/new?est=${establishmentId}`
        : "/dashboard/qrcodes/new",
    );
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
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">QR-коды</h1>
              <p className="text-gray-500 mt-1">
                Каждый QR-код имеет свою статистику и настройки
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setError("");
                  router.push("/dashboard/qrcodes/new");
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Добавить QR-код
              </Button>
            </div>
          </div>

          <DashboardOnboardingBanner
            establishments={establishments}
            qrcodes={qrcodes}
            filterEstId={filterEstId}
            onCreateEstablishment={() => {
              setShowCreateEst(true);
              setError("");
            }}
            onCreateQr={openCreateQr}
            onLinkQr={openLinkQr}
          />

          {showCreateEst && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Новая организация</h3>
                <button
                  onClick={() => {
                    setShowCreateEst(false);
                    setError("");
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateEstablishment} className="space-y-4">
                {error && showCreateEst && (
                  <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                {unlinkedQrcodes.length === 1 && (
                  <div className="bg-indigo-50 text-indigo-800 px-4 py-3 rounded-lg text-sm">
                    Найден непривязанный QR-код{" "}
                    <span className="font-mono">{unlinkedQrcodes[0].code}</span> — после
                    создания организации он будет привязан автоматически
                  </div>
                )}
                <Input
                  label="Название организации *"
                  value={estForm.name}
                  onChange={(e) => setEstForm({ ...estForm, name: e.target.value })}
                  placeholder="Кафе, салон, клиника, автосервис…"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Адрес"
                    value={estForm.address}
                    onChange={(e) => setEstForm({ ...estForm, address: e.target.value })}
                    placeholder="г. Москва, ул. Примерная, 1"
                  />
                  <Input
                    label="Телефон"
                    value={estForm.phone}
                    onChange={(e) => setEstForm({ ...estForm, phone: e.target.value })}
                    placeholder="+7 (999) 123-45-67"
                  />
                </div>
                <Input
                  label="Ссылка на Яндекс.Карты"
                  type="url"
                  value={estForm.yandexMapsUrl}
                  onChange={(e) =>
                    setEstForm({ ...estForm, yandexMapsUrl: e.target.value })
                  }
                  placeholder="https://yandex.ru/maps/org/..."
                />
                <div className="flex gap-3">
                  <Button type="submit" disabled={creatingEst}>
                    {creatingEst ? "Создаём..." : "Создать организацию"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowCreateEst(false);
                      setError("");
                    }}
                  >
                    Отмена
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {showLinkQr && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-indigo-600" />
                  Привязать QR-код
                </h3>
                <button
                  onClick={() => {
                    setShowLinkQr(false);
                    setError("");
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleLinkQr} className="space-y-4">
                {error && showLinkQr && (
                  <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Непривязанный QR-код
                  </label>
                  <select
                    value={selectedLinkQrId}
                    onChange={(e) => setSelectedLinkQrId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Выберите код</option>
                    {unlinkedQrcodes.map((qr) => (
                      <option key={qr.id} value={qr.id}>
                        {qr.code}
                        {qr.label ? ` — ${qr.label}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <Button type="submit" disabled={linking || !selectedLinkQrId}>
                    {linking ? "Привязываем..." : "Привязать и настроить"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowLinkQr(false);
                      setError("");
                    }}
                  >
                    Отмена
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <Card padding="sm">
            <div className="flex items-center gap-2 flex-wrap p-1">
              <Store className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm font-medium text-gray-500 shrink-0">Заведение:</span>
              <button
                onClick={() => handleFilterChange("all")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterEstId === "all"
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-700 border hover:bg-gray-50"
                }`}
              >
                Все
              </button>
              {establishments.map((est) => (
                <button
                  key={est.id}
                  onClick={() => handleFilterChange(est.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterEstId === est.id
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-gray-700 border hover:bg-gray-50"
                  }`}
                >
                  {est.name}
                </button>
              ))}
            </div>
          </Card>

          {qrcodes.length === 0 ? (
            <Card className="text-center py-12">
              <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold">Нет QR-кодов</h2>
              <p className="text-gray-500 mt-2">
                Добавьте QR-код или активируйте табличку
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {qrcodes.map((qr) => (
                <Card key={qr.id}>
                  <div className="text-center space-y-3">
                    <div className="flex justify-center">
                      <img
                        src={qr.imageUrl}
                        alt={`QR ${qr.code}`}
                        className="max-w-48 max-h-56 w-auto h-auto rounded-lg object-contain"
                      />
                    </div>
                    <div>
                      <p className="font-mono text-sm text-gray-600">
                        {qr.code}
                      </p>
                      {qr.serialCode && (
                        <p className="text-sm text-orange-600 mt-0.5 flex items-center justify-center gap-1">
                          <Tag className="w-3 h-3" />
                          №{qr.serialCode}
                        </p>
                      )}
                      {qr.label && !qr.serialCode && (
                        <p className="text-sm text-gray-700 mt-0.5 flex items-center justify-center gap-1">
                          <Tag className="w-3 h-3" />
                          {qr.label}
                        </p>
                      )}
                      <p className="text-sm text-gray-500 mt-1 flex items-center justify-center gap-1">
                        <Store className="w-3 h-3" />
                        {qr.establishment?.name || "Не привязан"}
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <Badge variant={qr.isActive ? "success" : "warning"}>
                        {qr.isActive ? "Активен" : "Неактивен"}
                      </Badge>
                      <Badge variant={qr.source === "MARKETPLACE" ? "warning" : "info"}>
                        {qr.source === "MARKETPLACE" ? "Табличка" : "ЛК"}
                      </Badge>
                      <Badge variant={qr.mode === "REDIRECT" ? "info" : qr.mode === "BUSINESS_CARD" ? "success" : qr.mode === "WIFI" || qr.mode === "FILE" ? "warning" : "default"}>
                        {qr.mode === "REDIRECT" ? (
                          <span className="flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            Редирект
                          </span>
                        ) : qr.mode === "BUSINESS_CARD" ? (
                          "Визитка"
                        ) : qr.mode === "WIFI" ? (
                          "Wi-Fi"
                        ) : qr.mode === "FILE" ? (
                          "Файл"
                        ) : qr.mode === "MENU" ? (
                          "Меню"
                        ) : qr.mode === "LANDING" ? (
                          "Лендинг"
                        ) : (
                          "Отзывы"
                        )}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {qr.scansCount} сканов
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/dashboard/qrcodes/${qr.id}`)}
                      >
                        <Settings className="w-3 h-3 mr-1" />
                        Настройки
                      </Button>
                      <button
                        onClick={() => {
                          const url = scanUrlForCode(qr.code);
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(url);
                          } else {
                            const ta = document.createElement("textarea");
                            ta.value = url;
                            ta.style.position = "fixed";
                            ta.style.opacity = "0";
                            document.body.appendChild(ta);
                            ta.select();
                            document.execCommand("copy");
                            document.body.removeChild(ta);
                          }
                          setCopiedId(qr.id);
                          setTimeout(() => setCopiedId((prev) => prev === qr.id ? null : prev), 2000);
                        }}
                        className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
                      >
                        {copiedId === qr.id ? (
                          <>
                            <Check className="w-3 h-3" />
                            Скопировано
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Ссылка
                          </>
                        )}
                      </button>
                      <a
                        href={qr.imageUrl}
                        download={`qr-${qr.code}.png`}
                        className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
                      >
                        <Download className="w-3 h-3" />
                        PNG
                      </a>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function QRCodesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen bg-gray-50">
          <Sidebar />
          <main className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </main>
        </div>
      }
    >
      <QRCodesPageContent />
    </Suspense>
  );
}
