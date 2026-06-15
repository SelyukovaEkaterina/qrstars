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
  X,
  Layout,
  ChevronDown,
  QrCode,
  LayoutTemplate,
} from "lucide-react";
import Link from "next/link";
import { qrPreviewDataUrl } from "@/lib/qr-preview";
import { generatePDFFromLayout, generateQRForPDF } from "@/lib/pdf-generator";
import { calcA4StickerGrid } from "@/lib/a4-sticker-grid";
import { scanUrlForCode } from "@/lib/utils";
import type { TemplateLayout } from "@/types/template";
import {
  renderSticker,
  FORMATS,
  DEFAULT_STICKER_CONFIG,
  type StickerConfig,
} from "@/components/dashboard/StickerDesigner";
import {
  QR_CODE_TEMPLATES,
  renderQRTemplate,
  canvasDisplaySize,
  normalizeQRTemplateConfig,
  qrStylePresetTemplateId,
  resolveQrStyleConfig,
  resolveQrStyleName,
  type QRTemplateConfig,
  type QrStyleTemplateSource,
} from "@/lib/qr-code-templates";
import { downloadQrCode, QR_EXPORT_SIZE } from "@/lib/qr-download";
import {
  BUILTIN_STICKER_TEMPLATES,
  builtinStickerTemplateRows,
  isBuiltInStickerTemplateId,
  resolveStickerTemplate,
  stickerPresetTemplateId,
} from "@/lib/builtin-sticker-templates";
import { TEMPLATE_ROUTES } from "@/lib/template-routes";

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
  qrStyleTemplateId: string | null;
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

/** Placeholder code for QR preview before the code is created in the DB */
const CREATE_PREVIEW_CODE = "__preview__";

export default function QRCodeSettingsPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const qrId = params.id as string;
  const isCreateMode = qrId === "new";

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
  const [qrStyleTemplateId, setQrStyleTemplateId] = useState("");

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
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [qrDownloading, setQrDownloading] = useState(false);
  const [pdfHint, setPdfHint] = useState("");
  const [qrHint, setQrHint] = useState("");
  const [showTableTemplatePicker, setShowTableTemplatePicker] = useState(false);
  const [showQrStyleTemplatePicker, setShowQrStyleTemplatePicker] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const generateQRImage = useCallback(
    async (code: string, styleTemplateId: string, styleTemplates: Template[]) => {
      const url = await qrPreviewDataUrl(scanUrlForCode(code), {
        qrStyleTemplateId: styleTemplateId || null,
        qrStyleTemplates: styleTemplates,
        isPro,
        size: 512,
      });
      setQrImageUrl(url);
    },
    [isPro],
  );

  const persistQrStyleTemplate = useCallback(
    async (nextId: string) => {
      setQrStyleTemplateId(nextId);
      if (isCreateMode) return;
      try {
        const res = await fetch("/api/qrcodes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: qrId, qrStyleTemplateId: nextId || null }),
        });
        if (res.ok) {
          const data = await res.json();
          setQrData((prev) => (prev ? { ...prev, qrStyleTemplateId: data.qrcode.qrStyleTemplateId } : prev));
        }
      } catch {
        /* ignore — user can save manually */
      }
    },
    [qrId, isCreateMode],
  );

  const persistTableTemplate = useCallback(
    async (nextId: string) => {
      setTemplateId(nextId);
      if (isCreateMode) return;
      try {
        const res = await fetch("/api/qrcodes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: qrId, templateId: nextId || null }),
        });
        if (res.ok) {
          const data = await res.json();
          setQrData((prev) => (prev ? { ...prev, templateId: data.qrcode.templateId } : prev));
        }
      } catch {
        /* ignore */
      }
    },
    [qrId, isCreateMode],
  );

  useEffect(() => {
    setShowWelcome(new URLSearchParams(window.location.search).get("welcome") === "1");
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;

    if (isCreateMode) {
      const estFromUrl = new URLSearchParams(window.location.search).get("est") || "";

      Promise.all([
        fetch("/api/establishments").then((r) => r.json()),
        fetch("/api/templates").then((r) => r.json()),
        fetch("/api/qrcodes").then((r) => r.json()),
      ])
        .then(([estData, tplData, qrListData]) => {
          const tplList = (tplData.templates || []) as Template[];
          const estList = (estData.establishments || []) as Establishment[];
          const estMatch = estList.find((e) => e.id === estFromUrl);
          setEstablishments(estList);
          setTemplates(tplList);
          setIsPro(qrListData.isPro || false);
          setEstablishmentId(estFromUrl);
          setRoutingGroup("LANDING");
          setMode("LANDING");
          setQrData({
            id: "",
            code: CREATE_PREVIEW_CODE,
            label: null,
            isActive: false,
            mode: "LANDING",
            redirectUrl: null,
            customSectionId: null,
            scansCount: 0,
            establishmentId: estFromUrl || null,
            templateId: null,
            qrStyleTemplateId: null,
            establishment: estMatch ? { id: estMatch.id, name: estMatch.name } : null,
            fileAsset: null,
          });
          const defaultSticker = stickerPresetTemplateId(BUILTIN_STICKER_TEMPLATES[0].id);
          setTemplateId(defaultSticker);
          generateQRImage(CREATE_PREVIEW_CODE, "", tplList);
          setLoading(false);
        })
        .catch(() => {
          setError("Не удалось загрузить данные. Обновите страницу.");
          setLoading(false);
        });
      return;
    }

    Promise.all([
      fetch(`/api/qrcodes?id=${qrId}`).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          const err = new Error(r.status === 404 ? "NOT_FOUND" : "LOAD_FAILED");
          (err as Error & { detail?: string }).detail =
            typeof body.error === "string" ? body.error : "";
          throw err;
        }
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
        setQrStyleTemplateId(qr.qrStyleTemplateId || "");
        setIsPro(pro);
        setEstablishments(estData.establishments || []);
        const tplList = (tplData.templates || []) as Template[];
        setTemplates(tplList);
        if (!qr.templateId) {
          const defaultSticker = tplList.find(
            (t) => (t.layout as { __type?: string }).__type === "sticker"
          );
          if (defaultSticker) {
            setTemplateId(defaultSticker.id);
            fetch("/api/qrcodes", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: qrId, templateId: defaultSticker.id }),
            }).catch(() => {});
          }
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
        generateQRImage(qr.code, qr.qrStyleTemplateId || "", tplList);
        setLoading(false);
      })
      .catch((e: Error & { detail?: string }) => {
        if (e.message === "LOAD_FAILED" && e.detail?.includes("qrStyleTemplate")) {
          setError(
            "Не удалось загрузить QR: устарел Prisma Client. Выполните npx prisma generate и перезапустите npm run dev.",
          );
        } else if (e.message === "NOT_FOUND") {
          setError("QR-код не найден");
        } else {
          setError("Не удалось загрузить QR-код. Обновите страницу или попробуйте позже.");
        }
        setLoading(false);
      });
  }, [status, router, qrId, generateQRImage, isCreateMode]);

  useEffect(() => {
    if (!qrData) return;
    const timer = setTimeout(() => {
      generateQRImage(qrData.code, qrStyleTemplateId, templates);
    }, 200);
    return () => clearTimeout(timer);
  }, [qrStyleTemplateId, isPro, qrData, templates, generateQRImage]);

  const stickerTemplates = [
    ...builtinStickerTemplateRows(),
    ...templates.filter(
      (t) =>
        (t.layout as { __type?: string }).__type === "sticker"
        && !isBuiltInStickerTemplateId(t.id),
    ),
  ];
  const qrStyleTemplates = templates.filter(
    (t) => (t.layout as { __type?: string }).__type === "qr-style"
  );

  const getEnhancedStickerConfig = useCallback((baseCfg: StickerConfig): StickerConfig => {
    const qrStyle = resolveQrStyleConfig(qrStyleTemplateId, qrStyleTemplates);
    if (!qrStyle) return baseCfg;
    return { ...baseCfg, qrStyleConfig: qrStyle };
  }, [qrStyleTemplateId, qrStyleTemplates]);
  const userQrStyleTemplates = qrStyleTemplates.filter((t) => !t.id.startsWith("qr-preset-"));

  const handleDownloadQR = async (format: "png" | "svg") => {
    if (!qrData) return;
    if (isCreateMode) {
      setQrHint("Сначала создайте QR-код");
      return;
    }
    setQrDownloading(true);
    setQrHint("");
    try {
      const payload = scanUrlForCode(qrData.code);
      await downloadQrCode(format, payload, `qr-${qrData.code}`, {
        qrStyleTemplateId,
        qrStyleTemplates,
        isPro,
        size: QR_EXPORT_SIZE,
      });
    } catch {
      setQrHint("Ошибка генерации QR-кода");
    } finally {
      setQrDownloading(false);
    }
  };

  const handleDownloadTablePDF = async () => {
    if (isCreateMode) {
      setPdfHint("Сначала создайте QR-код");
      return;
    }
    if (!templateId || !qrData) {
      setPdfHint("Для скачивания таблички привяжите шаблон");
      return;
    }

    const resolved = resolveStickerTemplate(templateId, templates);
    if (!resolved?.layout) {
      setPdfHint("Шаблон не найден");
      return;
    }

    setPdfDownloading(true);
    setPdfHint("");
    try {
      const layout = resolved.layout as { __type?: string; stickerConfig?: StickerConfig; elements?: unknown[] };

      if (layout.__type === "sticker" && layout.stickerConfig) {
        /* ── New sticker renderer ── */
        const baseCfg: StickerConfig = { ...layout.stickerConfig, url: scanUrlForCode(qrData.code) };
        const cfg = getEnhancedStickerConfig(baseCfg);
        const fmt = FORMATS.find((f) => f.id === cfg.formatId) || FORMATS[0];
        const canvas = document.createElement("canvas");
        await renderSticker(canvas, cfg, fmt, false);
        const imgData = canvas.toDataURL("image/png", 1.0);
        const { jsPDF } = await import("jspdf");
        const grid = calcA4StickerGrid(fmt.id, fmt.wMm, fmt.hMm);
        const doc = new jsPDF({ unit: "mm", format: "a4", orientation: grid.orientation });
        const { cols, rows, marginX, marginY, spacing } = grid;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = marginX + c * (fmt.wMm + spacing);
            const y = marginY + r * (fmt.hMm + spacing);

            // Add sticker image
            doc.addImage(imgData, "PNG", x, y, fmt.wMm, fmt.hMm);

            // Draw dashed cut border
            doc.setDrawColor(180, 180, 180);
            doc.setLineDashPattern([2, 2], 0);
            doc.rect(x, y, fmt.wMm, fmt.hMm);
          }
        }

        doc.save(`sticker-${qrData.code}.pdf`);
      } else {
        /* ── Legacy layout renderer ── */
        const legacyLayout = resolved.layout as unknown as TemplateLayout;
        const qrEl = legacyLayout.elements?.find((e) => e.type === "qr");
        const qrDataUrl = await generateQRForPDF(
          scanUrlForCode(qrData.code),
          qrEl?.qrColor || "#1e1b4b",
          qrEl?.qrBgColor || "#ffffff",
          { isPro },
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
      if (isCreateMode) {
        const postRes = await fetch("/api/qrcodes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: label || undefined,
            mode: saveMode,
            redirectUrl: routingGroup === "REDIRECT" ? redirectUrl : undefined,
            establishmentId: establishmentId || undefined,
          }),
        });
        const postData = await postRes.json();
        if (!postRes.ok) {
          setError(postData.error || "Ошибка создания");
          return;
        }

        const newId = postData.qrcode?.id as string | undefined;
        if (!newId) {
          setError("Не удалось создать QR-код");
          return;
        }

        const putRes = await fetch("/api/qrcodes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: newId,
            templateId: templateId || null,
            qrStyleTemplateId: qrStyleTemplateId || null,
            customSectionId: saveMode === "CUSTOM_SECTION" ? (customSectionId || null) : null,
            tipsType: null,
            tipsPhone: null,
            tipsBankName: null,
          }),
        });
        if (!putRes.ok) {
          const putData = await putRes.json();
          setError(putData.error || "QR создан, но не все настройки сохранились");
          router.replace(`/dashboard/qrcodes/${newId}`);
          return;
        }

        router.replace(`/dashboard/qrcodes/${newId}`);
        return;
      }

      const payload: Record<string, unknown> = {
        id: qrId,
        label: label || null,
        mode: saveMode,
        redirectUrl: routingGroup === "REDIRECT" ? redirectUrl : null,
        customSectionId: saveMode === "CUSTOM_SECTION" ? (customSectionId || null) : null,
        establishmentId: establishmentId || null,
        templateId: templateId || null,
        qrStyleTemplateId: qrStyleTemplateId || null,
        tipsType: null,
        tipsPhone: null,
        tipsBankName: null,
      };

      payload.isActive = true;

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

      generateQRImage(qrData!.code, qrStyleTemplateId, templates);
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

  if (!isCreateMode && !qrData) {
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

  if (!qrData) {
    return null;
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
                {isCreateMode ? "Новый QR-код" : "Настройка QR-кода"}
              </h1>
              <p className="text-gray-500 mt-1 text-sm">
                {isCreateMode
                  ? "Настройте маршрут и оформление, затем создайте код"
                  : <span className="font-mono">{qrData.code}</span>}
              </p>
            </div>
          </div>

          {showWelcome && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
              <strong>QR готов к работе.</strong> Режим «Микро-лендинг» уже включён — гости увидят страницу
              заведения с отзывами. Скачайте QR-код или табличку ниже и проверьте ссылку «Открыть как гость».
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <Card padding="sm">
                <div className="flex items-center justify-center min-h-[220px]">
                  {qrImageUrl && (
                    <img
                      src={qrImageUrl}
                      alt={`QR ${qrData.code}`}
                      className="max-w-full max-h-64 w-auto h-auto rounded-lg object-contain"
                    />
                  )}
                </div>
              </Card>

              <Card>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Статус</span>
                    <Badge variant={isCreateMode ? "default" : qrData.isActive ? "success" : "warning"}>
                      {isCreateMode ? "Черновик" : qrData.isActive ? "Активен" : "Неактивен"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Режим</span>
                    <Badge variant="default">
                      {MODE_LABELS[mode]}
                    </Badge>
                  </div>
                  {!isCreateMode && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Сканирований</span>
                      <span className="font-medium">{qrData.scansCount}</span>
                    </div>
                  )}
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

                  <div className="border-t border-gray-100 pt-4 space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <QrCode className="w-3.5 h-3.5" />
                        Шаблон QR-кода
                      </label>
                      {(() => {
                        const selectedName = resolveQrStyleName(qrStyleTemplateId, qrStyleTemplates);
                        const config = resolveQrStyleConfig(qrStyleTemplateId, qrStyleTemplates);
                        return (
                          <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50 mb-2">
                            {config ? (
                              <QRStyleMiniPreview config={config} payload={scanUrlForCode(qrData.code)} />
                            ) : (
                              <div className="w-14 h-14 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400 text-xs shrink-0">
                                —
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {selectedName ?? "Стандартный QR"}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {selectedName
                                  ? "Стиль, логотип и рамка — в редакторе шаблона"
                                  : "Без шаблона — стандартный QR с водяным знаком"}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => setShowQrStyleTemplatePicker(true)}
                                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5"
                                >
                                  {selectedName ? "Сменить" : "Выбрать"} <ChevronDown className="w-3 h-3" />
                                </button>
                                {selectedName && (
                                  <>
                                    <span className="text-gray-300">·</span>
                                    <button
                                      type="button"
                                      onClick={() => void persistQrStyleTemplate("")}
                                      className="text-xs text-gray-400 hover:text-red-500"
                                    >
                                      Убрать
                                    </button>
                                  </>
                                )}
                                <span className="text-gray-300">·</span>
                                <Link
                                  href={TEMPLATE_ROUTES.qr}
                                  className="text-xs text-gray-500 hover:text-indigo-600"
                                >
                                  Шаблоны QR-кода →
                                </Link>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleDownloadQR("png")}
                          disabled={qrDownloading}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          {qrDownloading ? "Готовим..." : "PNG"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleDownloadQR("svg")}
                          disabled={qrDownloading}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          SVG
                        </Button>
                      </div>
                      {qrHint && (
                        <p className="mt-1 text-xs text-amber-700">{qrHint}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <LayoutTemplate className="w-3.5 h-3.5" />
                        Шаблон таблички
                      </label>
                      {(() => {
                        const selectedTpl = stickerTemplates.find((t) => t.id === templateId);
                        const stickerCfg = (selectedTpl?.layout as { stickerConfig?: StickerConfig } | undefined)?.stickerConfig;
                        return (
                          <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50 mb-2">
                            {stickerCfg ? (
                              <StickerMiniPreview cfg={getEnhancedStickerConfig({ ...stickerCfg, url: scanUrlForCode(qrData.code) })} />
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
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => setShowTableTemplatePicker(true)}
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
                                      onClick={() => void persistTableTemplate("")}
                                      className="text-xs text-gray-400 hover:text-red-500"
                                    >
                                      Убрать
                                    </button>
                                  </>
                                )}
                                <span className="text-gray-300">·</span>
                                <Link
                                  href={TEMPLATE_ROUTES.tableTents}
                                  className="text-xs text-gray-500 hover:text-indigo-600"
                                >
                                  Шаблоны таблички →
                                </Link>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={handleDownloadTablePDF}
                          disabled={pdfDownloading || !templateId}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          {pdfDownloading ? "Готовим PDF..." : "Скачать табличку"}
                        </Button>
                      </div>
                      {!templateId && (
                        <p className="mt-1 text-xs text-gray-400">Выберите шаблон таблички, чтобы скачать PDF</p>
                      )}
                      {pdfHint && (
                        <p className="mt-1 text-xs text-amber-700">{pdfHint}</p>
                      )}
                    </div>
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
                          {isCreateMode ? "Создаём..." : "Сохранение..."}
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          {isCreateMode ? "Создать QR-код" : "Сохранить маршрут"}
                        </>
                      )}
                    </Button>
                    {saved && !isCreateMode && (
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

      {/* ── QR style template picker ── */}
      {showQrStyleTemplatePicker && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-lg">Шаблон QR-кода</h3>
              <button onClick={() => setShowQrStyleTemplatePicker(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => { void persistQrStyleTemplate(""); setShowQrStyleTemplatePicker(false); }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    !qrStyleTemplateId ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">—</div>
                  <span className="text-xs text-gray-600 font-medium">Стандартный</span>
                </button>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Готовые стили</p>
                <div className="grid grid-cols-3 gap-3">
                  {QR_CODE_TEMPLATES.map((preset) => {
                    const id = qrStylePresetTemplateId(preset.id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => { void persistQrStyleTemplate(id); setShowQrStyleTemplatePicker(false); }}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          qrStyleTemplateId === id ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="rounded-lg overflow-hidden shadow-sm">
                          <QRStyleMiniPreview config={preset.config} payload={scanUrlForCode(qrData?.code || "demo")} size={80} />
                        </div>
                        <span className="text-xs text-gray-700 font-medium text-center leading-tight">{preset.name}</span>
                        <span className="text-[10px] text-gray-400 text-center leading-tight line-clamp-2">{preset.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {userQrStyleTemplates.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Мои шаблоны</p>
                  <div className="grid grid-cols-3 gap-3">
                    {userQrStyleTemplates.map((t) => {
                      const config = (t.layout as { config?: QRTemplateConfig }).config;
                      if (!config) return null;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => { void persistQrStyleTemplate(t.id); setShowQrStyleTemplatePicker(false); }}
                          className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                            qrStyleTemplateId === t.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="rounded-lg overflow-hidden shadow-sm">
                            <QRStyleMiniPreview config={config} payload={scanUrlForCode(qrData?.code || "demo")} size={80} />
                          </div>
                          <span className="text-xs text-gray-700 font-medium text-center leading-tight line-clamp-2">{t.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-between items-center">
              <Link
                href={TEMPLATE_ROUTES.qr}
                onClick={() => setShowQrStyleTemplatePicker(false)}
                className="text-sm text-indigo-600 hover:underline"
              >
                + Создать шаблон QR-кода
              </Link>
              <button onClick={() => setShowQrStyleTemplatePicker(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Table template picker ── */}
      {showTableTemplatePicker && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-lg">Шаблон таблички</h3>
              <button onClick={() => setShowTableTemplatePicker(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => { void persistTableTemplate(""); setShowTableTemplatePicker(false); }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    !templateId ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">—</div>
                  <span className="text-xs text-gray-600 font-medium">Без шаблона</span>
                </button>
                {stickerTemplates.map((t) => {
                    const cfg = (t.layout as { stickerConfig?: StickerConfig }).stickerConfig || DEFAULT_STICKER_CONFIG;
                    return (
                      <button
                        key={t.id}
                        onClick={() => { void persistTableTemplate(t.id); setShowTableTemplatePicker(false); }}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          templateId === t.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="rounded-lg overflow-hidden shadow-sm">
                          <StickerMiniPreview cfg={getEnhancedStickerConfig({ ...cfg, url: scanUrlForCode(qrData?.code || "demo") })} size={80} />
                        </div>
                        <span className="text-xs text-gray-700 font-medium text-center leading-tight line-clamp-2">{t.name}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-between items-center">
              <Link
                href={TEMPLATE_ROUTES.tableTents}
                onClick={() => setShowTableTemplatePicker(false)}
                className="text-sm text-indigo-600 hover:underline"
              >
                + Создать шаблон таблички
              </Link>
              <button onClick={() => setShowTableTemplatePicker(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
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
function QRStyleMiniPreview({
  config,
  payload,
  size = 56,
}: {
  config: QRTemplateConfig;
  payload: string;
  size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: size, height: size });

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    renderQRTemplate(c, normalizeQRTemplateConfig(config), payload, size * 2)
      .then(() => setDisplaySize(canvasDisplaySize(c.width, c.height, size)))
      .catch(() => {});
  }, [config, payload, size]);

  return (
    <canvas
      ref={ref}
      style={{ display: "block", width: displaySize.width, height: displaySize.height }}
    />
  );
}

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
