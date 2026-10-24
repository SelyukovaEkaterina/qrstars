"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLockedProjectId } from "@/components/dashboard/ProjectScope";
import {
  UNASSIGNED_PROJECT_ID,
  isUnassignedProjectId,
  projectQrNewPath,
  projectQrPath,
} from "@/lib/project-routes";
import { MODE_LABELS, type QRMode } from "@/lib/qr-routing";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
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
  Trash2,
  MoreHorizontal,
  ScanLine,
} from "lucide-react";
import { qrPreviewDataUrl } from "@/lib/qr-preview";
import { downloadQrCode, QR_EXPORT_SIZE } from "@/lib/qr-download";
import { pickAutoLinkQrId } from "@/lib/dashboard-onboarding";
import { pluralize, scanUrlForCode } from "@/lib/utils";
import type { QrStyleTemplateSource } from "@/lib/qr-code-templates";

interface QRCodeItem {
  id: string;
  code: string;
  label: string | null;
  isActive: boolean;
  mode: QRMode;
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lockedProjectId = useLockedProjectId();
  const lockedEstId =
    lockedProjectId && !isUnassignedProjectId(lockedProjectId) ? lockedProjectId : null;
  const [loading, setLoading] = useState(true);
  const [qrcodes, setQrcodes] = useState<QRCodeItem[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [filterEstId, setFilterEstId] = useState<string>(
    () => lockedEstId || searchParams.get("estId") || (lockedProjectId === UNASSIGNED_PROJECT_ID ? UNASSIGNED_PROJECT_ID : "all"),
  );
  const [showCreateEst, setShowCreateEst] = useState(false);
  const [showLinkQr, setShowLinkQr] = useState(false);
  const [linkEstId, setLinkEstId] = useState("");
  const [selectedLinkQrId, setSelectedLinkQrId] = useState("");
  const [creatingEst, setCreatingEst] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [downloadingQrId, setDownloadingQrId] = useState<string | null>(null);
  const [deletingQrId, setDeletingQrId] = useState<string | null>(null);
  const [menuQrId, setMenuQrId] = useState<string | null>(null);
  /** Внутри проекта список грузится с ?establishmentId=, поэтому коды без проекта приходят отдельно. */
  const [unassignedQrcodes, setUnassignedQrcodes] = useState<QRCodeItem[]>([]);
  const isUnassignedView = lockedProjectId === UNASSIGNED_PROJECT_ID;

  const [estForm, setEstForm] = useState({
    name: "",
    address: "",
    phone: "",
    yandexMapsUrl: "",
    twoGisUrl: "",
    avitoUrl: "",
  });

  const unlinkedQrcodes = lockedEstId
    ? unassignedQrcodes
    : qrcodes.filter((q) => !q.establishmentId);

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
      const target = lockedEstId || estId;
      let url = "/api/qrcodes";
      if (target && target !== "all" && target !== UNASSIGNED_PROJECT_ID) {
        url = `/api/qrcodes?establishmentId=${target}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      const codes = (data.qrcodes || []).filter((q: QRCodeItem) => {
        if (lockedProjectId === UNASSIGNED_PROJECT_ID) return !q.establishmentId;
        return true;
      });
      const pro = data.isPro || false;
      setIsPro(pro);

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

      // Для баннера «привяжите существующий код» нужны коды без проекта.
      if (lockedEstId && codes.length === 0) {
        try {
          const allRes = await fetch("/api/qrcodes");
          const allData = await allRes.json();
          setUnassignedQrcodes(
            ((allData.qrcodes || []) as QRCodeItem[]).filter((q) => !q.establishmentId),
          );
        } catch {
          setUnassignedQrcodes([]);
        }
      } else {
        setUnassignedQrcodes([]);
      }
    },
    [generateQRImage, lockedEstId, lockedProjectId]
  );

  const handleDownloadQr = async (
    qr: QRCodeItem,
    format: "png" | "svg",
    opts?: { transparentBackground?: boolean },
  ) => {
    setDownloadingQrId(qr.id);
    try {
      await downloadQrCode(format, scanUrlForCode(qr.code), `qr-${qr.code}`, {
        qrStyleTemplateId: qr.qrStyleTemplateId,
        qrStyleTemplates: qr.qrStyleTemplate ? [qr.qrStyleTemplate] : [],
        isPro,
        size: QR_EXPORT_SIZE,
        transparentBackground: opts?.transparentBackground,
      });
    } finally {
      setDownloadingQrId(null);
    }
  };

  useEffect(() => {
    if (!menuQrId) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") setMenuQrId(null);
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target?.closest(`[data-qr-menu="${menuQrId}"]`)) return;
      setMenuQrId(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuQrId]);

  const copyScanLink = (qr: QRCodeItem) => {
    const url = scanUrlForCode(qr.code);
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(url);
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
    setTimeout(() => setCopiedId((prev) => (prev === qr.id ? null : prev)), 2000);
  };

  const handleDeleteQr = async (qr: QRCodeItem) => {
    setMenuQrId(null);
    const name = qr.label?.trim() || qr.code;
    if (!window.confirm(`Удалить QR «${name}»? Напечатанный код перестанет открываться.`)) return;
    setDeletingQrId(qr.id);
    try {
      const res = await fetch(`/api/qrcodes?id=${encodeURIComponent(qr.id)}`, { method: "DELETE" });
      if (!res.ok) {
        window.alert("Не удалось удалить QR-код");
        return;
      }
      setQrcodes((prev) => prev.filter((item) => item.id !== qr.id));
    } finally {
      setDeletingQrId(null);
    }
  };

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

  const firstUnlinkedId = unlinkedQrcodes[0]?.id || "";
  useEffect(() => {
    if (loading) return;
    // ?est= — создать QR для проекта
    const est = searchParams.get("est");
    if (est) {
      router.replace(projectQrNewPath(est));
      return;
    }
    const createEst = searchParams.get("createEst") === "1";
    const linkEst = searchParams.get("linkEst");
    const estId = lockedProjectId ? null : searchParams.get("estId");
    queueMicrotask(() => {
      if (createEst) setShowCreateEst(true);
      if (linkEst) {
        setLinkEstId(linkEst);
        setSelectedLinkQrId(firstUnlinkedId);
        setShowLinkQr(true);
      }
      if (estId) setFilterEstId(estId);
    });
    if (estId) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("estId");
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }
  }, [searchParams, loading, firstUnlinkedId, router, pathname, lockedProjectId]);

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
        router.push(projectQrPath(data.establishment?.id || lockedEstId || "", data.linkedQrId));
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
      router.push(projectQrPath(linkEstId, selectedLinkQrId));
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
      establishmentId ? projectQrNewPath(establishmentId) : "/dashboard/projects",
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <main className="flex min-w-0 flex-1 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </main>
      </div>
    );
  }

  const canCreateQr = Boolean(lockedEstId) || !lockedProjectId;
  const goCreateQr = () => {
    setError("");
    router.push(lockedEstId ? projectQrNewPath(lockedEstId) : "/dashboard/projects");
  };

  const modeBadgeVariant = (mode: QRMode) =>
    mode === "REDIRECT"
      ? "info"
      : mode === "BUSINESS_CARD"
        ? "success"
        : mode === "WIFI" || mode === "FILE"
          ? "warning"
          : "default";

  const downloadBtnClass =
    "inline-flex h-10 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-lg bg-gray-100 px-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 sm:h-8 sm:flex-none sm:px-2.5 sm:text-xs";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">
                {isUnassignedView ? "QR-коды без проекта" : "QR-коды"}
              </h1>
              <p className="text-gray-500 mt-1">
                {isUnassignedView
                  ? "Старые QR-коды без привязки. Новые коды создаются только внутри проекта."
                  : "Наклейки, слайды и таблички проекта — у каждого кода свой сценарий перехода"}
              </p>
            </div>
            {canCreateQr && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={goCreateQr} className="h-10 w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить QR-код
                </Button>
              </div>
            )}
          </div>

          {lockedEstId ? (
            <DashboardOnboardingBanner
              establishments={establishments.filter((e) => e.id === lockedEstId)}
              qrcodes={[...qrcodes, ...unassignedQrcodes]}
              filterEstId="all"
              onCreateEstablishment={() => router.push("/dashboard/projects")}
              onCreateQr={openCreateQr}
              onLinkQr={openLinkQr}
            />
          ) : isUnassignedView ? null : (
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
          )}

          {!lockedProjectId && showCreateEst && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Новый проект</h3>
                <button
                  type="button"
                  aria-label="Закрыть"
                  onClick={() => {
                    setShowCreateEst(false);
                    setError("");
                  }}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
                    создания проекта он будет привязан автоматически
                  </div>
                )}
                <Input
                  label="Название проекта *"
                  value={estForm.name}
                  onChange={(e) => setEstForm({ ...estForm, name: e.target.value })}
                  placeholder="Например: проект, кампания или заведение"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Адрес (необязательно)"
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
                  label="Ссылка на Яндекс.Карты (необязательно)"
                  type="url"
                  value={estForm.yandexMapsUrl}
                  onChange={(e) =>
                    setEstForm({ ...estForm, yandexMapsUrl: e.target.value })
                  }
                  placeholder="https://yandex.ru/maps/org/..."
                />
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={creatingEst}>
                    {creatingEst ? "Создаём..." : "Создать проект"}
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
                  type="button"
                  aria-label="Закрыть"
                  onClick={() => {
                    setShowLinkQr(false);
                    setError("");
                  }}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                <div className="flex flex-wrap gap-3">
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

          {!lockedProjectId && (
          <Card padding="sm">
            <div className="flex items-center gap-2 flex-wrap p-1">
              <Store className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm font-medium text-gray-500 shrink-0">Проект:</span>
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
          )}

          {qrcodes.length === 0 ? (
            <Card className="text-center py-12">
              <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold">Нет QR-кодов</h2>
              <p className="text-gray-500 mt-2">
                {canCreateQr
                  ? "Создайте QR-код или активируйте купленный набор табличек"
                  : "Здесь появятся старые коды без проекта"}
              </p>
              <div className="mt-6 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
                {canCreateQr && (
                  <Button onClick={goCreateQr} className="h-10">
                    <Plus className="w-4 h-4 mr-2" />
                    Создать QR-код
                  </Button>
                )}
                <Link
                  href="/dashboard/activate"
                  className="inline-flex h-10 items-center justify-center rounded-lg border-2 border-gray-300 px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <ScanLine className="w-4 h-4 mr-2" />
                  Активировать набор табличек
                </Link>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {qrcodes.map((qr) => {
                const title = qr.serialCode ? `№${qr.serialCode}` : qr.label?.trim() || null;
                const menuOpen = menuQrId === qr.id;
                return (
                <Card key={qr.id} padding="sm" className="sm:p-6">
                  <div className="relative space-y-3">
                    <div className="absolute right-0 top-0 z-10" data-qr-menu={qr.id}>
                      <button
                        type="button"
                        aria-label="Ещё действия"
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        onClick={() => setMenuQrId(menuOpen ? null : qr.id)}
                        className="-mr-2 -mt-2 inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                      >
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                      {menuOpen && (
                        <div
                          role="menu"
                          className="absolute right-0 top-9 w-48 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => void handleDeleteQr(qr)}
                            disabled={deletingQrId === qr.id}
                            className="flex h-10 w-full items-center gap-2 px-3 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4 shrink-0" />
                            {deletingQrId === qr.id ? "Удаляем..." : "Удалить QR-код"}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-start gap-3 sm:flex-col sm:items-center sm:text-center">
                      <img
                        src={qr.imageUrl}
                        alt={`QR ${qr.code}`}
                        className="h-[72px] w-[72px] shrink-0 rounded-lg object-contain sm:h-auto sm:max-h-56 sm:w-auto sm:max-w-48"
                      />
                      <div className="min-w-0 flex-1 space-y-1 pr-9 sm:w-full sm:pr-0">
                        {title && (
                          <p
                            className={`flex items-center gap-1 text-sm font-medium sm:justify-center ${
                              qr.serialCode ? "text-orange-600" : "text-gray-900"
                            }`}
                          >
                            <Tag className="h-3 w-3 shrink-0" />
                            <span className="truncate">{title}</span>
                          </p>
                        )}
                        <p className="truncate font-mono text-xs text-gray-500 sm:text-sm">
                          {qr.code}
                        </p>
                        {!lockedEstId && (
                          <p className="flex items-center gap-1 text-xs text-gray-500 sm:justify-center sm:text-sm">
                            <Store className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {qr.establishment?.name || "Без проекта"}
                            </span>
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 sm:justify-center">
                          <Badge variant={qr.isActive ? "success" : "warning"}>
                            {qr.isActive ? "Активен" : "Неактивен"}
                          </Badge>
                          <Badge variant={modeBadgeVariant(qr.mode)}>
                            <span className="flex items-center gap-1">
                              {qr.mode === "REDIRECT" && <ExternalLink className="h-3 w-3" />}
                              {MODE_LABELS[qr.mode] ?? qr.mode}
                            </span>
                          </Badge>
                          <span className="text-xs text-gray-400">
                            {qr.scansCount} {pluralize(qr.scansCount, "скан", "скана", "сканов")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-stretch gap-2">
                      <Link
                        href={projectQrPath(
                          qr.establishmentId || lockedEstId || UNASSIGNED_PROJECT_ID,
                          qr.id,
                        )}
                        className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border-2 border-gray-300 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        <Settings className="h-4 w-4 shrink-0" />
                        Настройки
                      </Link>
                      <button
                        type="button"
                        onClick={() => copyScanLink(qr)}
                        className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border-2 border-gray-300 px-3 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
                      >
                        {copiedId === qr.id ? (
                          <>
                            <Check className="h-4 w-4 shrink-0" />
                            Скопировано
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 shrink-0" />
                            Ссылка
                          </>
                        )}
                      </button>
                    </div>

                    <div className="border-t border-gray-100 pt-2">
                      <p className="mb-1.5 flex items-center gap-1 text-xs text-gray-400 sm:justify-center">
                        <Download className="h-3 w-3" />
                        Скачать
                      </p>
                      <div className="flex items-center gap-1.5 sm:flex-wrap sm:justify-center">
                        <button
                          type="button"
                          onClick={() => void handleDownloadQr(qr, "png")}
                          disabled={downloadingQrId === qr.id}
                          className={downloadBtnClass}
                        >
                          PNG
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleDownloadQr(qr, "png", { transparentBackground: true })
                          }
                          disabled={downloadingQrId === qr.id}
                          className={downloadBtnClass}
                          title="PNG с прозрачным фоном"
                        >
                          PNG без фона
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDownloadQr(qr, "svg")}
                          disabled={downloadingQrId === qr.id}
                          className={downloadBtnClass}
                        >
                          SVG
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
                );
              })}
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
          <main className="flex min-w-0 flex-1 items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </main>
        </div>
      }
    >
      <QRCodesPageContent />
    </Suspense>
  );
}
