"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Sidebar from "@/components/dashboard/Sidebar";
import FileAssetEditor, { type FileAssetData } from "@/components/dashboard/FileAssetEditor";
import RoutingPreview from "@/components/dashboard/RoutingPreview";
import type { MenuData } from "@/components/dashboard/MenuEditor";
import {
  modeToRouting,
  routingToMode,
  ROUTING_GROUPS,
  BUILTIN_SECTION_OPTIONS,
  MODE_LABELS,
  isBuiltinSection,
  customSectionIdToTarget,
  targetToCustomPageId,
  type RoutingGroup,
  type SectionTarget,
  type BuiltinSectionTarget,
  type QRMode,
} from "@/lib/qr-routing";
import { parsePageModules, type PageModules } from "@/lib/page-modules";
import {
  Loader2,
  ArrowLeft,
  Download,
  Save,
  Palette,
  FileText,
  Type,
  X,
  Upload,
  Crown,
  Layout,
  ChevronDown,
  Printer,
} from "lucide-react";
import Link from "next/link";
import { generateQRWithCenter, type QRCenterOptions } from "@/lib/qr-generator";
import { generatePDFFromLayout, generateQRForPDF } from "@/lib/pdf-generator";
import { scanUrlForCode } from "@/lib/utils";
import type { TemplateLayout } from "@/types/template";
import {
  renderSticker,
  FORMATS,
  DEFAULT_STICKER_CONFIG,
  type StickerConfig,
} from "@/components/dashboard/StickerDesigner";

interface QRCodeData {
  id: string;
  code: string;
  label: string | null;
  isActive: boolean;
  mode: QRMode;
  redirectUrl: string | null;
  customSectionId: string | null;
  scansCount: number;
  establishmentId: string | null;
  templateId: string | null;
  centerText: string | null;
  centerLogoUrl: string | null;
  establishment: {
    name: string;
    id: string;
    pageModules?: unknown;
    menu?: MenuData | null;
  } | null;
  fileAsset: FileAssetData | null;
}

interface Establishment {
  id: string;
  name: string;
}

interface Template {
  id: string;
  name: string;
  layout: TemplateLayout;
}

export default function QRCodeSettingsPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const qrId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [qrImageUrl, setQrImageUrl] = useState("");

  const [qrData, setQrData] = useState<QRCodeData | null>(null);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<QRMode>("REVIEW");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [establishmentId, setEstablishmentId] = useState("");
  const [templateId, setTemplateId] = useState("");

  const [fileAssetData, setFileAssetData] = useState<FileAssetData | null>(null);
  const [routingGroup, setRoutingGroup] = useState<RoutingGroup>("SECTION");
  const [sectionTarget, setSectionTarget] = useState<SectionTarget>("REVIEW");
  const [customSectionId, setCustomSectionId] = useState<string | null>(null);
  const [pageModules, setPageModules] = useState<PageModules>(parsePageModules(null));
  const [previewMenu, setPreviewMenu] = useState<MenuData | null>(null);
  const [customPages, setCustomPages] = useState<
    { id: string; menuItemLabel: string; enabled: boolean; type?: string }[]
  >([]);
  const [legacyFileMode, setLegacyFileMode] = useState(false);

  const [isPro, setIsPro] = useState(false);
  const [centerText, setCenterText] = useState("");
  const [centerLogoUrl, setCenterLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfHint, setPdfHint] = useState("");
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const generateQRImage = useCallback(async (code: string, centerOpts?: QRCenterOptions) => {
    const url = await generateQRWithCenter(
      scanUrlForCode(code),
      centerOpts || { isPro: false },
      512
    );
    setQrImageUrl(url);
  }, []);

  useEffect(() => {
    setShowWelcome(new URLSearchParams(window.location.search).get("welcome") === "1");
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;

    Promise.all([
      fetch(`/api/qrcodes?id=${qrId}`).then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      }),
      fetch("/api/establishments").then((r) => r.json()),
      fetch("/api/templates").then((r) => r.json()),
    ])
      .then(([qrResponse, estData, tplData]) => {
        const qr = qrResponse.qrcode;
        const pro = qrResponse.isPro || false;
        setQrData(qr);
        setLabel(qr.label || "");
        const qrMode = (qr.mode || "REVIEW") as QRMode;
        setMode(qrMode);
        const routing = modeToRouting(qrMode);
        setRoutingGroup(routing.group);
        setLegacyFileMode(!!routing.legacyFile);
        if (routing.section && isBuiltinSection(routing.section)) {
          setSectionTarget(routing.section);
        }
        setCustomSectionId(qr.customSectionId || null);
        if (qr.customSectionId) {
          setSectionTarget(customSectionIdToTarget(qr.customSectionId));
        }
        setRedirectUrl(qr.redirectUrl || "");
        setEstablishmentId(qr.establishmentId || "");
        setTemplateId(qr.templateId || "");
        setIsPro(pro);
        setCenterText(qr.centerText || "");
        setCenterLogoUrl(qr.centerLogoUrl || null);
        setEstablishments(estData.establishments || []);
        const tplList = (tplData.templates || []) as Template[];
        setTemplates(tplList);
        if (!qr.templateId && tplList.length > 0) {
          const defaultTplId = tplList[0].id;
          setTemplateId(defaultTplId);
          fetch("/api/qrcodes", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: qrId, templateId: defaultTplId }),
          }).catch(() => {});
        }
        if (qr.fileAsset) setFileAssetData(qr.fileAsset);
        const estId = qr.establishmentId || qr.establishment?.id;
        if (estId) {
          fetch(`/api/establishments/${estId}/page`)
            .then((r) => r.json())
            .then((res) => {
              if (res.establishment) {
                setPageModules(parsePageModules(res.establishment.pageModules));
                setPreviewMenu(res.establishment.menu ?? null);
                setCustomPages((res.establishment.customPages || []).map((p: { id: string; menuItemLabel: string; enabled: boolean; type?: string }) => ({
                  id: p.id,
                  menuItemLabel: p.menuItemLabel,
                  enabled: p.enabled,
                  type: p.type,
                })));
              }
            })
            .catch(() => {});
        } else if (qr.establishment?.menu) {
          setPreviewMenu(qr.establishment.menu);
          setPageModules(parsePageModules(qr.establishment.pageModules));
        }
        generateQRImage(qr.code, {
          isPro: pro,
          centerText: qr.centerText,
          centerLogoUrl: qr.centerLogoUrl,
        });
        setLoading(false);
      })
      .catch(() => {
        setError("QR-код не найден");
        setLoading(false);
      });
  }, [status, router, qrId, generateQRImage]);

  useEffect(() => {
    if (!qrData) return;
    const timer = setTimeout(() => {
      generateQRImage(qrData.code, {
        isPro,
        centerText: isPro ? centerText : null,
        centerLogoUrl: isPro ? centerLogoUrl : null,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [centerText, centerLogoUrl, isPro, qrData, generateQRImage]);

  const handleDownloadTablePDF = async () => {
    if (!templateId || !qrData) {
      setPdfHint("Для скачивания таблички привяжите шаблон");
      return;
    }

    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl?.layout) {
      setPdfHint("Шаблон не найден");
      return;
    }

    setPdfDownloading(true);
    setPdfHint("");
    try {
      const layout = tpl.layout as { __type?: string; stickerConfig?: StickerConfig; elements?: unknown[] };

      if (layout.__type === "sticker" && layout.stickerConfig) {
        /* ── New sticker renderer ── */
        const cfg: StickerConfig = { ...layout.stickerConfig, url: scanUrlForCode(qrData.code) };
        const fmt = FORMATS.find((f) => f.id === cfg.formatId) || FORMATS[0];
        const canvas = document.createElement("canvas");
        await renderSticker(canvas, cfg, fmt, false);
        const imgData = canvas.toDataURL("image/png", 1.0);
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF({ unit: "mm", format: "a4" });
        // single sticker + cut guides
        const x = (210 - fmt.wMm) / 2;
        const y = (297 - fmt.hMm) / 2;
        doc.addImage(imgData, "PNG", x, y, fmt.wMm, fmt.hMm);
        // dashed cut border
        doc.setDrawColor(180, 180, 180);
        doc.setLineDashPattern([2, 2], 0);
        doc.rect(x - 2, y - 2, fmt.wMm + 4, fmt.hMm + 4);
        doc.save(`sticker-${qrData.code}.pdf`);
      } else {
        /* ── Legacy layout renderer ── */
        const legacyLayout = tpl.layout as TemplateLayout;
        const qrEl = legacyLayout.elements?.find((e) => e.type === "qr");
        const qrDataUrl = await generateQRForPDF(
          scanUrlForCode(qrData.code),
          qrEl?.qrColor || "#1e1b4b",
          qrEl?.qrBgColor || "#ffffff",
          { isPro, centerText: isPro ? centerText : null, centerLogoUrl: isPro ? centerLogoUrl : null }
        );
        await generatePDFFromLayout(legacyLayout, qrDataUrl);
      }
    } catch {
      setPdfHint("Ошибка генерации PDF");
    } finally {
      setPdfDownloading(false);
    }
  };

  useEffect(() => {
    if (!establishmentId) return;
    fetch(`/api/establishments/${establishmentId}/page`)
      .then((r) => r.json())
      .then((res) => {
        if (res.establishment) {
          setPageModules(parsePageModules(res.establishment.pageModules));
          setPreviewMenu(res.establishment.menu ?? null);
          setCustomPages((res.establishment.customPages || []).map((p: { id: string; menuItemLabel: string; enabled: boolean; type?: string }) => ({
            id: p.id,
            menuItemLabel: p.menuItemLabel,
            enabled: p.enabled,
            type: p.type,
          })));
        }
      })
      .catch(() => {});
  }, [establishmentId]);

  const applyRouting = (group: RoutingGroup, section?: SectionTarget, customPageId?: string | null) => {
    setRoutingGroup(group);
    setLegacyFileMode(false);
    if (customPageId) {
      setCustomSectionId(customPageId);
      setSectionTarget(customSectionIdToTarget(customPageId));
    } else if (section && isBuiltinSection(section)) {
      setCustomSectionId(null);
      setSectionTarget(section);
    } else {
      setCustomSectionId(null);
      if (section) setSectionTarget(section);
    }
    setMode(routingToMode(group, section, customPageId || undefined));
  };

  const handleSaveBasic = async () => {
    const saveMode = routingToMode(routingGroup, sectionTarget, customSectionId || undefined);
    if (routingGroup === "REDIRECT" && !redirectUrl.trim()) {
      setError("Укажите URL для редиректа");
      return;
    }
    if ((routingGroup === "LANDING" || routingGroup === "SECTION") && !establishmentId) {
      setError("Привяжите QR-код к заведению");
      return;
    }

    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const payload: Record<string, unknown> = {
        id: qrId,
        label: label || null,
        mode: saveMode,
        redirectUrl: routingGroup === "REDIRECT" ? redirectUrl : null,
        customSectionId: saveMode === "CUSTOM_SECTION" ? (customSectionId || null) : null,
        establishmentId: establishmentId || null,
        templateId: templateId || null,
        centerText: isPro ? (centerText || null) : null,
        centerLogoUrl: isPro ? centerLogoUrl : null,
        tipsType: null,
        tipsPhone: null,
        tipsBankName: null,
      };

      if (establishmentId && !qrData?.establishmentId) {
        payload.isActive = true;
      }

      const res = await fetch("/api/qrcodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Ошибка сохранения");
        return;
      }

      const data = await res.json();
      setQrData(data.qrcode);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);

      generateQRImage(qrData!.code, {
        isPro,
        centerText: isPro ? centerText : null,
        centerLogoUrl: isPro ? centerLogoUrl : null,
      });
    } catch {
      setError("Ошибка соединения");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFileAsset = async (assetData: FileAssetData) => {
    setSaving(true);
    setError("");

    try {
      if (!assetData.id) {
        setError("Сначала загрузите файл");
        return;
      }

      if (assetData.title !== fileAssetData?.title) {
        const res = await fetch("/api/file-assets", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: assetData.id, title: assetData.title }),
        });
        if (!res.ok) {
          const d = await res.json();
          setError(d.error || "Ошибка обновления названия");
          return;
        }
        const d = await res.json();
        setFileAssetData(d.fileAsset);
      }

      await fetch("/api/qrcodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: qrId,
          mode: "FILE",
          fileAssetId: assetData.id,
        }),
      });
      setMode("FILE");
      setRoutingGroup("SECTION");
      setLegacyFileMode(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setSaving(false);
    }
  };

  const handleFileDeleted = async () => {
    setFileAssetData(null);
    await fetch("/api/qrcodes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: qrId, fileAssetId: null }),
    });
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

  if (!qrData) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-lg text-gray-500">{error || "QR-код не найден"}</p>
            <Button onClick={() => router.push("/dashboard/qrcodes")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад к списку
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const previewName =
    qrData.establishment?.name ||
    establishments.find((e) => e.id === establishmentId)?.name ||
    "Заведение";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="w-full space-y-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard/qrcodes")}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Настройка QR-кода
              </h1>
              <p className="text-gray-500 mt-1 font-mono text-sm">
                {qrData.code}
              </p>
            </div>
          </div>

          {showWelcome && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
              <strong>QR готов к работе.</strong> Режим «Микро-лендинг» уже включён — гости увидят страницу
              заведения с отзывами. Скачайте PNG или PDF таблички ниже и проверьте ссылку «Открыть как гость».
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <div className="text-center space-y-3">
                  {qrImageUrl && (
                    <img
                      src={qrImageUrl}
                      alt={`QR ${qrData.code}`}
                      className="w-48 h-48 mx-auto rounded-lg"
                    />
                  )}
                  <a
                    href={qrImageUrl}
                    download={`qr-${qrData.code}.png`}
                    className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    <Download className="w-3 h-3" />
                    Скачать PNG
                  </a>
                </div>
              </Card>

              <Card>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Статус</span>
                    <Badge variant={qrData.isActive ? "success" : "warning"}>
                      {qrData.isActive ? "Активен" : "Неактивен"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Режим</span>
                    <Badge variant="default">
                      {MODE_LABELS[mode]}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Сканирований</span>
                    <span className="font-medium">{qrData.scansCount}</span>
                  </div>
                  {qrData.establishment && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Заведение</span>
                      <span className="font-medium text-right truncate max-w-[140px]">
                        {qrData.establishment.name}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <Card>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Основные настройки
                </h3>
                <div className="space-y-4">
                  <Input
                    label="Метка"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Стол 1, Бар, Вход..."
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Заведение
                    </label>
                    <select
                      value={establishmentId}
                      onChange={(e) => setEstablishmentId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Не привязан (неактивный)</option>
                      {establishments.map((est) => (
                        <option key={est.id} value={est.id}>
                          {est.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                      <Printer className="w-3 h-3" />
                      Шаблон для печати
                    </label>

                    {/* Selected template preview or empty state */}
                    {(() => {
                      const selectedTpl = templates.find((t) => t.id === templateId);
                      const stickerCfg = (selectedTpl?.layout as { stickerConfig?: StickerConfig } | undefined)?.stickerConfig;
                      return (
                        <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50 mb-2">
                          {stickerCfg ? (
                            <StickerMiniPreview cfg={stickerCfg} />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400 text-xs shrink-0">
                              —
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {selectedTpl ? selectedTpl.name : "Шаблон не выбран"}
                            </p>
                            {stickerCfg && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {FORMATS.find((f) => f.id === stickerCfg.formatId)?.name || stickerCfg.formatId}
                                {" · "}
                                {stickerCfg.themeId}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5">
                              <button
                                type="button"
                                onClick={() => setShowTemplatePicker(true)}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5"
                              >
                                {selectedTpl ? "Сменить" : "Выбрать"} <ChevronDown className="w-3 h-3" />
                              </button>
                              {selectedTpl && (
                                <>
                                  <span className="text-gray-300">·</span>
                                  <button
                                    type="button"
                                    onClick={() => router.push(`/dashboard/templates/${selectedTpl.id}`)}
                                    className="text-xs text-gray-500 hover:text-indigo-600"
                                  >
                                    Редактировать
                                  </button>
                                  <span className="text-gray-300">·</span>
                                  <button
                                    type="button"
                                    onClick={() => setTemplateId("")}
                                    className="text-xs text-gray-400 hover:text-red-500"
                                  >
                                    Убрать
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleDownloadTablePDF}
                      disabled={pdfDownloading || !templateId}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      {pdfDownloading ? "Готовим PDF..." : "Скачать PDF табличку"}
                    </Button>
                    {!templateId && (
                      <p className="mt-1 text-xs text-gray-400">Выберите шаблон, чтобы скачать PDF</p>
                    )}
                    {pdfHint && (
                      <p className="mt-1 text-xs text-amber-700">{pdfHint}</p>
                    )}
                  </div>
                </div>
              </Card>

              <Card>
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  Центр QR-кода
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {isPro
                    ? "Настройте текст или логотип в центре QR-кода"
                    : "На бесплатном тарифе в центре отображается qrstars.ru"}
                </p>

                {!isPro ? (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">
                        Надпись: <span className="font-mono font-semibold text-indigo-600">qrstars.ru</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Доступно на PRO-тарифе: свой текст или логотип
                      </p>
                    </div>
                    <Crown className="w-5 h-5 text-amber-500 shrink-0" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Текст в центре
                      </label>
                      <input
                        value={centerText}
                        onChange={(e) => {
                          setCenterText(e.target.value);
                          if (e.target.value) setCenterLogoUrl(null);
                        }}
                        placeholder="Мой бренд"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Если указан логотип — текст игнорируется
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Логотип в центре
                      </label>
                      {centerLogoUrl ? (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
                          <img
                            src={centerLogoUrl}
                            alt="Logo"
                            className="w-12 h-12 object-contain rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700 truncate">Логотип загружен</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCenterLogoUrl(null)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-indigo-400 cursor-pointer transition-colors">
                          <Upload className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-500">
                            {uploading ? "Загрузка..." : "Загрузить логотип"}
                          </span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            className="hidden"
                            disabled={uploading}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploading(true);
                              try {
                                const fd = new FormData();
                                fd.append("file", file);
                                fd.append("qrId", qrId);
                                const res = await fetch("/api/upload", {
                                  method: "POST",
                                  body: fd,
                                });
                                const data = await res.json();
                                if (!res.ok) {
                                  setError(data.error || "Ошибка загрузки");
                                  return;
                                }
                                setCenterLogoUrl(data.logoUrl);
                                setCenterText("");
                              } catch {
                                setError("Ошибка загрузки файла");
                              } finally {
                                setUploading(false);
                              }
                            }}
                          />
                        </label>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        PNG, JPEG, WebP или SVG, до 2 МБ
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-2">Предпросмотр:</p>
                  <div className="flex justify-center">
                    {qrImageUrl && (
                      <img
                        src={qrImageUrl}
                        alt="QR preview"
                        className="w-32 h-32 rounded-lg"
                      />
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-4">
              <Card>
                <h3 className="font-semibold text-gray-900 mb-2">Режим работы</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Куда попадёт гость при сканировании этой наклейки
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ROUTING_GROUPS.map((g) => {
                    const selected = routingGroup === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => applyRouting(g.id, sectionTarget)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                          selected
                            ? "border-indigo-600 bg-indigo-50"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg ${
                              selected ? "bg-indigo-600" : "bg-gray-100"
                            }`}
                          >
                            {g.emoji}
                          </div>
                          <div>
                            <p className={`font-semibold ${selected ? "text-indigo-900" : "text-gray-900"}`}>
                              {g.label}
                            </p>
                            <p className={`text-sm mt-0.5 ${selected ? "text-indigo-700" : "text-gray-500"}`}>
                              {g.desc}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {routingGroup === "LANDING" && (
                  <div className="mt-4 p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                    <p className="text-sm text-indigo-900 mb-3">
                      Контент страницы настраивается один раз для всего заведения
                    </p>
                    <Link href="/dashboard/my-page">
                      <Button type="button" variant="secondary" size="sm">
                        <Layout className="w-4 h-4 mr-2" />
                        Редактировать контент страницы
                      </Button>
                    </Link>
                  </div>
                )}

                {routingGroup === "SECTION" && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Открыть раздел
                    </label>
                    <select
                      value={customSectionId ? customSectionIdToTarget(customSectionId) : (isBuiltinSection(sectionTarget) ? sectionTarget : "REVIEW")}
                      onChange={(e) => {
                        const val = e.target.value;
                        const cId = targetToCustomPageId(val);
                        if (cId) {
                          applyRouting("SECTION", undefined, cId);
                        } else {
                          applyRouting("SECTION", val as BuiltinSectionTarget, null);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <optgroup label="Основные разделы">
                        {BUILTIN_SECTION_OPTIONS.map((opt) => {
                          const moduleKey =
                            opt.value === "BUSINESS_CARD"
                              ? "businessCard"
                              : opt.value === "TIPS"
                                ? "tips"
                                : opt.value.toLowerCase();
                          const hiddenOnLanding = !pageModules[moduleKey as keyof PageModules];
                          return (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}{hiddenOnLanding ? " (скрыт на лендинге)" : ""}
                            </option>
                          );
                        })}
                      </optgroup>
                      {customPages.length > 0 && (
                        <optgroup label="Кастомные страницы">
                          {customPages.map((cp) => (
                            <option key={cp.id} value={customSectionIdToTarget(cp.id)}>
                              {cp.menuItemLabel}
                              {cp.type === "FILE" ? " · файл" : ""}
                              {!cp.enabled ? " (скрыта на лендинге)" : ""}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    {(() => {
                      const hiddenBuiltin =
                        !customSectionId &&
                        isBuiltinSection(sectionTarget) &&
                        (() => {
                          const mk =
                            sectionTarget === "BUSINESS_CARD"
                              ? "businessCard"
                              : sectionTarget === "TIPS"
                                ? "tips"
                                : sectionTarget.toLowerCase();
                          return !pageModules[mk as keyof PageModules];
                        })();
                      const hiddenCustom =
                        customSectionId &&
                        !customPages.find((p) => p.id === customSectionId)?.enabled;
                      if (!hiddenBuiltin && !hiddenCustom) return null;
                      return (
                        <p className="text-xs text-indigo-600 mt-1">
                          Раздел скрыт на микро-лендинге, но откроется по этому QR-коду.
                        </p>
                      );
                    })()}
                    <p className="text-xs text-gray-400 mt-2">
                      Контент раздела — в{" "}
                      <Link href="/dashboard/my-page" className="text-indigo-600 hover:underline">
                        Моей странице
                      </Link>
                    </p>
                  </div>
                )}

                {routingGroup === "REDIRECT" && (
                  <div className="mt-4">
                    <Input
                      label="URL для редиректа"
                      value={redirectUrl}
                      onChange={(e) => setRedirectUrl(e.target.value)}
                      placeholder="https://example.com"
                    />
                  </div>
                )}

                {legacyFileMode && (
                  <div className="mt-4 space-y-3">
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 text-sm text-amber-900">
                      Режим «Скачать файл» устарел. Создайте страницу типа «Скачать файл» в{" "}
                      <Link href="/dashboard/my-page" className="font-medium underline">
                        Моей странице
                      </Link>{" "}
                      и выберите её в «Быстрый доступ».
                    </div>
                    <FileAssetEditor
                      initialData={fileAssetData}
                      onSave={handleSaveFileAsset}
                      onDelete={handleFileDeleted}
                      saving={saving}
                    />
                  </div>
                )}

                {error && (
                  <div className="mt-4 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {!legacyFileMode && (
                  <div className="mt-6 flex items-center gap-3">
                    <Button onClick={handleSaveBasic} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Сохранение...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Сохранить маршрут
                        </>
                      )}
                    </Button>
                    {saved && (
                      <span className="text-sm text-green-600 font-medium">Сохранено!</span>
                    )}
                  </div>
                )}
              </Card>
            </div>

            <div className="xl:col-span-1">
              <Card className="sticky top-8">
                <RoutingPreview
                  routingGroup={routingGroup}
                  section={routingGroup === "SECTION" ? sectionTarget : undefined}
                  establishmentName={previewName}
                  establishmentId={establishmentId || undefined}
                  pageModules={pageModules}
                  menu={previewMenu}
                  redirectUrl={redirectUrl}
                  hasFile={!!fileAssetData?.id}
                  customPageLabel={customSectionId ? customPages.find((p) => p.id === customSectionId)?.menuItemLabel ?? null : null}
                />
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* ── Template picker modal ── */}
      {showTemplatePicker && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-lg">Выбрать шаблон</h3>
              <button onClick={() => setShowTemplatePicker(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              {templates.filter((t) => (t.layout as { __type?: string }).__type === "sticker").length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-gray-500 mb-3">Нет сохранённых шаблонов</p>
                  <button
                    onClick={() => { setShowTemplatePicker(false); router.push("/dashboard/templates"); }}
                    className="text-indigo-600 hover:underline text-sm font-medium"
                  >
                    Создать первый шаблон →
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {/* No template option */}
                  <button
                    onClick={() => { setTemplateId(""); setShowTemplatePicker(false); }}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      !templateId ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">—</div>
                    <span className="text-xs text-gray-600 font-medium">Без шаблона</span>
                  </button>

                  {templates
                    .filter((t) => (t.layout as { __type?: string }).__type === "sticker")
                    .map((t) => {
                      const cfg = (t.layout as { stickerConfig?: StickerConfig }).stickerConfig || DEFAULT_STICKER_CONFIG;
                      return (
                        <button
                          key={t.id}
                          onClick={() => { setTemplateId(t.id); setShowTemplatePicker(false); }}
                          className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                            templateId === t.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="rounded-lg overflow-hidden shadow-sm">
                            <StickerMiniPreview cfg={cfg} size={80} />
                          </div>
                          <span className="text-xs text-gray-700 font-medium text-center leading-tight line-clamp-2">{t.name}</span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-between items-center">
              <button
                onClick={() => { setShowTemplatePicker(false); router.push("/dashboard/templates"); }}
                className="text-sm text-indigo-600 hover:underline"
              >
                + Создать новый шаблон
              </button>
              <button onClick={() => setShowTemplatePicker(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Mini canvas preview (shared helper) ── */
function StickerMiniPreview({ cfg, size = 56 }: { cfg: StickerConfig; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const fmt = FORMATS.find((f) => f.id === cfg.formatId) || FORMATS[0];

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const thumbFmt = { ...fmt, previewW: size, previewH: size, dpi: 72 };
    renderSticker(c, cfg, thumbFmt, true).catch(() => {});
  }, [cfg, fmt, size]);

  return (
    <canvas
      ref={ref}
      style={{ display: "block", width: size, height: size }}
    />
  );
}
