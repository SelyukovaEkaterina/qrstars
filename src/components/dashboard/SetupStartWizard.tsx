"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { downloadQrCode, QR_EXPORT_SIZE } from "@/lib/qr-download";
import { qrPreviewDataUrl } from "@/lib/qr-preview";
import {
  isBuiltInQrStyleTemplateId,
  qrStylePresetTemplateId,
} from "@/lib/qr-code-templates";
import { calcA4StickerGrid } from "@/lib/a4-sticker-grid";
import { scanUrlForCode, quotedEstablishmentName } from "@/lib/utils";
import { trackEvent } from "@/lib/track-event";
import type { RegistrationUtm } from "@/lib/registration-utm";
import {
  orderSetupIntents,
  parseSetupIntentParam,
  parseSetupUtmContext,
  resolveAutoSelectedIntent,
} from "@/lib/setup-utm-intent";
import {
  normalizeYandexMapsUrl,
} from "@/lib/yandex-maps-url";
import YandexMapsUrlHelper from "@/components/dashboard/YandexMapsUrlHelper";
import LandingProPaywall from "@/components/dashboard/LandingProPaywall";
import YandexMapsOrgConfirm, {
  type YandexMapsOrgConfirmHandle,
} from "@/components/dashboard/YandexMapsOrgConfirm";
import {
  renderSticker,
  FORMATS,
  type StickerConfig,
} from "@/components/dashboard/StickerDesigner";
import {
  inferIndustryFromUtm,
  industryQrStylePreset,
  isHorecaIndustry,
  parseEstablishmentIndustry,
  type EstablishmentIndustry,
} from "@/lib/establishment-industry";
import {
  LEGAL_REQUISITES_HINT,
  LEGAL_REQUISITES_INCOMPLETE,
  LEGAL_REQUISITES_READY,
} from "@/lib/pd-consent";
import { SETUP_GUIDE_DISMISS_KEY } from "@/lib/setup-wizard-path";
import {
  projectHomePath,
  projectPagePath,
  projectQrPath,
} from "@/lib/project-routes";
import { TEMPLATE_ROUTES } from "@/lib/template-routes";
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
  UtensilsCrossed,
  Crown,
  Copy,
  type LucideIcon,
} from "lucide-react";
import { REDIRECT_INTERSTITIAL_SECONDS } from "@/lib/redirect-interstitial";

export type SetupIntent = "reviews" | "landing" | "redirect" | "menu";

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
  paid?: boolean;
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
    id: "menu",
    title: "QR-меню",
    tagline: "Электронное меню по QR-коду",
    icon: UtensilsCrossed,
    accent: "hover:border-rose-300 hover:shadow-rose-100/80 group-hover:ring-rose-200",
    iconWrap: "bg-gradient-to-br from-rose-100 to-orange-50 text-rose-700 ring-rose-200/60",
    features: [
      "Гость сканирует QR и сразу видит меню на телефоне",
      "Категории, цены и описания — редактируются в личном кабинете",
      "Можно включить корзину и приём заказов (PRO)",
      "Подходит для кафе, ресторанов и баров",
      "Позже можно добавить отзывы или микросайт (PRO)",
    ],
  },
  {
    id: "landing",
    title: "Микросайт с визиткой и ссылками",
    tagline: "Для заведения, доклада или видео",
    icon: LayoutGrid,
    paid: true,
    accent: "hover:border-indigo-400 hover:shadow-indigo-100/80 group-hover:ring-indigo-300",
    iconWrap: "bg-gradient-to-br from-indigo-100 to-violet-50 text-indigo-700 ring-indigo-200/60",
    features: [
      "Мобильная страница из блоков: контакты, ссылки, материалы",
      "Подходит кафе, спикерам конференций и авторам видео",
      "Сбор отзывов, меню и Wi-Fi можно включить рядом",
      "Простой визуальный редактор — справится каждый",
      "Позже можно создать отдельные QR-коды для каждого блока",
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
      {option.paid && (
        <span className="absolute -top-2.5 right-4 inline-flex items-center gap-0.5 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
          <Crown className="h-3 w-3" />
          PRO
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
          {option.id === "reviews" && (
            <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium leading-snug text-amber-900">
              Нужна ссылка на карточку в Яндекс.Картах
            </p>
          )}
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
  industry: string | null;
};

interface SetupStartWizardProps {
  /** Повторный просмотр мастера без создания заведения (для отладки). */
  rerun?: boolean;
  existingEstablishments?: SetupEstablishmentOption[];
  canAddNewEstablishment?: boolean;
  hasPaidFeatures?: boolean;
  /** UTM из User.registrationUtm, если в URL нет меток. */
  initialRegistrationUtm?: RegistrationUtm | null;
}

export default function SetupStartWizard({
  rerun = false,
  existingEstablishments = [],
  canAddNewEstablishment = true,
  hasPaidFeatures = false,
  initialRegistrationUtm = null,
}: SetupStartWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utmCampaign =
    searchParams.get("utm_campaign") ?? initialRegistrationUtm?.utm_campaign ?? null;
  const utmContent =
    searchParams.get("utm_content") ?? initialRegistrationUtm?.utm_content ?? null;
  const utmTerm =
    searchParams.get("utm_term") ?? initialRegistrationUtm?.utm_term ?? null;
  const inferredIndustry = useMemo(
    () => inferIndustryFromUtm(utmCampaign, utmContent, utmTerm),
    [utmCampaign, utmContent, utmTerm]
  );
  const [industry, setIndustry] = useState<EstablishmentIndustry | null>(
    inferredIndustry
  );
  const utmContext = useMemo(() => {
    return parseSetupUtmContext(utmCampaign, utmContent);
  }, [utmCampaign, utmContent]);
  const requestedIntent = useMemo(
    () => parseSetupIntentParam(searchParams.get("intent")),
    [searchParams]
  );
  const autoSelectedIntent = useMemo(
    () => requestedIntent ?? resolveAutoSelectedIntent(utmCampaign, utmContent),
    [requestedIntent, utmCampaign, utmContent]
  );
  const visibleIntentOptions = useMemo(() => {
    const ids = orderSetupIntents(
      INTENT_OPTIONS.map((o) => o.id),
      utmContext.hint
    );
    const options = ids
      .map((id) => INTENT_OPTIONS.find((o) => o.id === id))
      .filter((o): o is (typeof INTENT_OPTIONS)[number] => Boolean(o));
    const visible = utmContext.hideRedirect
      ? options.filter((o) => o.id !== "redirect")
      : options;
    if (industry && !isHorecaIndustry(industry)) {
      return [...visible.filter((o) => o.id !== "menu"), ...visible.filter((o) => o.id === "menu")];
    }
    return visible;
  }, [industry, utmContext]);
  const hasExistingOrgs = existingEstablishments.length > 0 && !rerun;
  const isFirstLaunch = existingEstablishments.length === 0 && !rerun;
  /** Триал включается прямо в мастере, поэтому серверный проп может устареть. */
  const [paidFeatures] = useState(hasPaidFeatures);
  const [landingPaywallOpen, setLandingPaywallOpen] = useState(false);
  const [step, setStep] = useState<Step>(() => {
    if (hasExistingOrgs) return "org";
    if (autoSelectedIntent === "landing" && !hasPaidFeatures && !rerun) return "intent";
    if (autoSelectedIntent) return "form";
    return "intent";
  });
  const [orgMode, setOrgMode] = useState<"existing" | "new" | null>(null);
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState<string | null>(null);
  const [intent, setIntent] = useState<SetupIntent | null>(() => autoSelectedIntent);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [yandexUrlFieldError, setYandexUrlFieldError] = useState("");
  const [yandexConfirmedUrl, setYandexConfirmedUrl] = useState<string | null>(null);
  const [yandexPreviewReady, setYandexPreviewReady] = useState(false);
  const yandexCheckRef = useRef<YandexMapsOrgConfirmHandle>(null);
  const creatingRef = useRef(false);
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [guestPreviewOpened, setGuestPreviewOpened] = useState(false);
  const [scanUrlCopied, setScanUrlCopied] = useState(false);

  const [form, setForm] = useState({
    name: "",
    qrLabel: "",
    yandexMapsUrl: "",
    phone: "",
    redirectUrl: "",
    legalName: "",
    inn: "",
  });

  const [result, setResult] = useState<{
    establishment?: { id: string; name: string };
    qrcode: { id: string; code: string; qrStyleTemplateId?: string | null };
    intent: SetupIntent;
  } | null>(null);

  const intentViewedSent = useRef(false);
  const autoIntentHandled = useRef(false);
  useEffect(() => {
    if (intentViewedSent.current) return;
    intentViewedSent.current = true;
    trackEvent("setup.intent_viewed");
  }, []);

  useEffect(() => {
    if (step !== "form") setYandexPreviewReady(false);
  }, [step]);

  const selectedEstablishment = selectedEstablishmentId
    ? existingEstablishments.find((e) => e.id === selectedEstablishmentId) ?? null
    : null;
  const usingExistingOrg = orgMode === "existing" && !!selectedEstablishment;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createFromForm();
  };

  const createFromForm = async (confirmedYandex?: string | null) => {
    if (!intent || loading || creatingRef.current) return;

    const confirmed = confirmedYandex ?? yandexConfirmedUrl;
    const yandexRequired =
      intent === "reviews" && (!usingExistingOrg || !selectedEstablishment?.yandexMapsUrl);
    if (yandexRequired) {
      const rawYandex = (confirmed || form.yandexMapsUrl).trim();
      if (!rawYandex) {
        setYandexUrlFieldError(
          "Укажите ссылку на карточку в Яндекс.Картах. Если карточки нет — вернитесь и выберите прямую ссылку или QR-меню."
        );
        setError("");
        return;
      }
      if (!confirmed) {
        setYandexUrlFieldError("Нажмите «Проверить ссылку», затем подтвердите организацию.");
        setError("");
        return;
      }
    }

    if (!usingExistingOrg && !form.name.trim()) {
      setError("Укажите название проекта");
      return;
    }

    if (intent === "redirect" && !form.redirectUrl.trim()) {
      setError("Укажите ссылку для перенаправления");
      return;
    }

    trackEvent("setup.form_submitted", {
      intent,
      rerun,
      orgMode: usingExistingOrg ? "existing" : "new",
    });
    creatingRef.current = true;
    setLoading(true);
    setError("");
    setYandexUrlFieldError("");

    try {
      if (rerun) {
        const demoCode =
          intent === "reviews"
            ? "demo-review"
            : intent === "redirect"
              ? "demo-redirect"
              : intent === "menu"
                ? "demo-menu"
                : "demo-landing";
        const mockResult = {
          establishment: { id: "demo", name: form.name.trim() || "Демо-проект" },
          qrcode: {
            id: "demo",
            code: demoCode,
            qrStyleTemplateId: qrStylePresetTemplateId(industryQrStylePreset(industry)),
          },
          intent,
        };
        setResult(mockResult);
        trackEvent("setup.completed", { intent, rerun: true });
        const img = await qrPreviewDataUrl(scanUrlForCode(demoCode), {
          qrStyleTemplateId: mockResult.qrcode.qrStyleTemplateId,
          isPro: false,
          size: 320,
        });
        setQrImageUrl(img);
        setStep("success");
        return;
      }

      const payload: Record<string, string> = { ...form, intent };
      if (industry) payload.industry = industry;
      if (usingExistingOrg && selectedEstablishmentId) {
        payload.establishmentId = selectedEstablishmentId;
        delete payload.name;
      }
      if (confirmed) {
        payload.yandexMapsUrl = confirmed;
      } else if (form.yandexMapsUrl.trim()) {
        const normalized = normalizeYandexMapsUrl(form.yandexMapsUrl);
        if (normalized) payload.yandexMapsUrl = normalized;
      }

      const res = await fetch("/api/setup/quick-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          res.status === 401
            ? data.error || "Сессия устарела. Выйдите и войдите снова."
            : data.error || "Не удалось создать проект",
        );
        return;
      }

      setResult({ ...data, intent });
      trackEvent("setup.completed", {
        intent,
        qrCodeId: data.qrcode.id,
        establishmentId: data.establishment?.id,
      });
      const img = await qrPreviewDataUrl(scanUrlForCode(data.qrcode.code), {
        qrStyleTemplateId: data.qrcode.qrStyleTemplateId,
        isPro: false,
        size: 320,
      });
      setQrImageUrl(img);
      setStep("success");
    } catch {
      setError("Ошибка соединения");
    } finally {
      creatingRef.current = false;
      setLoading(false);
    }
  };

  async function submitForExistingEstablishment(
    value: SetupIntent,
    selectedIndustry: EstablishmentIndustry | null = industry
  ) {
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
          ...(selectedIndustry ? { industry: selectedIndustry } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          res.status === 401
            ? data.error || "Сессия устарела. Выйдите и войдите снова."
            : data.error || "Не удалось создать QR-код",
        );
        setStep("form");
        return;
      }

      setResult({ ...data, intent: value });
      trackEvent("setup.completed", {
        intent: value,
        qrCodeId: data.qrcode.id,
        establishmentId: data.establishment?.id,
      });
      const img = await qrPreviewDataUrl(scanUrlForCode(data.qrcode.code), {
        qrStyleTemplateId: data.qrcode.qrStyleTemplateId,
        isPro: false,
        size: 320,
      });
      setQrImageUrl(img);
      setStep("success");
    } catch {
      setError("Ошибка соединения");
      setStep("form");
    } finally {
      setLoading(false);
    }
  }

  const proceedWithIntent = (value: SetupIntent) => {
    if (usingExistingOrg && selectedEstablishment) {
      setForm((prev) => ({
        ...prev,
        name: selectedEstablishment.name,
        phone: selectedEstablishment.phone || "",
        yandexMapsUrl: selectedEstablishment.yandexMapsUrl || "",
        legalName: selectedEstablishment.legalName || "",
        inn: selectedEstablishment.inn || "",
      }));
      const selectedIndustry = parseEstablishmentIndustry(selectedEstablishment.industry);
      setIndustry(selectedIndustry);
      if (value === "landing" || value === "menu" || (value === "reviews" && selectedEstablishment.yandexMapsUrl)) {
        void submitForExistingEstablishment(value, selectedIndustry);
        return;
      }
    }

    setStep("form");
  };

  const chooseIntent = (value: SetupIntent) => {
    trackEvent("setup.intent_selected", {
      intent: value,
      orgMode: usingExistingOrg ? "existing" : orgMode ?? "new",
    });
    setIntent(value);
    setError("");

    if (value === "landing" && !paidFeatures && !rerun) {
      setLandingPaywallOpen(true);
      return;
    }

    proceedWithIntent(value);
  };

  useEffect(() => {
    if (!autoSelectedIntent || autoIntentHandled.current) return;

    if (step === "intent") {
      autoIntentHandled.current = true;
      chooseIntent(autoSelectedIntent);
      return;
    }

    if (step === "form" && intent === autoSelectedIntent) {
      autoIntentHandled.current = true;
      trackEvent("setup.intent_selected", {
        intent: autoSelectedIntent,
        auto: true,
        orgMode: "new",
      });
    }
  }, [step, intent, autoSelectedIntent]);

  const continueFromOrgStep = () => {
    if (!orgMode) return;
    if (orgMode === "existing" && !selectedEstablishmentId) {
      setError("Выберите заведение из списка");
      return;
    }
    setError("");
    if (autoSelectedIntent) {
      autoIntentHandled.current = true;
      chooseIntent(autoSelectedIntent);
      return;
    }
    setStep("intent");
  };

  const downloadQr = async (
    format: "png" | "svg",
    opts?: { transparentBackground?: boolean },
  ) => {
    if (!result) return;
    trackEvent("setup.qr_downloaded", {
      intent: result.intent,
      qrCodeId: result.qrcode.id,
      format,
      transparentBackground: !!opts?.transparentBackground,
    });
    await downloadQrCode(format, scanUrlForCode(result.qrcode.code), `qr-${result.qrcode.code}`, {
      qrStyleTemplateId: result.qrcode.qrStyleTemplateId,
      isPro: false,
      size: QR_EXPORT_SIZE,
      transparentBackground: opts?.transparentBackground,
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

  /** Уйти из мастера до создания проекта — иначе SetupGuideRedirect вернёт обратно. */
  const leaveWizard = (href: string) => {
    trackEvent("setup.wizard_dismissed", { intent: intent ?? null });
    try {
      sessionStorage.setItem(SETUP_GUIDE_DISMISS_KEY, "1");
    } catch {
      /* приватный режим — редирект просто вернёт в мастер */
    }
    router.push(href);
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

  const [downloadType, setDownloadType] = useState<"pdf" | "png">("png");
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
      const href = TEMPLATE_ROUTES.tableTents;
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
      const href = TEMPLATE_ROUTES.qr;
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
      alert("Ошибка генерации PDF. Попробуйте ещё раз.");
    } finally {
      setPdfDownloading(false);
    }
  };

  if (step === "success" && result) {
    const scanUrl = scanUrlForCode(result.qrcode.code);
    const isReviews = result.intent === "reviews";
    const isRedirect = result.intent === "redirect";
    const isMenu = result.intent === "menu";
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
                  Ваш QR-код для заведения <strong className="text-gray-950 font-semibold">{quotedEstablishmentName(result.establishment?.name)}</strong> настроен на сбор отзывов.
                  Пройдите три коротких шага: проверьте сценарий как гость, подготовьте QR к печати и подключите уведомления о новых отзывах.
                </>
              ) : isRedirect ? (
                <>
                  QR-код проекта <strong className="text-gray-950 font-semibold">{quotedEstablishmentName(result.establishment?.name)}</strong> готов.
                  При сканировании гости сразу перейдут по вашей ссылке — её можно поменять в кабинете без перепечатки.
                </>
              ) : isMenu ? (
                <>
                  QR-код ведёт на электронное меню заведения{" "}
                  <strong className="text-gray-950 font-semibold">{quotedEstablishmentName(result.establishment?.name)}</strong>.
                  Отредактируйте позиции и цены в разделе «Микросайт» и разместите QR на столах.
                </>
              ) : (
                <>
                  QR-код ведёт на микросайт проекта <strong className="text-gray-950 font-semibold">{quotedEstablishmentName(result.establishment?.name)}</strong>.
                  Перейдите в раздел «Микросайт», чтобы добавить ссылки, меню, контакты и отзывы.
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
                      Скачайте PNG или SVG, распечатайте сами или отдайте дизайнеру. QR динамический — перепечатывать его после смены ссылок не нужно.
                    </p>
                  </div>
                </div>
              ) : (
                <label className="block text-sm font-bold text-gray-800 text-center mb-3">
                  Как вы планируете разместить QR-код?
                </label>
              )}
            </div>

            <div className="space-y-4 text-center">
                {!isReviews && (
                  <div className="text-center text-xs text-gray-500 leading-relaxed max-w-sm mx-auto">
                    Скачайте QR-код в высоком разрешении (PNG или SVG) для печати или передачи дизайнеру.
                  </div>
                )}
                {qrImageUrl && (
                  <img
                    src={qrImageUrl}
                    alt="QR-код"
                    className="max-w-44 max-h-44 w-auto h-auto mx-auto rounded-xl border border-gray-100 shadow-sm object-contain"
                  />
                )}
                <div className="mx-auto flex max-w-md items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 text-left">
                  <span className="min-w-0 flex-1 break-all font-mono text-xs text-gray-600">
                    {scanUrl}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 bg-white"
                    onClick={() => {
                      const copy = async () => {
                        if (navigator.clipboard) {
                          await navigator.clipboard.writeText(scanUrl);
                        } else {
                          const textarea = document.createElement("textarea");
                          textarea.value = scanUrl;
                          textarea.style.position = "fixed";
                          textarea.style.opacity = "0";
                          document.body.appendChild(textarea);
                          textarea.select();
                          document.execCommand("copy");
                          document.body.removeChild(textarea);
                        }
                        setScanUrlCopied(true);
                        setTimeout(() => setScanUrlCopied(false), 2000);
                      };
                      void copy();
                    }}
                  >
                    {scanUrlCopied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                    {scanUrlCopied ? "Готово" : "Скопировать"}
                  </Button>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => void downloadQr("png")} disabled={!qrImageUrl}>
                    <Download className="w-4 h-4 mr-1" />
                    PNG
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void downloadQr("png", { transparentBackground: true })}
                    disabled={!qrImageUrl}
                    title="Прозрачный фон"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    PNG без фона
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
                          `${TEMPLATE_ROUTES.qr}?${new URLSearchParams({
                            bindQr: result.qrcode.id,
                            ...(result.qrcode.qrStyleTemplateId &&
                            isBuiltInQrStyleTemplateId(result.qrcode.qrStyleTemplateId)
                              ? {
                                  preset: result.qrcode.qrStyleTemplateId.slice(
                                    "qr-preset-".length,
                                  ),
                                }
                              : {}),
                          }).toString()}`,
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
                    По умолчанию отзывы 1–3★ сохраняются в личном кабинете и отправляются на email. Можно подключить Telegram или MAX, чтобы реагировать на жалобы сразу.
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
                  : "В личном кабинете можно поменять цвета QR, добавить логотип и выбрать другое оформление."}
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
                          goNextStep("templates", `${TEMPLATE_ROUTES.qr}?bindQr=${result.qrcode.id}`)
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
                          goNextStep("qrcode-settings", result.establishment?.id
                            ? `${projectQrPath(result.establishment.id, result.qrcode.id)}?welcome=1`
                            : "/dashboard")
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
                      onClick={() =>
                        goNextStep(
                          isMenu ? "my-page-menu" : "my-page",
                          result.establishment?.id
                            ? isMenu
                              ? `${projectPagePath(result.establishment.id)}?section=menu`
                              : projectPagePath(result.establishment.id)
                            : "/dashboard",
                        )
                      }
                    >
                        {isMenu ? "Редактировать меню" : "Оформить и наполнить микросайт"}
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
              "Для какого проекта создаём QR-код?"
            </h1>
            <p className="mx-auto max-w-lg text-sm leading-relaxed text-slate-600 sm:text-base">
              Выберите проект из списка или создайте новый. Затем выберите, куда будет вести QR-код.
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
                  <p className="font-semibold text-slate-900">Существующий проект</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Создать дополнительный QR-код для уже добавленного проекта
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
                  <p className="font-semibold text-slate-900">Новый проект</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {canAddNewEstablishment
                      ? "Добавить новый проект и сгенерировать для него первый QR-код"
                      : (
                        <>
                          Достигнут лимит проектов на вашем тарифе.{" "}
                          <Link
                            href="/dashboard/subscription"
                            className="font-medium text-indigo-600 hover:text-indigo-800"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Обновите подписку
                          </Link>
                          , чтобы добавить новые.
                        </>
                      )}
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
                ? `Какой QR-код нужен для ${quotedEstablishmentName(selectedEstablishment?.name)}?`
                : "С чего начнём?"}
            </h1>
            <p className="mx-auto max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              {usingExistingOrg
                ? "Выберите сценарий работы для нового QR-кода. Вы сможете изменить его в любой момент."
                : "Выберите основной сценарий. Мы создадим проект и сгенерируем QR-код. Настройки можно будет изменить позже."}
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
                Назад к выбору проекта
              </button>
            </div>
          )}

          {utmContext.hint === "reviews" && (
            <div className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950 leading-relaxed">
              Вы перешли по ссылке про сбор отзывов — начните с «Умного сбора отзывов», чтобы гости оставляли оценки на Яндекс.Картах, а жалобы приходили вам напрямую.
            </div>
          )}

          {utmContext.hint === "menu" && (
            <div className="mx-auto max-w-2xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-950 leading-relaxed">
              Вы перешли по ссылке про электронное меню — начните с «QR-меню»: мы создадим заведение, базовое меню и QR-код для столов.
            </div>
          )}

          <div
            className={`grid gap-5 md:items-stretch ${
              visibleIntentOptions.length >= 4
                ? "md:grid-cols-2 max-w-4xl mx-auto"
                : visibleIntentOptions.length <= 2
                  ? "md:grid-cols-2 max-w-3xl mx-auto"
                  : "md:grid-cols-3"
            }`}
          >
            {visibleIntentOptions.map((option) => (
              <IntentOptionCard
                key={option.id}
                option={option}
                recommended={
                  (utmContext.hint === "reviews" && option.id === "reviews") ||
                  (utmContext.hint === "menu" && option.id === "menu") ||
                  (utmContext.hint === "generator" && option.id === "redirect")
                }
                secondary={
                  utmContext.hint === "reviews"
                    ? option.id === "redirect"
                    : utmContext.hint === "menu"
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
              ? "«Сайт-визитка» (PRO) и «QR-меню» тоже подойдут — к ним можно добавить сбор отзывов."
              : utmContext.hint === "menu"
                ? "Нужны отзывы на картах? Выберите «Умный сбор отзывов» — или добавьте их позже в личном кабинете."
                : "Нет карточки на картах? Выберите прямую ссылку или QR-меню. «Умный сбор отзывов» работает только со ссылкой на организацию в Яндекс.Картах."}
          </p>

          {!rerun && (
            <p className="text-center text-sm text-slate-500">
              <button
                type="button"
                className="font-medium text-slate-600 underline-offset-2 hover:text-indigo-600 hover:underline"
                onClick={() => leaveWizard(hasExistingOrgs ? "/dashboard" : "/dashboard/projects")}
              >
                Сначала осмотреться в кабинете
              </button>
            </p>
          )}

          <LandingProPaywall
            open={landingPaywallOpen}
            onClose={() => {
              setLandingPaywallOpen(false);
              setIntent(null);
            }}
          />
        </div>
      </SetupWizardShell>
    );
  }

  const isReviews = intent === "reviews";
  const isRedirect = intent === "redirect";
  const isMenu = intent === "menu";
  const yandexRequired =
    isReviews && (!usingExistingOrg || !selectedEstablishment?.yandexMapsUrl);
  const yandexNeedsCheck = Boolean(yandexRequired && !yandexConfirmedUrl);

  const autoSubmitExisting =
    usingExistingOrg &&
    (intent === "landing" || intent === "menu" || (intent === "reviews" && !!selectedEstablishment?.yandexMapsUrl));

  if (loading && autoSubmitExisting) {
    return (
      <SetupWizardShell>
        <div className="max-w-lg mx-auto w-full text-center space-y-4 py-16">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-100 text-indigo-600">
            <QrCode className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Создаём QR-код…</h1>
          <p className="text-sm text-gray-500">Заведение {quotedEstablishmentName(selectedEstablishment?.name)}</p>
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
            {isReviews
              ? "Настройка сбора отзывов"
              : isRedirect
                ? "Настройка редиректа"
                : isMenu
                  ? "Настройка QR-меню"
                  : "Настройка сайта-визитки"}
          </h1>
          <p className="text-gray-600 max-w-md mx-auto text-sm leading-relaxed">
            {usingExistingOrg ? (
              <>
                Создаём QR-код для заведения{" "}
                <strong className="text-gray-950 font-semibold">{quotedEstablishmentName(selectedEstablishment?.name)}</strong>.
                {isReviews
                  ? " Укажите ссылку на вашу карточку в Яндекс.Картах."
                  : isRedirect
                    ? " Введите ссылку, по которой будут переходить гости."
                    : isMenu
                      ? " Подтвердите создание QR-кода с базовым меню."
                      : " Подтвердите создание QR-кода для визитки."}
              </>
            ) : isReviews ? (
              "Укажите название проекта и ссылку на Яндекс.Карты. Мы сгенерируем QR-код, который сразу начнёт собирать отзывы."
            ) : isRedirect ? (
              "Укажите название проекта и ссылку. QR можно печатать сразу — ссылку потом меняете в кабинете без перепечатки."
            ) : isMenu ? (
              "Введите название проекта. Мы создадим базовое меню с примерами позиций и QR-код для гостей."
            ) : (
              "Введите название проекта. Мы автоматически создадим для него мобильную визитку и рабочий QR-код."
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
          {!isRedirect && (
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
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
            )}

            {!usingExistingOrg && (
              <div>
                <Input
                  label="Название проекта *"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Например: проект, кампания или заведение"
                />
              </div>
            )}

            {isRedirect && (
              <>
                <Input
                  label="Название / метка QR"
                  value={form.qrLabel}
                  onChange={(e) => setForm({ ...form, qrLabel: e.target.value })}
                  placeholder="Например: Сайт, Баннер, Telegram"
                />
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
                    {paidFeatures
                      ? "При сканировании QR-кода гости будут сразу переходить по этой ссылке."
                      : `На бесплатном тарифе гость ${REDIRECT_INTERSTITIAL_SECONDS} сек. видит экран QrStars и переходит по ссылке. В PRO — переход сразу.`}
                  </p>
                </div>
              </>
            )}

            {isReviews && (
              <div>
                <YandexMapsOrgConfirm
                  ref={yandexCheckRef}
                  label={`Ссылка на карточку в Яндекс.Картах${yandexRequired ? " *" : ""}`}
                  value={form.yandexMapsUrl}
                  required={false}
                  previewOnBlur={false}
                  error={yandexUrlFieldError}
                  projectName={selectedEstablishment?.name || form.name}
                  onPreviewReadyChange={setYandexPreviewReady}
                  onChange={(url) => {
                    setYandexUrlFieldError("");
                    setForm({ ...form, yandexMapsUrl: url });
                  }}
                  onConfirmedChange={setYandexConfirmedUrl}
                  onConfirmed={(url) => {
                    setYandexConfirmedUrl(url);
                    void createFromForm(url);
                  }}
                />
                {yandexUrlFieldError && (
                  <button
                    type="button"
                    onClick={() => {
                      setStep("intent");
                      setError("");
                      setYandexUrlFieldError("");
                    }}
                    className="mt-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    Назад к выбору сценария — прямая ссылка или QR-меню, если карточки нет
                  </button>
                )}
                <p className="text-xs text-gray-500 mt-1.5 flex items-start gap-1 leading-relaxed">
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-500" />
                  Гости с оценкой 4–5★ перейдут сюда оставить отзыв. Нужна ссылка именно на вашу
                  организацию, не на поиск.
                </p>
                <YandexMapsUrlHelper
                  defaultOpen={!form.yandexMapsUrl.trim()}
                  searchName={form.name || selectedEstablishment?.name || ""}
                />
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  Дополнительные площадки (2GIS, Flamp, Авито) можно добавить позже в{" "}
                  <Link href="/dashboard/projects" className="text-indigo-600 hover:text-indigo-800 font-medium">
                    настройках проекта
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
                  <YandexMapsOrgConfirm
                    label="Ссылка на Яндекс.Карты (необязательно)"
                    value={form.yandexMapsUrl}
                    onChange={(url) => setForm({ ...form, yandexMapsUrl: url })}
                    onConfirmedChange={setYandexConfirmedUrl}
                    placeholder="https://yandex.ru/maps/org/..."
                  />
                  <p className="text-xs text-gray-500 mt-1.5 flex items-start gap-1 leading-relaxed">
                    <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-500" />
                    Если указать ссылку, на визитке появится блок сбора отзывов. Довольных гостей мы направим на Яндекс.Карты.
                  </p>
                </div>
              </>
            )}

            {!isRedirect && intent !== "reviews" && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-4 space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Реквизиты для политики персональных данных
                  </p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {LEGAL_REQUISITES_HINT}
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
                    ✓ {LEGAL_REQUISITES_READY}
                  </p>
                ) : form.legalName.trim() || form.inn.trim() ? (
                  <p className="text-xs text-amber-600">
                    ⚠ {LEGAL_REQUISITES_INCOMPLETE}
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
              <Button
                type={yandexNeedsCheck ? "button" : "submit"}
                className="flex-1"
                disabled={loading || (yandexNeedsCheck && yandexPreviewReady)}
                onClick={
                  yandexNeedsCheck
                    ? () => {
                        if (!form.yandexMapsUrl.trim()) {
                          setYandexUrlFieldError(
                            "Укажите ссылку на карточку в Яндекс.Картах. Если карточки нет — вернитесь и выберите прямую ссылку или QR-меню."
                          );
                          return;
                        }
                        void yandexCheckRef.current?.check();
                      }
                    : undefined
                }
              >
                {loading ? (
                  "Создаём..."
                ) : yandexNeedsCheck && !yandexPreviewReady ? (
                  "Проверить ссылку"
                ) : (
                  <>
                    <QrCode className="w-5 h-5 mr-2" />
                    Создать QR-код
                  </>
                )}
              </Button>
            </div>
            {!isReviews && !isRedirect && (
              <p className="text-xs text-gray-500 text-center leading-relaxed pt-1">
                {isMenu
                  ? "Добавить фото, изменить цены и включить корзину можно в разделе «Микросайт»."
                  : "Наполнить визитку (добавить меню, Wi‑Fi, ссылки на соцсети) можно будет в личном кабинете."}
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
          ) : isMenu ? (
            <ul className="list-disc list-inside space-y-1.5 text-xs text-gray-600 leading-relaxed">
              <li>QR-код с готовым меню из нескольких категорий и позиций</li>
              <li>Редактор меню в личном кабинете — цены, фото, описания</li>
              <li>Гости видят меню сразу после сканирования, без приложений</li>
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
