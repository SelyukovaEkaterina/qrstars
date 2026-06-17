"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { downloadQrCode, QR_EXPORT_SIZE } from "@/lib/qr-download";
import { generateQRWithCenter } from "@/lib/qr-generator";
import { calcA4StickerGrid } from "@/lib/a4-sticker-grid";
import { scanUrlForCode } from "@/lib/utils";
import { trackEvent } from "@/lib/track-event";
import {
  orderSetupIntents,
  parseSetupUtmContext,
} from "@/lib/setup-utm-intent";
import {
  renderSticker,
  FORMATS,
  type StickerConfig,
} from "@/components/dashboard/StickerDesigner";
import {
  BUILTIN_STICKER_TEMPLATES,
  stickerPresetLayout,
} from "@/lib/builtin-sticker-templates";
import {
  Store,
  MapPin,
  QrCode,
  CheckCircle2,
  Check,
  Bell,
  MessageCircle,
  ExternalLink,
  Download,
  ArrowRight,
  Sparkles,
  Star,
  LayoutGrid,
  ChevronLeft,
  ArrowUpRight,
  Printer,
  FileText,
  Palette,
  type LucideIcon,
} from "lucide-react";

export type SetupIntent = "reviews" | "landing" | "redirect";

const ONBOARDING_TEMPLATES = BUILTIN_STICKER_TEMPLATES.map((preset) => ({
  id: preset.id,
  name: preset.shortName,
  size: preset.sizeLabel,
  desc: preset.description,
  formatId: preset.stickerConfig.formatId,
  config: {
    url: "",
    ...preset.stickerConfig,
  } as StickerConfig,
}));

function qrPreviewOptions(intent: SetupIntent | null): { isPro: boolean; skipWatermark?: boolean } {
  return {
    isPro: false,
    skipWatermark: intent === "reviews",
  };
}

function StickerOnboardingPreview({
  cfg,
  code,
}: {
  cfg: StickerConfig;
  code: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const fmt = FORMATS.find((f) => f.id === cfg.formatId) || FORMATS[0];

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const maxPx = 200;
    const scale = maxPx / Math.max(fmt.previewW, fmt.previewH);
    const previewFmt = {
      ...fmt,
      previewW: Math.round(fmt.previewW * scale),
      previewH: Math.round(fmt.previewH * scale),
      dpi: 72,
    };

    const url = scanUrlForCode(code);
    const renderCfg = { ...cfg, url };

    renderSticker(canvas, renderCfg, previewFmt, true).catch(() => {});
  }, [cfg, code, fmt]);

  const displayW = Math.round((160 * fmt.previewW) / Math.max(fmt.previewW, fmt.previewH));
  const displayH = Math.round((160 * fmt.previewH) / Math.max(fmt.previewW, fmt.previewH));

  return (
    <div className="flex items-center justify-center p-3 bg-slate-50 border border-slate-100 rounded-2xl shadow-inner max-w-[220px] mx-auto">
      <canvas
        ref={ref}
        className="rounded-lg shadow-md max-w-full h-auto object-contain"
        style={{ width: `${displayW}px`, height: `${displayH}px` }}
      />
    </div>
  );
}

const INTENT_OPTIONS: {
  id: SetupIntent;
  title: string;
  tagline: string;
  icon: LucideIcon;
  accent: string;
  iconWrap: string;
  features: string[];
}[] = [
  {
    id: "reviews",
    title: "Умный сбор отзывов",
    tagline: "Защита репутации на картах",
    icon: Star,
    accent: "hover:border-amber-300 hover:shadow-amber-100/80 group-hover:ring-amber-200",
    iconWrap: "bg-gradient-to-br from-amber-100 to-orange-50 text-amber-700 ring-amber-200/60",
    features: [
      "Гость ставит оценку 1–5★ сразу после сканирования",
      "4–5★ — предлагаем оставить отзыв на Яндекс.Картах",
      "1–3★ — жалоба отправляется вам, а не в открытый доступ",
      "Все оценки и отзывы сохраняются в личном кабинете",
      "Уведомления о новых отзывах в Telegram, MAX или на email",
      "На тарифе PRO: свои сценарии и другие площадки (2GIS, Flamp)",
    ],
  },
  {
    id: "landing",
    title: "Сайт-визитка заведения",
    tagline: "Всё важное в одном QR-коде",
    icon: LayoutGrid,
    accent: "hover:border-indigo-400 hover:shadow-indigo-100/80 group-hover:ring-indigo-300",
    iconWrap: "bg-gradient-to-br from-indigo-100 to-violet-50 text-indigo-700 ring-indigo-200/60",
    features: [
      "Мобильная страница в фирменном стиле заведения",
      "Меню, контакты, соцсети и пароль от Wi‑Fi в одном месте",
      "Сбор отзывов можно включить прямо на визитке",
      "Простой визуальный редактор — справится каждый",
      "Позже можно создать отдельные QR-коды для каждого раздела",
    ],
  },
  {
    id: "redirect",
    title: "Прямая ссылка (редирект)",
    tagline: "Перенаправление на ваш сайт или соцсеть",
    icon: ArrowUpRight,
    accent: "hover:border-emerald-300 hover:shadow-emerald-100/80 group-hover:ring-emerald-200",
    iconWrap: "bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 ring-emerald-200/60",
    features: [
      "Мгновенный переход по вашей ссылке при сканировании",
      "Ссылку можно менять в любой момент — без перепечатки QR",
      "Подходит для сайта, Telegram-канала, соцсетей или приложения",
      "Встроенный конструктор дизайна: цвета, логотип, форма QR",
      "Позже можно переключить на визитку или сбор отзывов",
    ],
  },
];

function SetupWizardShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 flex items-center justify-center px-4 py-10 sm:py-14">
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-indigo-200/40 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 translate-x-1/3 rounded-full bg-violet-200/30 blur-3xl"
        aria-hidden
      />
      <div className="relative w-full">{children}</div>
    </div>
  );
}

function IntentOptionCard({
  option,
  onSelect,
  recommended = false,
  secondary = false,
}: {
  option: (typeof INTENT_OPTIONS)[number];
  onSelect: () => void;
  recommended?: boolean;
  secondary?: boolean;
}) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex h-full flex-col rounded-2xl border bg-white/90 p-6 text-left shadow-sm backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
        recommended
          ? "border-amber-300 ring-2 ring-amber-200/80 shadow-amber-100/80"
          : secondary
            ? "border-slate-200/70 opacity-90 hover:opacity-100"
            : "border-slate-200/90"
      } ${option.accent}`}
    >
      {recommended && (
        <span className="absolute -top-2.5 left-4 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
          Рекомендуем
        </span>
      )}
      <div className="mb-4 flex items-start gap-3">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 ${option.iconWrap}`}
        >
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-base font-bold text-slate-900 leading-snug">{option.title}</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-500">{option.tagline}</p>
        </div>
      </div>
      <ul className="mb-5 flex-1 space-y-2">
        {option.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" strokeWidth={2.5} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 transition group-hover:gap-2">
        Выбрать
        <ArrowRight className="h-4 w-4" />
      </span>
    </button>
  );
}

type Step = "org" | "intent" | "form" | "success";

export type SetupEstablishmentOption = {
  id: string;
  name: string;
  yandexMapsUrl: string | null;
  phone: string | null;
  legalName: string | null;
  inn: string | null;
};

interface SetupStartWizardProps {
  /** Повторный просмотр мастера без создания заведения (для отладки). */
  rerun?: boolean;
  existingEstablishments?: SetupEstablishmentOption[];
  canAddNewEstablishment?: boolean;
}

export default function SetupStartWizard({
  rerun = false,
  existingEstablishments = [],
  canAddNewEstablishment = true,
}: SetupStartWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utmContext = useMemo(
    () =>
      parseSetupUtmContext(
        searchParams.get("utm_campaign"),
        searchParams.get("utm_content")
      ),
    [searchParams]
  );
  const visibleIntentOptions = useMemo(() => {
    const ids = orderSetupIntents(
      INTENT_OPTIONS.map((o) => o.id),
      utmContext.hint
    );
    const options = ids
      .map((id) => INTENT_OPTIONS.find((o) => o.id === id))
      .filter((o): o is (typeof INTENT_OPTIONS)[number] => Boolean(o));
    if (utmContext.hideRedirect) {
      return options.filter((o) => o.id !== "redirect");
    }
    return options;
  }, [utmContext]);
  const hasExistingOrgs = existingEstablishments.length > 0 && !rerun;
  const isFirstLaunch = existingEstablishments.length === 0 && !rerun;
  const [step, setStep] = useState<Step>(hasExistingOrgs ? "org" : "intent");
  const [orgMode, setOrgMode] = useState<"existing" | "new" | null>(null);
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState<string | null>(null);
  const [intent, setIntent] = useState<SetupIntent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [guestPreviewOpened, setGuestPreviewOpened] = useState(false);

  const [form, setForm] = useState({
    name: "",
    yandexMapsUrl: "",
    phone: "",
    redirectUrl: "",
    legalName: "",
    inn: "",
  });

  const [result, setResult] = useState<{
    establishment?: { id: string; name: string };
    qrcode: { id: string; code: string };
    intent: SetupIntent;
  } | null>(null);

  const intentViewedSent = useRef(false);
  useEffect(() => {
    if (intentViewedSent.current) return;
    intentViewedSent.current = true;
    trackEvent("setup.intent_viewed");
  }, []);

  const selectedEstablishment = selectedEstablishmentId
    ? existingEstablishments.find((e) => e.id === selectedEstablishmentId) ?? null
    : null;
  const usingExistingOrg = orgMode === "existing" && !!selectedEstablishment;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intent) return;
    trackEvent("setup.form_submitted", {
      intent,
      rerun,
      orgMode: usingExistingOrg ? "existing" : "new",
    });
    setLoading(true);
    setError("");

    try {
      if (rerun) {
        const demoCode =
          intent === "reviews" ? "demo-review" : intent === "redirect" ? "demo-redirect" : "demo-landing";
        const mockResult = {
          establishment:
            intent === "redirect"
              ? undefined
              : { id: "demo", name: form.name.trim() || "Демо-заведение" },
          qrcode: { id: "demo", code: demoCode },
          intent,
        };
        setResult(mockResult);
        trackEvent("setup.completed", { intent, rerun: true });
        const img = await generateQRWithCenter(
          scanUrlForCode(demoCode),
          qrPreviewOptions(intent),
          320,
        );
        setQrImageUrl(img);
        setStep("success");
        return;
      }

      const payload: Record<string, string> = { ...form, intent };
      if (usingExistingOrg && selectedEstablishmentId) {
        payload.establishmentId = selectedEstablishmentId;
        delete payload.name;
      }

      const res = await fetch("/api/setup/quick-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось создать заведение");
        return;
      }

      setResult({ ...data, intent });
      trackEvent("setup.completed", {
        intent,
        qrCodeId: data.qrcode.id,
        establishmentId: data.establishment?.id,
      });
      const img = await generateQRWithCenter(
        scanUrlForCode(data.qrcode.code),
        qrPreviewOptions(intent),
        320,
      );
      setQrImageUrl(img);
      setStep("success");
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  };

  const chooseIntent = (value: SetupIntent) => {
    trackEvent("setup.intent_selected", {
      intent: value,
      orgMode: usingExistingOrg ? "existing" : orgMode ?? "new",
    });
    setIntent(value);
    setError("");

    if (usingExistingOrg && selectedEstablishment) {
      setForm((prev) => ({
        ...prev,
        name: selectedEstablishment.name,
        phone: selectedEstablishment.phone || "",
        yandexMapsUrl: selectedEstablishment.yandexMapsUrl || "",
        legalName: selectedEstablishment.legalName || "",
        inn: selectedEstablishment.inn || "",
      }));
      if (value === "landing" || (value === "reviews" && selectedEstablishment.yandexMapsUrl)) {
        void submitForExistingEstablishment(value);
        return;
      }
    }

    setStep("form");
  };

  const submitForExistingEstablishment = async (value: SetupIntent) => {
    if (!selectedEstablishmentId) return;
    trackEvent("setup.form_submitted", { intent: value, orgMode: "existing" });
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/setup/quick-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: value,
          establishmentId: selectedEstablishmentId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось создать QR-код");
        setStep("form");
        return;
      }

      setResult({ ...data, intent: value });
      trackEvent("setup.completed", {
        intent: value,
        qrCodeId: data.qrcode.id,
        establishmentId: data.establishment?.id,
      });
      const img = await generateQRWithCenter(
        scanUrlForCode(data.qrcode.code),
        qrPreviewOptions(value),
        320,
      );
      setQrImageUrl(img);
      setStep("success");
    } catch {
      setError("Ошибка соединения");
      setStep("form");
    } finally {
      setLoading(false);
    }
  };

  const continueFromOrgStep = () => {
    if (!orgMode) return;
    if (orgMode === "existing" && !selectedEstablishmentId) {
      setError("Выберите заведение из списка");
      return;
    }
    setError("");
    setStep("intent");
  };

  const downloadQr = async (format: "png" | "svg") => {
    if (!result) return;
    trackEvent("setup.qr_downloaded", {
      intent: result.intent,
      qrCodeId: result.qrcode.id,
      format,
    });
    await downloadQrCode(format, scanUrlForCode(result.qrcode.code), `qr-${result.qrcode.code}`, {
      isPro: false,
      size: QR_EXPORT_SIZE,
    });
  };

  const openGuestPreview = (scanUrl: string) => {
    if (!result) return;
    trackEvent("setup.preview_opened", {
      intent: result.intent,
      qrCodeId: result.qrcode.id,
    });
    setGuestPreviewOpened(true);
    window.open(scanUrl, "_blank", "noopener,noreferrer");
  };

  const openDashboardInNewTab = (destination: string, href: string) => {
    if (result) {
      trackEvent("setup.next_step_clicked", {
        intent: result.intent,
        destination,
      });
    }
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const goNextStep = (destination: string, href: string) => {
    if (result) {
      trackEvent("setup.next_step_clicked", {
        intent: result.intent,
        destination,
      });
    }
    router.push(href);
  };

  const [downloadType, setDownloadType] = useState<"pdf" | "png">("pdf");
  const [selectedPresetId, setSelectedPresetId] = useState("universal-a6");
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [tableTemplateId, setTableTemplateId] = useState<string | null>(null);
  const [tableTemplateLoading, setTableTemplateLoading] = useState(false);

  const openTableTentDesigner = async (openInNewTab = false) => {
    if (!result) return;
    const newTab = openInNewTab ? window.open("", "_blank") : null;
    if (newTab) {
      newTab.opener = null;
    }

    if (rerun) {
      const href = "/dashboard/templates/table-tents";
      if (newTab) {
        newTab.location.href = href;
      } else {
        goNextStep("table-template", href);
      }
      return;
    }

    setTableTemplateLoading(true);
    try {
      let tplId = tableTemplateId;
      if (!tplId) {
        const preset =
          BUILTIN_STICKER_TEMPLATES.find((p) => p.id === selectedPresetId) ||
          BUILTIN_STICKER_TEMPLATES[0];
        const layout = stickerPresetLayout(preset);
        layout.stickerConfig = {
          ...layout.stickerConfig,
          url: scanUrlForCode(result.qrcode.code),
        };

        const createRes = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${result.establishment?.name ?? "Отзывы"} — ${preset.shortName}`,
            width: preset.width,
            height: preset.height,
            layout,
          }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) {
          throw new Error(createData.error || "create failed");
        }
        tplId = createData.template.id as string;
        setTableTemplateId(tplId);

        const bindRes = await fetch("/api/qrcodes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: result.qrcode.id, templateId: tplId }),
        });
        if (!bindRes.ok) {
          throw new Error("bind failed");
        }
      }

      trackEvent("setup.next_step_clicked", {
        intent: result.intent,
        destination: "table-template",
      });
      const href = `/dashboard/templates/${tplId}`;
      if (newTab) {
        newTab.location.href = href;
      } else {
        router.push(href);
      }
    } catch {
      newTab?.close();
      alert("Не удалось открыть редактор таблички. Попробуйте ещё раз.");
    } finally {
      setTableTemplateLoading(false);
    }
  };

  const downloadTablePDF = async () => {
    if (!result) return;
    const preset = ONBOARDING_TEMPLATES.find((p) => p.id === selectedPresetId) || ONBOARDING_TEMPLATES[0];
    setPdfDownloading(true);
    try {
      trackEvent("setup.pdf_downloaded", {
        intent: result.intent,
        qrCodeId: result.qrcode.id,
        presetId: preset.id,
      });

      const cfg: StickerConfig = { ...preset.config, url: scanUrlForCode(result.qrcode.code) };
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

      doc.save(`sticker-${result.qrcode.code}.pdf`);
    } catch {
      alert("Ошибка генерации PDF. Попробуйте еще раз.");
    } finally {
      setPdfDownloading(false);
    }
  };

  if (step === "success" && result) {
    const scanUrl = scanUrlForCode(result.qrcode.code);
    const isReviews = result.intent === "reviews";
    const isRedirect = result.intent === "redirect";
    return (
      <SetupWizardShell>
        <div className="max-w-lg mx-auto w-full space-y-6">
          {rerun && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950">
              Демонстрация завершена — заведение и QR не создавались.
            </div>
          )}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 text-green-600 mb-2">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 font-sans tracking-tight">
              {rerun ? "Мастер пройден" : "Готово! QR-код успешно создан"}
            </h1>
            <p className="text-gray-600 text-sm leading-relaxed">
              {isReviews ? (
                <>
                  Ваш QR-код для заведения <strong className="text-gray-950 font-semibold">«{result.establishment?.name}»</strong> настроен на сбор отзывов.
                  Пройдите три коротких шага: проверьте сценарий как гость, подготовьте QR к печати и подключите уведомления о новых отзывах.
                </>
              ) : isRedirect ? (
                <>
                  Ваш динамический QR-код готов! При сканировании гости будут автоматически перенаправляться по указанной ссылке.
                  Теперь вы можете настроить внешний вид QR-кода и скачать его для печати.
                </>
              ) : (
                <>
                  QR-код ведет на мобильную визитку заведения <strong className="text-gray-950 font-semibold">«{result.establishment?.name}»</strong>. 
                  Перейдите в раздел «Моя страница», чтобы добавить меню, контакты, Wi-Fi и включить сбор отзывов.
                </>
              )}
            </p>
          </div>

          {isReviews && (
            <Card className="p-4 space-y-3 border-indigo-100 bg-indigo-50/50">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                  1
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-indigo-950 flex items-center gap-2">
                    Проверьте сценарий как гость
                    {guestPreviewOpened && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                  </p>
                  <p className="mt-1 text-xs text-indigo-900/80 leading-relaxed">
                    Откройте QR-код в новой вкладке и попробуйте поставить 5★ и 2★. Вы увидите, как работает переход на Яндекс.Карты и форма для приватной жалобы.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full bg-white"
                onClick={() => openGuestPreview(scanUrl)}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Открыть как гость
              </Button>
            </Card>
          )}

          <Card className="p-6 space-y-6">
            <div>
              {isReviews ? (
                <div className="mb-4 flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                    2
                  </span>
                  <div>
                    <p className="font-semibold text-gray-950">Подготовьте QR-код к размещению</p>
                    <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                      Скачайте готовый макет в PDF для самостоятельной печати или передайте чистый QR-код вашему дизайнеру.
                    </p>
                  </div>
                </div>
              ) : (
                <label className="block text-sm font-bold text-gray-800 text-center mb-3">
                  Как вы планируете разместить QR-код?
                </label>
              )}
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDownloadType("pdf")}
                  className={`py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    downloadType === "pdf"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  {isReviews ? "Готовая табличка" : "Готовый макет (PDF)"}
                </button>
                <button
                  type="button"
                  onClick={() => setDownloadType("png")}
                  className={`py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    downloadType === "png"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  {isReviews ? "QR для дизайнера" : "Только QR-код"}
                </button>
              </div>
            </div>

            {downloadType === "pdf" ? (
              <div className="space-y-4">
                <div className="text-center text-xs text-gray-500 leading-relaxed">
                  {isReviews
                    ? "Выберите подходящий формат: наклейка на стол, тейбл-тент или вкладыш в меню. Мы автоматически сгенерируем лист А4 с вашим QR-кодом, готовый к печати."
                    : "Выберите один из готовых форматов. Мы сгенерируем лист А4, заполненный вашими QR-кодами, который можно сразу отправить на принтер."}
                </div>
                
                {/* 4 Presets Selection */}
                <div className="grid grid-cols-2 gap-2">
                  {ONBOARDING_TEMPLATES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedPresetId(p.id);
                        setTableTemplateId(null);
                      }}
                      className={`p-3 text-left rounded-xl border transition-all text-xs flex flex-col justify-between h-[100px] ${
                        selectedPresetId === p.id
                          ? "border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-600/25"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-gray-950 leading-tight mb-1">{p.name}</div>
                        <div className="text-[10px] text-gray-400 font-semibold">{p.size}</div>
                      </div>
                      <div className="text-[10px] text-gray-500 line-clamp-2 w-full">{p.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Preview Selected Preset */}
                {(() => {
                  const activePreset = ONBOARDING_TEMPLATES.find((p) => p.id === selectedPresetId) || ONBOARDING_TEMPLATES[0];
                  return (
                    <div className="space-y-4 pt-1">
                      <StickerOnboardingPreview cfg={activePreset.config} code={result.qrcode.code} />
                      
                      <Button
                        onClick={downloadTablePDF}
                        disabled={pdfDownloading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2"
                        size="lg"
                      >
                        <Printer className="w-5 h-5" />
                        {pdfDownloading ? "Генерация PDF..." : "Скачать PDF для печати"}
                      </Button>
                      {isReviews && (
                        <Button
                          variant="outline"
                          size="lg"
                          className="w-full"
                          onClick={() => void openTableTentDesigner(true)}
                          disabled={tableTemplateLoading}
                        >
                          <Palette className="w-5 h-5 mr-2" />
                          {tableTemplateLoading ? "Открываем редактор..." : "Настроить дизайн таблички в новой вкладке"}
                        </Button>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <div className="text-center text-xs text-gray-500 leading-relaxed max-w-sm mx-auto">
                  {isReviews
                    ? "Если вы разрабатываете собственный дизайн, скачайте чистый QR-код (PNG или SVG) и передайте его дизайнеру."
                    : "Скачайте QR-код в высоком разрешении (PNG или SVG) для размещения на визитках, буклетах и других материалах."}
                </div>
                {qrImageUrl && (
                  <img
                    src={qrImageUrl}
                    alt="QR-код"
                    className="max-w-44 max-h-44 w-auto h-auto mx-auto rounded-xl border border-gray-100 shadow-sm object-contain"
                  />
                )}
                <p className="font-mono text-xs text-gray-400">{result.qrcode.code}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => void downloadQr("png")} disabled={!qrImageUrl}>
                    <Download className="w-4 h-4 mr-1" />
                    PNG
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void downloadQr("svg")} disabled={!qrImageUrl}>
                    <Download className="w-4 h-4 mr-1" />
                    SVG
                  </Button>
                  {isReviews && !rerun && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        openDashboardInNewTab(
                          "templates",
                          `/dashboard/templates/qr?bindQr=${result.qrcode.id}`,
                        )
                      }
                    >
                      <Palette className="w-4 h-4 mr-1" />
                      Настроить дизайн кода
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => openGuestPreview(scanUrl)}>
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Открыть как гость
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {isReviews && (
            <Card className="p-4 space-y-3 border-slate-200 bg-white/90">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                  3
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-950 flex items-center gap-2">
                    Получайте жалобы быстрее
                    <Bell className="w-4 h-4 text-indigo-600" />
                  </p>
                  <p className="mt-1 text-xs text-gray-600 leading-relaxed">
                    По умолчанию отзывы 1–3★ сохраняются в личном кабинете и отправляются на email. Вы можете подключить уведомления в Telegram или ВКонтакте (MAX), чтобы реагировать на жалобы моментально.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() =>
                  openDashboardInNewTab(
                    "notification-settings",
                    "/dashboard/settings#notification-channels",
                  )
                }
              >
                <MessageCircle className="w-4 h-4 mr-1 text-blue-500" />
                Открыть настройки уведомлений в новой вкладке
              </Button>
            </Card>
          )}

          {isFirstLaunch && (
            <div className="bg-amber-50/80 border border-amber-200/50 rounded-xl p-4 text-xs text-amber-950 leading-relaxed space-y-1">
              <p className="font-bold flex items-center gap-1 text-amber-900">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Вы сможете изменить настройки в личном кабинете
              </p>
              <p>
                {isReviews
                  ? "QR-код динамический: вы можете менять тексты, ссылки на площадки, превратить QR-код в микросайт с меню или описанием Ваших услуг в любой момент. Сам QR-код при этом перепечатывать не нужно."
                  : "Вы выбрали базовый макет, но в личном кабинете доступен полноценный редактор. Вы сможете изменить цвета, шрифты, добавить логотип или выбрать другой фон."}
              </p>
            </div>
          )}

          {(isFirstLaunch || rerun) && (
            <div className="space-y-3">
              {isFirstLaunch && (
                <>
                  {isRedirect && (
                    <>
                      <Button
                        size="lg"
                        className="w-full"
                        onClick={() =>
                          goNextStep("templates", `/dashboard/templates/qr?bindQr=${result.qrcode.id}`)
                        }
                      >
                        Оформить дизайн QR-кода
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="w-full"
                        onClick={() =>
                          goNextStep("qrcode-settings", `/dashboard/qrcodes/${result.qrcode.id}?welcome=1`)
                        }
                      >
                        Настройки редиректа
                      </Button>
                    </>
                  )}
                  {!isRedirect && !isReviews && (
                    <Button
                      size="lg"
                      className="w-full"
                      onClick={() => goNextStep("my-page", "/dashboard/my-page")}
                    >
                      Оформить и наполнить сайт-визитку
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                  <p className="text-center text-sm text-gray-500">
                    <button
                      type="button"
                      className="text-indigo-600 hover:text-indigo-800 font-medium"
                      onClick={() => {
                        trackEvent("setup.next_step_clicked", {
                          intent: result.intent,
                          destination: "dashboard",
                        });
                        router.refresh();
                        router.push("/dashboard");
                      }}
                    >
                      Перейти в личный кабинет
                    </button>
                  </p>
                  <p className="text-center text-xs text-gray-400 max-w-sm mx-auto">
                    Выбрали не тот сценарий? Ничего страшного — тип QR-кода, ссылки и разделы можно изменить в личном кабинете в любой момент.
                  </p>
                </>
              )}
              {rerun && (
                <p className="text-center text-sm text-gray-500">
                  <button
                    type="button"
                    className="text-indigo-600 hover:text-indigo-800 font-medium"
                    onClick={() => router.push("/dashboard")}
                  >
                    Закрыть
                  </button>
                </p>
              )}
            </div>
          )}
        </div>
      </SetupWizardShell>
    );
  }

  if (step === "org") {
    return (
      <SetupWizardShell>
        <div className="mx-auto max-w-2xl w-full space-y-8">
          <div className="text-center space-y-4 px-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-white/80 px-4 py-1.5 text-sm font-medium text-indigo-800 shadow-sm backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              Настройка QR
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Для какого заведения создаём QR-код?
            </h1>
            <p className="mx-auto max-w-lg text-sm leading-relaxed text-slate-600 sm:text-base">
              Выберите заведение из списка или добавьте новое. На следующем шаге вы сможете выбрать сценарий работы QR-кода.
            </p>
          </div>

          <Card className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
            )}

            <button
              type="button"
              onClick={() => {
                setOrgMode("existing");
                setError("");
              }}
              className={`w-full rounded-2xl border p-5 text-left transition ${
                orgMode === "existing"
                  ? "border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-600/25"
                  : "border-slate-200 bg-white hover:border-indigo-200"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                  <Store className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">Существующее заведение</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Создать дополнительный QR-код для уже добавленного заведения
                  </p>
                </div>
              </div>

              {orgMode === "existing" && (
                <div className="mt-4 space-y-2 border-t border-indigo-100 pt-4">
                  {existingEstablishments.map((est) => (
                    <label
                      key={est.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                        selectedEstablishmentId === est.id
                          ? "border-indigo-500 bg-white shadow-sm"
                          : "border-slate-200 bg-white/80 hover:border-indigo-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name="establishment"
                        className="text-indigo-600"
                        checked={selectedEstablishmentId === est.id}
                        onChange={() => {
                          setSelectedEstablishmentId(est.id);
                          setError("");
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-900">{est.name}</span>
                        {est.yandexMapsUrl && (
                          <span className="block truncate text-xs text-slate-500">Яндекс.Карты подключены</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setOrgMode("new");
                setSelectedEstablishmentId(null);
                setError("");
              }}
              disabled={!canAddNewEstablishment}
              className={`w-full rounded-2xl border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                orgMode === "new"
                  ? "border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-600/25"
                  : "border-slate-200 bg-white hover:border-indigo-200"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">Новое заведение</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {canAddNewEstablishment
                      ? "Добавить новое заведение и сгенерировать для него первый QR-код"
                      : "Достигнут лимит заведений на вашем тарифе. Для добавления новых обновите подписку."}
                  </p>
                </div>
              </div>
            </button>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="w-1/3"
                onClick={() => router.push("/dashboard")}
              >
                В кабинет
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={!orgMode || (orgMode === "existing" && !selectedEstablishmentId)}
                onClick={continueFromOrgStep}
              >
                Продолжить
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        </div>
      </SetupWizardShell>
    );
  }

  if (step === "intent") {
    return (
      <SetupWizardShell>
        <div className="mx-auto max-w-5xl w-full space-y-10">
          {rerun && (
            <div className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950">
              Режим повторного просмотра — заведение и QR не создаются, только демонстрация шагов мастера.
            </div>
          )}
          <div className="text-center space-y-4 px-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-white/80 px-4 py-1.5 text-sm font-medium text-indigo-800 shadow-sm backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              {rerun ? "Повторный просмотр" : hasExistingOrgs ? "Настройка QR" : "Первый запуск"}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {usingExistingOrg
                ? `Какой QR-код нужен для «${selectedEstablishment?.name}»?`
                : "С чего начнём?"}
            </h1>
            <p className="mx-auto max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              {usingExistingOrg
                ? "Выберите сценарий работы для нового QR-кода. Вы сможете изменить его в любой момент."
                : "Выберите основной сценарий. Мы автоматически создадим заведение и сгенерируем QR-код. Настройки можно будет изменить позже."}
            </p>
          </div>

          {hasExistingOrgs && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setStep("org");
                  setIntent(null);
                  setError("");
                }}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 transition"
              >
                <ChevronLeft className="w-4 h-4" />
                Назад к выбору заведения
              </button>
            </div>
          )}

          {utmContext.hint === "reviews" && (
            <div className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950 leading-relaxed">
              Вы перешли по ссылке про сбор отзывов — начните с «Умного сбора отзывов», чтобы гости оставляли оценки на Яндекс.Картах, а жалобы приходили вам напрямую.
            </div>
          )}

          <div
            className={`grid gap-5 md:items-stretch ${
              visibleIntentOptions.length <= 2 ? "md:grid-cols-2 max-w-3xl mx-auto" : "md:grid-cols-3"
            }`}
          >
            {visibleIntentOptions.map((option) => (
              <IntentOptionCard
                key={option.id}
                option={option}
                recommended={utmContext.hint === "reviews" && option.id === "reviews"}
                secondary={
                  utmContext.hint === "reviews"
                    ? option.id === "redirect"
                    : utmContext.hint === "generator"
                      ? option.id !== "redirect" && option.id !== "landing"
                      : false
                }
                onSelect={() => chooseIntent(option.id)}
              />
            ))}
          </div>

          {utmContext.hideRedirect && (
            <p className="text-center text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
              Нужен простой редирект по ссылке?{" "}
              <button
                type="button"
                className="font-medium text-indigo-600 hover:text-indigo-800"
                onClick={() => chooseIntent("redirect")}
              >
                Создать QR-редирект
              </button>
              {" "}— но это не настроит сбор отзывов на картах.
            </p>
          )}

          <p className="text-center text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
            {utmContext.hint === "reviews"
              ? "«Сайт-визитка» тоже подойдёт — на неё можно добавить сбор отзывов и меню."
              : "Сомневаетесь? Выберите «Сайт-визитку» — это универсальный вариант, к которому легко подключить сбор отзывов и другие функции."}
          </p>
        </div>
      </SetupWizardShell>
    );
  }

  const isReviews = intent === "reviews";
  const isRedirect = intent === "redirect";

  const autoSubmitExisting =
    usingExistingOrg &&
    (intent === "landing" || (intent === "reviews" && !!selectedEstablishment?.yandexMapsUrl));

  if (loading && autoSubmitExisting) {
    return (
      <SetupWizardShell>
        <div className="max-w-lg mx-auto w-full text-center space-y-4 py-16">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-100 text-indigo-600">
            <QrCode className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Создаём QR-код…</h1>
          <p className="text-sm text-gray-500">Заведение «{selectedEstablishment?.name}»</p>
        </div>
      </SetupWizardShell>
    );
  }

  return (
    <SetupWizardShell>
      <div className="max-w-lg mx-auto w-full space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            {rerun ? "Повторный просмотр" : hasExistingOrgs ? "Настройка QR" : "Первый запуск"}
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isReviews ? "Настройка сбора отзывов" : isRedirect ? "Настройка редиректа" : "Настройка сайта-визитки"}
          </h1>
          <p className="text-gray-600 max-w-md mx-auto text-sm leading-relaxed">
            {usingExistingOrg ? (
              <>
                Создаём QR-код для заведения{" "}
                <strong className="text-gray-950 font-semibold">«{selectedEstablishment?.name}»</strong>.
                {isReviews
                  ? " Укажите ссылку на вашу карточку в Яндекс.Картах."
                  : isRedirect
                    ? " Введите ссылку, по которой будут переходить гости."
                    : " Подтвердите создание QR-кода для визитки."}
              </>
            ) : isReviews ? (
              "Укажите название заведения и ссылку на Яндекс.Карты. Мы сгенерируем QR-код, который сразу начнёт собирать отзывы."
            ) : isRedirect ? (
              "Укажите ссылку для перенаправления гостей. Вы сможете изменить её в личном кабинете без перепечатки QR-кода."
            ) : (
              "Введите название заведения. Мы автоматически создадим для него мобильную визитку и рабочий QR-код."
            )}
          </p>
        </div>

        <div className="flex justify-center gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-white border text-gray-400">
            <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[10px] font-bold">
              1
            </span>
            Сценарий
          </span>
          <span className="text-gray-300">→</span>
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-indigo-200 text-indigo-700">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
              2
            </span>
            Информация
          </span>
          <span className="text-gray-300">→</span>
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-white border text-gray-400">
            <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[10px] font-bold">
              3
            </span>
            Готовый QR
          </span>
        </div>

        <Card>
          <button
            type="button"
            onClick={() => {
              setStep("intent");
              setError("");
            }}
            className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Назад к выбору сценария
          </button>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
            )}

            {!isRedirect && !usingExistingOrg && (
              <div>
                <Input
                  label="Название заведения *"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Например: Кафе «Аромат», Салон красоты «Престиж»…"
                  required
                />
              </div>
            )}

            {isRedirect && (
              <div>
                <Input
                  label="Ссылка для перенаправления *"
                  type="url"
                  value={form.redirectUrl}
                  onChange={(e) => setForm({ ...form, redirectUrl: e.target.value })}
                  placeholder="https://example.com"
                  required
                />
                <p className="text-xs text-gray-500 mt-1.5 flex items-start gap-1 leading-relaxed">
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-500" />
                  При сканировании QR-кода гости будут сразу переходить по этой ссылке.
                </p>
              </div>
            )}

            {isReviews && (
              <div>
                <Input
                  label={`Ссылка на Яндекс.Карты${usingExistingOrg && selectedEstablishment?.yandexMapsUrl ? "" : " *"}`}
                  type="url"
                  value={form.yandexMapsUrl}
                  onChange={(e) => setForm({ ...form, yandexMapsUrl: e.target.value })}
                  placeholder="https://yandex.ru/maps/org/..."
                  required={!usingExistingOrg || !selectedEstablishment?.yandexMapsUrl}
                />
                <p className="text-xs text-gray-500 mt-1.5 flex items-start gap-1 leading-relaxed">
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-500" />
                  Сюда мы будем направлять довольных гостей (с оценкой 4–5★) для публикации отзыва.
                </p>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  Дополнительные площадки (2GIS, Flamp, Авито) можно добавить позже в разделе{" "}
                  <Link href="/dashboard/my-page" className="text-indigo-600 hover:text-indigo-800 font-medium">
                    «Моя страница»
                  </Link>.
                </p>
              </div>
            )}

            {intent === "landing" && (
              <>
                <Input
                  label="Номер телефона заведения (необязательно)"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Например: +7 (999) 123-45-67"
                />
                <div>
                  <Input
                    label="Ссылка на Яндекс.Карты (необязательно)"
                    type="url"
                    value={form.yandexMapsUrl}
                    onChange={(e) => setForm({ ...form, yandexMapsUrl: e.target.value })}
                    placeholder="https://yandex.ru/maps/org/..."
                  />
                  <p className="text-xs text-gray-500 mt-1.5 flex items-start gap-1 leading-relaxed">
                    <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-500" />
                    Если указать ссылку, на визитке появится блок сбора отзывов. Довольных гостей мы направим на Яндекс.Карты.
                  </p>
                </div>
              </>
            )}

            {!isRedirect && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-4 space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Реквизиты для политики персональных данных
                  </p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Необязательно. Нужны, чтобы в формах для гостей появились поля телефона и email
                    (заказ меню, жалобы, обратная связь). Пока не заполнены оба поля — эти поля
                    гостям не показываются.
                  </p>
                </div>
                <Input
                  label="Юридическое наименование"
                  value={form.legalName}
                  onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                  placeholder="ИП Иванов Иван Иванович / ООО «Название»"
                />
                <Input
                  label="ИНН"
                  value={form.inn}
                  onChange={(e) => setForm({ ...form, inn: e.target.value })}
                  placeholder="123456789012"
                />
                {form.legalName.trim() && form.inn.trim() ? (
                  <p className="text-xs text-green-600">
                    ✓ Политика ПД активна — формы с телефоном и email будут доступны гостям.
                  </p>
                ) : form.legalName.trim() || form.inn.trim() ? (
                  <p className="text-xs text-amber-600">
                    ⚠ Заполните оба поля, чтобы разблокировать формы с телефоном и email.
                  </p>
                ) : null}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep("intent");
                  setError("");
                }}
                className="w-1/3"
              >
                <ChevronLeft className="w-4 h-4 mr-1 inline shrink-0" />
                Назад
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? (
                  "Создаём..."
                ) : (
                  <>
                    <QrCode className="w-5 h-5 mr-2" />
                    {usingExistingOrg ? "Создать QR-код" : "Создать QR-код"}
                  </>
                )}
              </Button>
            </div>
            {!isReviews && !isRedirect && (
              <p className="text-xs text-gray-500 text-center leading-relaxed pt-1">
                Наполнить визитку (добавить меню, Wi‑Fi, ссылки на соцсети) можно будет в личном кабинете.
              </p>
            )}
          </form>
        </Card>

        <div className="rounded-xl border border-gray-200 bg-white/80 p-4 text-sm text-gray-600 space-y-2">
          <p className="font-semibold text-gray-900 flex items-center gap-2">
            <Store className="w-4 h-4 text-indigo-600" />
            Что вы получите в результате:
          </p>
          {isReviews ? (
            <ul className="list-disc list-inside space-y-1.5 text-xs text-gray-600 leading-relaxed">
              <li>Готовый QR-код, открывающий форму оценки 1–5★</li>
              <li>Умную маршрутизацию: хорошие отзывы идут на Яндекс, плохие — вам на почту или в Telegram</li>
              <li>Возможность в любой момент добавить на страницу меню или пароль от Wi-Fi</li>
            </ul>
          ) : isRedirect ? (
            <ul className="list-disc list-inside space-y-1.5 text-xs text-gray-600 leading-relaxed">
              <li>Динамический QR-код, мгновенно перенаправляющий гостей по вашей ссылке</li>
              <li>Возможность менять ссылку в личном кабинете без перепечатки самого QR-кода</li>
              <li>Доступ к визуальному конструктору дизайна QR-кода</li>
            </ul>
          ) : (
            <ul className="list-disc list-inside space-y-1.5 text-xs text-gray-600 leading-relaxed">
              <li>Мобильную страницу заведения с вашим фирменным стилем</li>
              <li>Удобный редактор для добавления меню, Wi‑Fi, контактов и ссылок на соцсети</li>
              <li>Возможность легко подключить сбор отзывов в любой момент</li>
            </ul>
          )}
        </div>
      </div>
    </SetupWizardShell>
  );
}
