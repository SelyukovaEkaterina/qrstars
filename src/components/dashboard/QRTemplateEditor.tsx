"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Shuffle,
  ImageIcon,
  X,
  Save,
  Check,
  Link2,
  Wifi,
  Type,
  Mail,
  Phone,
  IdCard,
  MessageSquare,
  AlertTriangle,
  ChevronDown,
  QrCode,
  Plus,
  Send,
  MessageCircle,
  RussianRuble,
  Star,
  Maximize2,
  Info,
  Ban,
  Sparkles,
} from "lucide-react";
import { scanUrlForCode } from "@/lib/utils";
import {
  type QRTemplateConfig,
  type QRTemplatePreset,
  type QRDotStyle,
  type QREyeStyle,
  COLOR_PRESETS,
  CENTER_TEXT_FONTS,
  DOT_STYLE_OPTIONS,
  SILHOUETTE_OPTIONS,
  LOGO_PRESETS,
  SCATTER_SHAPES,
  parseCenterTextLines,
  renderQRTemplate,
  renderQRTemplateSvg,
  downloadQRTemplateAsPNG,
  downloadQRTemplateAsJPG,
  downloadSvgString,
  randomizeQRConfig,
  normalizeQRTemplateConfig,
  QR_CODE_TEMPLATES,
} from "@/lib/qr-code-templates";
import { QR_EXPORT_SIZE, QR_EXPORT_SIZES } from "@/lib/qr-download";
import {
  type QRContentState,
  type QRContentType,
  DEFAULT_QR_CONTENT,
  buildQRPayloadResult,
  compressImageToDataUrl,
  loadLogoPreset,
  resolveLogoImage,
  resolvePhotoImage,
  resolveSilhouetteImage,
  PHOTO_PRESETS,
  renderDotStylePreview,
  renderEyeStylePreview,
} from "@/lib/qr-free-generator";
import {
  checkScanLevel,
  renderSilhouettePreview,
  QR_BASE_SIZE,
  SCAN_LEVEL_TEXT,
  ART_PRESET_CATEGORIES,
  type ArtPresetCategory,
  type QrLayout,
  type QrScanLevel,
} from "@/lib/qr-engine";
import QRMockupDialog from "@/components/dashboard/QRMockupDialog";
import { TEMPLATES_CHANGED_EVENT } from "@/components/dashboard/GeneratorStyleImporter";

type UserQR = {
  id: string;
  code: string;
  label: string | null;
  mode: string;
  establishment?: { name: string } | null;
};

type Props = {
  preset: QRTemplatePreset;
  existingId?: string;
  existingName?: string;
  bindQrId?: string;
  onClose: () => void;
  onSaved?: (id: string, name: string, config: QRTemplateConfig) => void;
  onBound?: (qrId: string, templateId: string) => void;
};

function qrDisplayName(qr: UserQR): string {
  if (qr.label?.trim()) return qr.label.trim();
  if (qr.establishment?.name) return qr.establishment.name;
  return qr.code;
}

const CONTENT_TABS: { id: QRContentType; label: string; icon: React.ReactNode }[] = [
  { id: "url", label: "Ссылка", icon: <Link2 size={15} /> },
  { id: "wifi", label: "Wi‑Fi", icon: <Wifi size={15} /> },
  { id: "telegram", label: "Telegram", icon: <Send size={15} /> },
  { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle size={15} /> },
  { id: "pay", label: "Оплата", icon: <RussianRuble size={15} /> },
  { id: "maps", label: "Карты", icon: <Star size={15} /> },
  { id: "text", label: "Текст", icon: <Type size={15} /> },
  { id: "phone", label: "Телефон", icon: <Phone size={15} /> },
  { id: "email", label: "Email", icon: <Mail size={15} /> },
  { id: "vcard", label: "Контакт", icon: <IdCard size={15} /> },
  { id: "sms", label: "SMS", icon: <MessageSquare size={15} /> },
];

type FieldDef = {
  id: string;
  label: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  type?: string;
  multiline?: boolean;
  /** Половина ширины на ≥640px. */
  half?: boolean;
  options?: { value: string; label: string }[];
  mono?: boolean;
};

/** Поля статического QR. id совпадают с `qr-engine/payload.ts` (там же проверка). */
const CONTENT_FIELDS: Record<QRContentType, FieldDef[]> = {
  url: [{ id: "input-url", label: "Адрес ссылки", placeholder: "https://example.com", inputMode: "url", type: "url" }],
  wifi: [
    { id: "input-wifi-ssid", label: "Название сети (SSID)", placeholder: "MyNetwork" },
    { id: "input-wifi-pass", label: "Пароль", placeholder: "••••••••" },
    {
      id: "input-wifi-enc",
      label: "Шифрование",
      options: [
        { value: "WPA", label: "WPA/WPA2" },
        { value: "WEP", label: "WEP" },
        { value: "nopass", label: "Без пароля" },
      ],
    },
  ],
  telegram: [{ id: "input-tg", label: "Username или ссылка", placeholder: "@qrstars или t.me/qrstars" }],
  whatsapp: [
    { id: "input-wa-phone", label: "Номер WhatsApp", placeholder: "+7 999 123-45-67", inputMode: "tel", type: "tel" },
    { id: "input-wa-text", label: "Готовое сообщение (необязательно)", placeholder: "Здравствуйте! Хочу записаться", multiline: true },
  ],
  pay: [
    { id: "input-pay-name", label: "Получатель", placeholder: "ИП Иванов Иван Иванович" },
    { id: "input-pay-acc", label: "Расчётный счёт", placeholder: "40802810000000000000", inputMode: "numeric", half: true, mono: true },
    { id: "input-pay-bic", label: "БИК банка", placeholder: "044525225", inputMode: "numeric", half: true, mono: true },
    { id: "input-pay-bank", label: "Банк", placeholder: "ПАО Сбербанк", half: true },
    { id: "input-pay-corr", label: "Корр. счёт", placeholder: "30101810400000000225", inputMode: "numeric", half: true, mono: true },
    { id: "input-pay-inn", label: "ИНН (необязательно)", placeholder: "7700000000", inputMode: "numeric", half: true, mono: true },
    { id: "input-pay-sum", label: "Сумма, ₽ (необязательно)", placeholder: "1500", inputMode: "decimal", half: true },
    { id: "input-pay-purpose", label: "Назначение платежа (необязательно)", placeholder: "Оплата по счёту №15" },
  ],
  maps: [
    { id: "input-maps", label: "Ссылка на карточку в Яндекс Картах или 2ГИС", placeholder: "https://yandex.ru/maps/org/…", inputMode: "url", type: "url" },
  ],
  text: [{ id: "input-text", label: "Произвольный текст", placeholder: "Введите текст…", multiline: true }],
  phone: [{ id: "input-phone", label: "Номер телефона", placeholder: "+7 (999) 123-45-67", inputMode: "tel", type: "tel" }],
  email: [
    { id: "input-email-addr", label: "Email-адрес", placeholder: "hello@example.com", inputMode: "email", type: "email" },
    { id: "input-email-subj", label: "Тема (необязательно)", placeholder: "Тема письма" },
    { id: "input-email-body", label: "Сообщение (необязательно)", placeholder: "Текст письма…", multiline: true },
  ],
  vcard: [
    { id: "input-vcard-fname", label: "Имя", placeholder: "Иван", half: true },
    { id: "input-vcard-lname", label: "Фамилия", placeholder: "Иванов", half: true },
    { id: "input-vcard-phone", label: "Телефон", placeholder: "+7 999 123-45-67", inputMode: "tel", type: "tel", half: true },
    { id: "input-vcard-email", label: "Email", placeholder: "ivan@mail.ru", inputMode: "email", type: "email", half: true },
    { id: "input-vcard-org", label: "Организация", placeholder: "ООО Ромашка" },
    { id: "input-vcard-url", label: "Сайт", placeholder: "https://example.com", inputMode: "url", type: "url" },
  ],
  sms: [
    { id: "input-sms-phone", label: "Номер получателя", placeholder: "+7 999 123-45-67", inputMode: "tel", type: "tel" },
    { id: "input-sms-body", label: "Текст сообщения", placeholder: "Здравствуйте…", multiline: true },
  ],
};

const CONTENT_HINTS: Partial<Record<QRContentType, string>> = {
  telegram: "Подойдёт профиль, канал, группа или бот.",
  pay: "Формат ГОСТ Р 56042: Сбербанк, Т‑Банк, ВТБ, Альфа-Банк откроют перевод с заполненными реквизитами. Это не QR СБП — его выдаёт банк.",
  maps: "Статический код просто откроет карточку. Чтобы жалобы 1–3★ приходили вам, а не на карты, используйте динамический QR в режиме «Сбор отзывов».",
};

const MOCK_CAPTIONS: Partial<Record<QRContentType, string>> = {
  wifi: "Wi‑Fi для гостей",
  telegram: "Мы в Telegram",
  whatsapp: "Напишите в WhatsApp",
  pay: "Оплата по QR",
  maps: "Оцените нас",
  vcard: "Сохраните контакт",
};

const DOT_STYLES = DOT_STYLE_OPTIONS;

const EYE_STYLES: { id: QREyeStyle; label: string }[] = [
  { id: "square", label: "Квадрат" },
  { id: "rounded", label: "Скруглён." },
  { id: "circle", label: "Круг" },
  { id: "leaf", label: "Лист" },
  { id: "dot", label: "Точка" },
];

/** Сколько логотипов видно на десктопе до «+N»: два ряда вместе с «без логотипа» и кнопкой. */
const LOGOS_COLLAPSED = 14;

const TOO_MUCH_DATA = "Слишком много данных для одного QR — сократите текст или поставьте коррекцию L в «Дополнительно».";
const INPUT_CLASS =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

type DownloadKind = "png" | "png-transparent" | "jpg" | "svg";

function StyleThumb({ style, active, onClick }: { style: QRDotStyle; active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) renderDotStylePreview(ref.current, style);
  }, [style]);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border-2 py-2 transition-all ${active ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}
    >
      <canvas ref={ref} width={40} height={40} className="rounded" />
      <span className="text-xs text-gray-600">{DOT_STYLES.find((s) => s.id === style)?.label}</span>
    </button>
  );
}

function SilhouetteThumb({
  id,
  label,
  active,
  onClick,
}: {
  id: (typeof SILHOUETTE_OPTIONS)[number]["id"];
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) renderSilhouettePreview(ref.current, id, active ? "#4f46e5" : "#334155");
  }, [id, active]);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 transition-all ${active ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}
    >
      <canvas ref={ref} width={56} height={56} className="h-7 w-7" />
      <span className={`max-w-full truncate text-[11px] font-medium ${active ? "text-indigo-700" : "text-gray-600"}`}>{label}</span>
    </button>
  );
}

function EyeThumb({ eye, active, onClick }: { eye: QREyeStyle; active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) renderEyeStylePreview(ref.current, eye);
  }, [eye]);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border-2 py-2 transition-all ${active ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}
    >
      <canvas ref={ref} width={40} height={40} className="rounded" />
      <span className="text-xs text-gray-600">{EYE_STYLES.find((s) => s.id === eye)?.label}</span>
    </button>
  );
}

/** Копия готового кадра в видимый canvas (превью на десктопе и миниатюра в нижней панели). */
const ART_STYLES = QR_CODE_TEMPLATES.filter((p) => p.art);
/** Во «Все» сначала два ряда: 33 карточки выталкивали настройки за экран. */
const ART_COLLAPSED = 12;

/** Миниатюры рисуются по одной в свободное время: 30+ отрисовок разом подвешивали страницу. */
let artThumbQueue: Promise<void> = Promise.resolve();
const idle = () =>
  new Promise<void>((resolve) => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => resolve(), { timeout: 500 });
    else setTimeout(resolve, 16);
  });

function ArtThumb({ preset, active, onClick }: { preset: QRTemplatePreset; active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    artThumbQueue = artThumbQueue.then(async () => {
      const c = ref.current;
      if (cancelled || !c) return;
      const cfg = normalizeQRTemplateConfig({ ...preset.config });
      const [logo, photo] = await Promise.all([resolveLogoImage(cfg), resolvePhotoImage(cfg)]);
      await renderQRTemplate(c, cfg, "https://qrstars.ru", 200, photo, logo).catch(() => {});
      await idle();
    });
    return () => {
      cancelled = true;
    };
  }, [preset]);
  return (
    <button
      type="button"
      onClick={onClick}
      title={preset.description}
      aria-pressed={active}
      className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition-all ${active ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}
    >
      <canvas ref={ref} className="aspect-square h-auto w-full object-contain" />
      <span className="text-center text-xs font-medium leading-tight text-gray-700">{preset.name}</span>
    </button>
  );
}

function copyCanvas(source: HTMLCanvasElement, target: HTMLCanvasElement | null) {
  if (!target) return;
  target.width = source.width;
  target.height = source.height;
  target.getContext("2d")?.drawImage(source, 0, 0);
}

function readFileAsImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Не удалось открыть картинку"));
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function eccWithLogo(ecc: QRTemplateConfig["ecc"]): QRTemplateConfig["ecc"] {
  // Логотип или надпись закрывают центр кода — нужна максимальная коррекция ошибок.
  return ecc === "L" || ecc === "M" ? "H" : ecc;
}

export default function QRTemplateEditor({
  preset,
  existingId,
  existingName,
  bindQrId,
  onClose,
  onSaved,
  onBound,
}: Props) {
  const router = useRouter();
  const [cfg, setCfg] = useState<QRTemplateConfig>(() => normalizeQRTemplateConfig({ ...preset.config }));
  const initialCfgKey = useRef(JSON.stringify(normalizeQRTemplateConfig({ ...preset.config })));
  const [content, setContent] = useState<QRContentState>(() => ({
    type: DEFAULT_QR_CONTENT.type,
    fields: { ...DEFAULT_QR_CONTENT.fields },
  }));
  const [userQrcodes, setUserQrcodes] = useState<UserQR[]>([]);
  const [contentSource, setContentSource] = useState<"manual" | "dynamic">("dynamic");
  const [selectedQrId, setSelectedQrId] = useState<string | null>(bindQrId ?? null);
  /** Без `bindQrId` стиль к QR не привязывается, пока человек сам не отметит. */
  const [applyToSelected, setApplyToSelected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [photoImage, setPhotoImage] = useState<HTMLImageElement | null>(null);
  const [silhouetteImage, setSilhouetteImage] = useState<HTMLImageElement | null>(null);
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const [logoLoading, setLogoLoading] = useState(
    () =>
      !!(
        preset.config.logoDataUrl ||
        preset.config.logoSrc ||
        preset.config.logoPreset ||
        preset.config.photoDataUrl ||
        preset.config.photoSrc ||
        preset.config.silhouetteDataUrl
      ),
  );
  const [saveName, setSaveName] = useState(existingName || preset.name);
  const [exportSize, setExportSize] = useState<number>(QR_EXPORT_SIZE);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [scanLevel, setScanLevel] = useState<QrScanLevel>("ok");
  const [hasRender, setHasRender] = useState(false);
  const [mockupUrl, setMockupUrl] = useState<string | null>(null);
  const [randomizing, setRandomizing] = useState(false);
  const [logosExpanded, setLogosExpanded] = useState(false);
  const [artCategory, setArtCategory] = useState<ArtPresetCategory | "all">("all");
  const [artExpanded, setArtExpanded] = useState(false);
  /** Выбранный арт-стиль подсвечивается, пока оформление не правили вручную. */
  const [artApplied, setArtApplied] = useState<{ id: string; key: string } | null>(() =>
    preset.art ? { id: preset.id, key: JSON.stringify(normalizeQRTemplateConfig({ ...preset.config })) } : null,
  );
  const logoFileRef = useRef<HTMLInputElement>(null);
  const photoFileRef = useRef<HTMLInputElement>(null);
  const silhouetteFileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const thumbRef = useRef<HTMLCanvasElement>(null);
  const lastRender = useRef<{ canvas: HTMLCanvasElement; layout: QrLayout } | null>(null);
  const renderSeq = useRef(0);
  /** id шаблона после первого сохранения — повторное сохранение обновляет его, а не создаёт копию. */
  const savedIdRef = useRef<string | undefined>(existingId);

  const up = useCallback(
    <K extends keyof QRTemplateConfig>(k: K, v: QRTemplateConfig[K]) => setCfg((prev) => ({ ...prev, [k]: v })),
    [],
  );
  const setField = (id: string, value: string) =>
    setContent((prev) => ({ ...prev, fields: { ...prev.fields, [id]: value } }));

  // ── Данные ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/qrcodes")
      .then((r) => r.json())
      .then((d) => {
        const list: UserQR[] = d.qrcodes || [];
        setUserQrcodes(list);
        setSelectedQrId((prev) => {
          if (bindQrId && list.some((q) => q.id === bindQrId)) return bindQrId;
          if (prev && list.some((q) => q.id === prev)) return prev;
          return list[0]?.id ?? null;
        });
        if (list.length === 0) setContentSource("manual");
      })
      .catch(() => {});
  }, [bindQrId]);

  // Логотип и фото из сохранённого шаблона. Пока грузятся, «Сохранить» недоступно —
  // иначе шаблон уходил без логотипа.
  const initialConfigRef = useRef(preset.config);
  useEffect(() => {
    let cancelled = false;
    const initial = normalizeQRTemplateConfig({ ...initialConfigRef.current });
    Promise.all([
      initial.centerMode === "text" ? Promise.resolve(null) : resolveLogoImage(initial),
      resolvePhotoImage(initial),
      resolveSilhouetteImage(initial),
    ]).then(([logo, photo, silhouette]) => {
      if (cancelled) return;
      setLogoImage(logo);
      setPhotoImage(photo);
      setSilhouetteImage(silhouette);
      setLogoLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const selectedQr = userQrcodes.find((q) => q.id === selectedQrId) ?? null;
  const payloadResult = useMemo(
    () =>
      contentSource === "dynamic"
        ? selectedQr
          ? ({ kind: "ok", payload: scanUrlForCode(selectedQr.code) } as const)
          : ({ kind: "empty" } as const)
        : buildQRPayloadResult(content),
    [contentSource, selectedQr, content],
  );
  const payload = payloadResult.kind === "ok" ? payloadResult.payload : null;
  const logoForRender = cfg.centerMode === "text" ? null : logoImage;
  const requestClose = useCallback(() => {
    const dirty = JSON.stringify(cfg) !== initialCfgKey.current;
    if (dirty && !window.confirm("Закрыть без сохранения? Изменения оформления пропадут.")) return;
    onClose();
  }, [cfg, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !mockupUrl) requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose, mockupUrl]);

  // ── Отрисовка и проверка сканируемости ─────────────────────────────────────
  useEffect(() => {
    const seq = ++renderSeq.current;
    const t = window.setTimeout(async () => {
      if (!payload) {
        lastRender.current = null;
        setHasRender(false);
        setRenderError(null);
        setScanLevel("ok");
        return;
      }
      // Рисуем во временный canvas: параллельные рендеры не дорисовывают друг друга.
      const off = document.createElement("canvas");
      let layout: QrLayout;
      try {
        layout = await renderQRTemplate(off, cfg, payload, 600, photoImage, logoForRender, silhouetteImage);
      } catch {
        if (seq === renderSeq.current) {
          setRenderError(TOO_MUCH_DATA);
          setHasRender(false);
        }
        return;
      }
      if (seq !== renderSeq.current) return;
      lastRender.current = { canvas: off, layout };
      copyCanvas(off, previewRef.current);
      copyCanvas(off, thumbRef.current);
      setRenderError(null);
      setHasRender(true);
      // Декодер — до 10 попыток на кадр: ждём паузы во вводе и свободного времени.
      window.setTimeout(async () => {
        if (seq !== renderSeq.current) return;
        const { default: jsQR } = await import("jsqr");
        const run = () => {
          if (seq !== renderSeq.current) return;
          setScanLevel(checkScanLevel(off, layout, jsQR));
        };
        if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 800 });
        else run();
      }, 400);
    }, 100);
    return () => window.clearTimeout(t);
  }, [cfg, payload, photoImage, logoForRender, silhouetteImage]);

  // Canvas появляется после первого рендера — дорисовываем в него последний кадр.
  const attachPreview = useCallback((node: HTMLCanvasElement | null) => {
    previewRef.current = node;
    if (node && lastRender.current) copyCanvas(lastRender.current.canvas, node);
  }, []);
  const attachThumb = useCallback((node: HTMLCanvasElement | null) => {
    thumbRef.current = node;
    if (node && lastRender.current) copyCanvas(lastRender.current.canvas, node);
  }, []);

  // ── Центр: логотип / текст ─────────────────────────────────────────────────
  const centerLineSlots = (): [string, string, string] => {
    const parts = (cfg.centerText ?? "").split("\n");
    return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
  };
  const setCenterLineSlot = (index: 0 | 1 | 2, value: string) => {
    const slots = centerLineSlots();
    slots[index] = value;
    setCfg((prev) => ({ ...prev, centerText: slots.join("\n"), ecc: eccWithLogo(prev.ecc) }));
  };

  const clearLogo = () => {
    setLogoImage(null);
    setCfg((prev) => ({ ...prev, logoPreset: null, logoSrc: null, logoDataUrl: null }));
    if (logoFileRef.current) logoFileRef.current.value = "";
  };

  const switchCenterMode = (mode: "image" | "text") => {
    if (mode === cfg.centerMode) return;
    if (mode === "text") {
      clearLogo();
      up("centerMode", "text");
    } else {
      setCfg((prev) => ({ ...prev, centerMode: "image", centerText: "" }));
    }
  };

  const selectLogoPreset = async (idx: number) => {
    const p = LOGO_PRESETS[idx];
    try {
      const img = await loadLogoPreset(p);
      setLogoImage(img);
      setCfg((prev) => ({
        ...prev,
        centerMode: "image",
        centerText: "",
        logoPreset: p.emoji || null,
        logoSrc: p.src || null,
        logoDataUrl: null,
        ecc: eccWithLogo(prev.ecc),
      }));
    } catch {
      setNotice({ kind: "error", text: "Не удалось загрузить логотип" });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const original = await readFileAsImage(file);
      // В шаблоне храним 512 px PNG: этого хватает для печати 20 см, а не 5 МБ исходника.
      const dataUrl = compressImageToDataUrl(original, 512, "image/png");
      const img = await loadImage(dataUrl);
      setLogoImage(img);
      setCfg((prev) => ({
        ...prev,
        centerMode: "image",
        centerText: "",
        logoPreset: null,
        logoSrc: null,
        logoDataUrl: dataUrl,
        ecc: "H",
      }));
    } catch {
      setNotice({ kind: "error", text: "Не удалось открыть картинку логотипа" });
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const original = await readFileAsImage(file);
      const dataUrl = compressImageToDataUrl(original, 1200, "image/jpeg", 0.82);
      setPhotoImage(await loadImage(dataUrl));
      setCfg((prev) => ({ ...prev, photoSrc: null, photoDataUrl: dataUrl }));
    } catch {
      setNotice({ kind: "error", text: "Не удалось открыть фото" });
    }
  };

  const selectPhotoPreset = (src: string) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setPhotoImage(img);
      setCfg((prev) => ({ ...prev, photoSrc: src, photoDataUrl: null }));
    };
    img.src = src;
  };

  const clearPhoto = () => {
    setPhotoImage(null);
    setCfg((prev) => ({ ...prev, photoSrc: null, photoDataUrl: null }));
    if (photoFileRef.current) photoFileRef.current.value = "";
  };

  const handleSilhouetteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const original = await readFileAsImage(file);
      // PNG, чтобы сохранилась прозрачность: по ней и вырезается фигура.
      const dataUrl = compressImageToDataUrl(original, 512, "image/png");
      setSilhouetteImage(await loadImage(dataUrl));
      setCfg((prev) => ({ ...prev, silhouette: "custom", silhouetteDataUrl: dataUrl, scatter: false }));
    } catch {
      setNotice({ kind: "error", text: "Не удалось открыть картинку фигуры" });
    }
  };

  /** «Форма кода»: фигура важнее узора — движок с силуэтом узор не рисует. */
  const codeShape: "none" | "figure" | "pattern" =
    cfg.silhouette && cfg.silhouette !== "none" ? "figure" : cfg.scatter ? "pattern" : "none";
  /** Последняя фигура — к ней возвращает режим «Фигура». */
  const lastSilhouette = useRef<Exclude<NonNullable<QRTemplateConfig["silhouette"]>, "none" | "custom">>("heart");

  const setCodeShape = (mode: typeof codeShape) => {
    if (mode === "figure") {
      selectSilhouette(lastSilhouette.current);
      return;
    }
    // Фигура могла прийти из пресета, а не кликом — запоминаем её при уходе из режима.
    if (cfg.silhouette && cfg.silhouette !== "none" && cfg.silhouette !== "custom") lastSilhouette.current = cfg.silhouette;
    selectSilhouette("none");
    up("scatter", mode === "pattern");
  };

  const selectSilhouette = (id: NonNullable<QRTemplateConfig["silhouette"]>) => {
    if (id !== "none" && id !== "custom") lastSilhouette.current = id;
    setCfg((prev) => ({
      ...prev,
      silhouette: id,
      scatter: id !== "none" ? false : prev.scatter,
      // Своя фигура хранится, только пока выбрана: иначе шаблон таскал бы лишние 100+ КБ.
      silhouetteDataUrl: id === "custom" ? prev.silhouetteDataUrl ?? null : null,
      margin: id !== "none" ? Math.min(prev.margin, 2) : prev.margin,
    }));
    if (id !== "custom") {
      setSilhouetteImage(null);
      if (silhouetteFileRef.current) silhouetteFileRef.current.value = "";
    }
  };

  const goCreateDynamic = () => {
    onClose();
    router.push("/dashboard/qrcodes/new");
  };

  // ── Арт-стиль в один клик ─────────────────────────────────────────────────
  const applyArtStyle = async (art: QRTemplatePreset) => {
    // Свой загруженный логотип и фото не трогаем — человек их уже выбрал.
    const ownLogo = cfg.centerMode === "image" && cfg.logoDataUrl ? cfg.logoDataUrl : null;
    const ownPhoto = cfg.photoDataUrl ?? null;
    const next = normalizeQRTemplateConfig({
      ...art.config,
      centerTextColor: art.config.fg,
      ...(ownLogo ? { logoPreset: null, logoSrc: null, logoDataUrl: ownLogo, ecc: eccWithLogo(art.config.ecc) } : {}),
      ...(ownPhoto ? { photoSrc: null, photoDataUrl: ownPhoto } : {}),
    });
    const [logo, photo] = await Promise.all([
      ownLogo ? Promise.resolve(logoImage) : resolveLogoImage(next),
      ownPhoto ? Promise.resolve(photoImage) : resolvePhotoImage(next),
    ]);
    setLogoImage(logo);
    setPhotoImage(photo);
    setSilhouetteImage(null);
    if (silhouetteFileRef.current) silhouetteFileRef.current.value = "";
    setCfg(next);
    setArtApplied({ id: art.id, key: JSON.stringify(next) });
  };
  const activeArtId = artApplied && artApplied.key === JSON.stringify(cfg) ? artApplied.id : null;
  const artInCategory = ART_STYLES.filter((p) => artCategory === "all" || p.art?.category === artCategory);
  const artCollapsed = artCategory === "all" && !artExpanded;
  const artVisible = artCollapsed
    ? artInCategory.filter((p, i) => i < ART_COLLAPSED || p.id === activeArtId)
    : artInCategory;

  // ── Случайное оформление: перебираем, пока декодер уверенно читает ────────
  const handleRandomize = async () => {
    if (randomizing) return;
    setRandomizing(true);
    try {
      const { default: jsQR } = await import("jsqr");
      let next = randomizeQRConfig();
      let logo: HTMLImageElement | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        next = randomizeQRConfig();
        logo = await resolveLogoImage(next);
        if (!payload) break;
        const off = document.createElement("canvas");
        const layout = await renderQRTemplate(off, next, payload, 600, null, logo);
        if (checkScanLevel(off, layout, jsQR) === "ok") break;
      }
      setLogoImage(logo);
      setPhotoImage(null);
      setSilhouetteImage(null);
      setCfg(next);
    } finally {
      setRandomizing(false);
    }
  };

  // ── Сохранение ─────────────────────────────────────────────────────────────
  const configForSave = (): QRTemplateConfig => {
    if (cfg.centerMode === "text") return { ...cfg, logoPreset: null, logoSrc: null, logoDataUrl: null };
    return { ...cfg, centerText: "" };
  };

  const bindTarget = bindQrId ?? (applyToSelected && contentSource === "dynamic" ? selectedQrId : null);
  const bindTargetQr = userQrcodes.find((q) => q.id === bindTarget) ?? null;

  const bindTemplateToQr = async (templateId: string, qrId: string): Promise<boolean> => {
    const res = await fetch("/api/qrcodes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: qrId, qrStyleTemplateId: templateId }),
    });
    if (!res.ok) return false;
    onBound?.(qrId, templateId);
    return true;
  };

  const handleSave = async () => {
    const name = saveName.trim();
    if (!name) {
      setNotice({ kind: "error", text: "Укажите название стиля" });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const config = configForSave();
      const layout = { __type: "qr-style", config };
      const currentId = savedIdRef.current;
      const res = await fetch(currentId ? `/api/templates/${currentId}` : "/api/templates", {
        method: currentId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, layout }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setNotice({ kind: "error", text: data?.error || "Не удалось сохранить стиль. Попробуйте ещё раз." });
        return;
      }
      const templateId: string = currentId ?? (await res.json()).template.id;
      savedIdRef.current = templateId;
      if (bindTarget && !(await bindTemplateToQr(templateId, bindTarget))) {
        // Редактор не закрываем, иначе ошибка потеряется; список шаблонов обновится сам.
        window.dispatchEvent(new Event(TEMPLATES_CHANGED_EVENT));
        setNotice({ kind: "error", text: "Стиль сохранён, но не привязался к QR-коду. Попробуйте ещё раз или выберите стиль в карточке QR." });
        return;
      }
      initialCfgKey.current = JSON.stringify(cfg);
      // Родитель закрывает редактор в onSaved — вызываем после привязки, чтобы ошибка не потерялась.
      onSaved?.(templateId, name, config);
      setNotice({ kind: "ok", text: bindTarget ? "Сохранено и применено к QR" : "Стиль сохранён" });
    } catch {
      setNotice({ kind: "error", text: "Нет связи с сервером. Попробуйте ещё раз." });
    } finally {
      setBusy(false);
    }
  };

  // ── Скачивание ─────────────────────────────────────────────────────────────
  const downloadBaseName = selectedQr && contentSource === "dynamic" ? `qr-${selectedQr.code}` : `qr-${preset.id}`;

  const handleDownload = async (kind: DownloadKind) => {
    if (!payload) return;
    setBusy(true);
    try {
      if (kind === "svg") {
        const svg = await renderQRTemplateSvg(cfg, payload, photoImage, logoForRender, silhouetteImage);
        await downloadSvgString(svg, downloadBaseName);
        return;
      }
      const c = document.createElement("canvas");
      const exportCfg = kind === "png-transparent" ? { ...cfg, bgTransparent: true } : cfg;
      // Размер — ширина всей картинки вместе с рамкой и узором, как подписано в списке.
      const canvasW = lastRender.current?.layout.canvasW ?? QR_BASE_SIZE;
      await renderQRTemplate(c, exportCfg, payload, (exportSize * QR_BASE_SIZE) / canvasW, photoImage, logoForRender, silhouetteImage);
      const name = `${downloadBaseName}-${exportSize}px${kind === "png-transparent" ? "-transparent" : ""}`;
      if (kind === "jpg") await downloadQRTemplateAsJPG(c, name);
      else await downloadQRTemplateAsPNG(c, name);
    } catch {
      setNotice({ kind: "error", text: "Не удалось подготовить файл" });
    } finally {
      setBusy(false);
    }
  };

  const openMockup = () => {
    if (!lastRender.current) return;
    setMockupUrl(lastRender.current.canvas.toDataURL("image/png"));
  };

  const saveLabel = bindTarget
    ? existingId
      ? "Сохранить и применить к QR"
      : "Сохранить и применить"
    : existingId
      ? "Сохранить изменения"
      : "Сохранить в библиотеку";

  const downloadControls = (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="qr-export-size" className="text-xs font-medium text-gray-500">
          Размер PNG / JPG
        </label>
        <select
          id="qr-export-size"
          value={exportSize}
          onChange={(e) => setExportSize(Number(e.target.value))}
          className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm"
        >
          {QR_EXPORT_SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleDownload("png")}
          disabled={busy || !hasRender}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-gray-900 text-sm font-semibold text-white disabled:opacity-40"
        >
          <Download size={15} /> PNG
        </button>
        <button
          type="button"
          onClick={() => handleDownload("svg")}
          disabled={busy || !hasRender}
          title="Вектор для типографии"
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          <Download size={15} /> SVG
        </button>
        <button
          type="button"
          onClick={() => handleDownload("png-transparent")}
          disabled={busy || !hasRender}
          className="flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          <Download size={15} /> PNG без фона
        </button>
        <button
          type="button"
          onClick={() => handleDownload("jpg")}
          disabled={busy || !hasRender}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          <Download size={15} /> JPG
        </button>
      </div>
    </div>
  );

  const scanAlert =
    scanLevel !== "ok" && hasRender ? (
      <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
        <span>{SCAN_LEVEL_TEXT[scanLevel]}</span>
      </div>
    ) : null;

  const saveBlock = (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-500">Название стиля</span>
        <input
          type="text"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          maxLength={60}
          placeholder="Например: Кофейня — фирменный"
          className={INPUT_CLASS}
        />
      </label>
      {!bindQrId && contentSource === "dynamic" && selectedQr && (
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={applyToSelected}
            onChange={(e) => setApplyToSelected(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600"
          />
          <span className="min-w-0 truncate">
            Применить к QR «{qrDisplayName(selectedQr)}»
          </span>
        </label>
      )}
      {bindTargetQr && (
        <p className="text-xs leading-relaxed text-gray-500">
          Стиль сохранится в библиотеке и станет оформлением QR «{qrDisplayName(bindTargetQr)}».
        </p>
      )}
      <button
        type="button"
        onClick={handleSave}
        disabled={busy || logoLoading}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        <Save className="h-4 w-4 shrink-0" aria-hidden />
        {logoLoading ? "Загружаем логотип…" : busy ? "Сохранение…" : saveLabel}
      </button>
      {notice && (
        <p
          role="status"
          className={`flex items-start gap-1.5 text-sm ${notice.kind === "ok" ? "text-green-700" : "text-red-600"}`}
        >
          {notice.kind === "ok" ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
          {notice.text}
        </p>
      )}
    </div>
  );

  const payloadMessage =
    payloadResult.kind === "error"
      ? { kind: "error" as const, text: payloadResult.message }
      : payloadResult.kind === "ok" && "hint" in payloadResult && payloadResult.hint
        ? { kind: "hint" as const, text: payloadResult.hint }
        : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 backdrop-blur-sm lg:items-center lg:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-editor-title"
    >
      <div className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl lg:h-[min(92dvh,920px)] lg:rounded-2xl">
        {/* Шапка */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-5 lg:pt-3">
          <div className="min-w-0">
            <h2 id="qr-editor-title" className="truncate text-lg font-bold text-gray-900">
              {existingId ? saveName : `QR-код: ${preset.name}`}
            </h2>
            <p className="truncate text-sm text-gray-500">{existingId ? "Стиль QR-кода" : preset.description}</p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Закрыть редактор"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Настройки */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 sm:p-5 lg:border-r lg:border-gray-100">
            {bindQrId && selectedQr && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm text-indigo-900">
                Оформите QR-код <strong>«{qrDisplayName(selectedQr)}»</strong> и нажмите «{saveLabel}».
              </div>
            )}

            <Section title="Содержимое QR-кода" icon={<QrCode size={16} />} defaultOpen>
              <div className="mb-3 grid grid-cols-2 gap-2">
                {(["dynamic", "manual"] as const).map((source) => (
                  <button
                    key={source}
                    type="button"
                    onClick={() => setContentSource(source)}
                    className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition ${
                      contentSource === source
                        ? "bg-indigo-600 text-white"
                        : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {source === "dynamic" ? <QrCode size={15} /> : <Link2 size={15} />}
                    {source === "dynamic" ? "Мой QR-код" : "Статический"}
                  </button>
                ))}
              </div>

              {contentSource === "dynamic" ? (
                userQrcodes.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">У вас пока нет динамических QR-кодов.</p>
                    <button
                      type="button"
                      onClick={goCreateDynamic}
                      className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                    >
                      <Plus size={15} /> Создать динамический
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <select
                      value={selectedQrId ?? ""}
                      onChange={(e) => setSelectedQrId(e.target.value || null)}
                      className={INPUT_CLASS}
                      aria-label="QR-код для превью и скачивания"
                    >
                      <option value="">Выберите QR-код…</option>
                      {userQrcodes.map((qr) => (
                        <option key={qr.id} value={qr.id}>
                          {qrDisplayName(qr)} ({qr.code})
                        </option>
                      ))}
                    </select>
                    {selectedQr && (
                      <p className="truncate font-mono text-xs text-gray-400">{scanUrlForCode(selectedQr.code)}</p>
                    )}
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
                    {CONTENT_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setContent((prev) => ({ ...prev, type: tab.id }))}
                        className={`flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition ${
                          content.type === tab.id ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {CONTENT_FIELDS[content.type].map((f) => (
                      <label key={f.id} className={`block ${f.half ? "" : "sm:col-span-2"}`}>
                        <span className="mb-1 block text-xs font-medium text-gray-600">{f.label}</span>
                        {f.options ? (
                          <select
                            value={content.fields[f.id] ?? f.options[0].value}
                            onChange={(e) => setField(f.id, e.target.value)}
                            className={INPUT_CLASS}
                          >
                            {f.options.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : f.multiline ? (
                          <textarea
                            value={content.fields[f.id] ?? ""}
                            onChange={(e) => setField(f.id, e.target.value)}
                            rows={3}
                            placeholder={f.placeholder}
                            className={`${INPUT_CLASS} resize-none`}
                          />
                        ) : (
                          <input
                            type={f.type ?? "text"}
                            inputMode={f.inputMode}
                            value={content.fields[f.id] ?? ""}
                            onChange={(e) => setField(f.id, e.target.value)}
                            placeholder={f.placeholder}
                            autoCapitalize="off"
                            spellCheck={false}
                            className={`${INPUT_CLASS}${f.mono ? " font-mono" : ""}`}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                  {CONTENT_HINTS[content.type] && (
                    <p className="flex gap-1.5 text-xs leading-relaxed text-gray-500">
                      <Info size={14} className="mt-0.5 shrink-0 text-indigo-400" />
                      {CONTENT_HINTS[content.type]}
                    </p>
                  )}
                  {payloadMessage && (
                    <p
                      role="status"
                      className={`flex gap-1.5 text-sm leading-relaxed ${payloadMessage.kind === "error" ? "text-red-600" : "text-gray-500"}`}
                    >
                      {payloadMessage.kind === "error" ? (
                        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                      ) : (
                        <Info size={15} className="mt-0.5 shrink-0 text-indigo-400" />
                      )}
                      {payloadMessage.text}
                    </p>
                  )}
                </div>
              )}
            </Section>

            <Section
              title="Арт-стили"
              icon={<Sparkles size={16} />}
              value={ART_STYLES.find((p) => p.id === activeArtId)?.name ?? `${ART_STYLES.length} стиля`}
              defaultOpen
            >
              <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                {[{ id: "all" as const, label: "Все" }, ...ART_PRESET_CATEGORIES].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setArtCategory(c.id)}
                    aria-pressed={artCategory === c.id}
                    className={`h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium ${artCategory === c.id ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                {artVisible.map((p) => (
                  <ArtThumb key={p.id} preset={p} active={p.id === activeArtId} onClick={() => applyArtStyle(p)} />
                ))}
              </div>
              {artCollapsed && artInCategory.length > artVisible.length && (
                <button
                  type="button"
                  onClick={() => setArtExpanded(true)}
                  className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Показать все стили ({ART_STYLES.length})
                </button>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Стиль меняет форму и цвет, данные кода остаются. Свой логотип и фото сохраняются.
              </p>
            </Section>

            <button
              type="button"
              onClick={handleRandomize}
              disabled={randomizing}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-60"
            >
              <Shuffle size={16} />
              {randomizing ? "Подбираем читаемый вариант…" : "Случайный дизайн"}
            </button>

            <Section title="Цвет" icon={<span className="h-3.5 w-3.5 rounded-full" style={{ background: cfg.gradient ? `linear-gradient(135deg, ${cfg.grad1}, ${cfg.grad2})` : cfg.fg }} />} defaultOpen>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                {COLOR_PRESETS.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const updates: Partial<QRTemplateConfig> = {
                        fg: p.fg,
                        bg: p.bg,
                        gradient: !!p.gradient,
                        bgTransparent: false,
                      };
                      if (p.gradient) {
                        updates.grad1 = p.grad1!;
                        updates.grad2 = p.grad2!;
                        updates.gradType = p.gradType!;
                      }
                      setCfg((prev) => ({ ...prev, ...updates }));
                    }}
                    title={p.name}
                    aria-label={p.name}
                    className="aspect-square min-h-[44px] rounded-xl border-2 border-gray-200 hover:border-indigo-300"
                    style={{
                      background: p.gradient ? `linear-gradient(135deg, ${p.grad1}, ${p.grad2})` : p.fg,
                      boxShadow: p.bg !== "#ffffff" ? `inset 0 0 0 5px ${p.bg}` : undefined,
                    }}
                  />
                ))}
              </div>
              <div className="mt-4 space-y-3">
                <ColorRow label="Цвет точек" value={cfg.fg} onChange={(v) => setCfg((prev) => ({ ...prev, fg: v, gradient: false }))} />
                <ColorRow
                  label="Фон"
                  value={cfg.bg}
                  onChange={(v) => setCfg((prev) => ({ ...prev, bg: v, bgTransparent: false }))}
                  extra={
                    <button
                      type="button"
                      onClick={() => up("bgTransparent", !cfg.bgTransparent)}
                      aria-pressed={cfg.bgTransparent}
                      title="Прозрачный фон"
                      className={`h-11 shrink-0 rounded-xl border px-3 text-xs font-semibold ${cfg.bgTransparent ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-500"}`}
                    >
                      Без фона
                    </button>
                  }
                />
                <Toggle checked={cfg.gradient} onChange={(v) => up("gradient", v)} label="Градиент точек" />
                {cfg.gradient && (
                  <div className="grid grid-cols-[auto_auto_1fr] items-center gap-2 pl-1">
                    <input type="color" value={cfg.grad1} onChange={(e) => up("grad1", e.target.value)} className="h-11 w-12 cursor-pointer rounded-lg border" aria-label="Цвет градиента 1" />
                    <input type="color" value={cfg.grad2} onChange={(e) => up("grad2", e.target.value)} className="h-11 w-12 cursor-pointer rounded-lg border" aria-label="Цвет градиента 2" />
                    <select
                      value={cfg.gradType}
                      onChange={(e) => up("gradType", e.target.value as QRTemplateConfig["gradType"])}
                      className={INPUT_CLASS}
                    >
                      <option value="linear-tb">Линейный ↓</option>
                      <option value="linear-lr">Линейный →</option>
                      <option value="linear-diag">Диагональный</option>
                      <option value="radial">Радиальный</option>
                    </select>
                  </div>
                )}
                <Toggle checked={cfg.eyeCustom} onChange={(v) => up("eyeCustom", v)} label="Отдельный цвет угловых маркеров" />
                {cfg.eyeCustom && (
                  <ColorRow label="Маркеры" value={cfg.eyeColor} onChange={(v) => up("eyeColor", v)} />
                )}
              </div>
            </Section>

            <Section
              title="Логотип или текст в центре"
              icon={<ImageIcon size={16} />}
              value={cfg.centerMode === "text" ? parseCenterTextLines(cfg.centerText)[0] || "текст" : cfg.logoPreset || (cfg.logoSrc ? "QrStars" : cfg.logoDataUrl ? "свой" : "нет")}
            >
              <div className="mb-3 grid grid-cols-2 rounded-xl border border-gray-200 p-1">
                {(["image", "text"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => switchCenterMode(mode)}
                    className={`h-10 rounded-lg text-sm font-semibold transition ${cfg.centerMode === mode ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                  >
                    {mode === "image" ? "Картинка" : "Текст"}
                  </button>
                ))}
              </div>

              {cfg.centerMode === "image" ? (
                <>
                  <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:grid lg:grid-cols-8 lg:overflow-visible xl:grid-cols-10">
                    <button
                      type="button"
                      onClick={clearLogo}
                      title="Без логотипа"
                      aria-label="Без логотипа"
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 text-gray-400 lg:aspect-square lg:h-auto lg:w-auto ${!cfg.logoPreset && !cfg.logoSrc && !cfg.logoDataUrl ? "border-indigo-500 bg-indigo-50" : "border-gray-200"}`}
                    >
                      <Ban size={18} />
                    </button>
                    {LOGO_PRESETS.map((l, i) => {
                      const active = l.src ? cfg.logoSrc === l.src : !!l.emoji && cfg.logoPreset === l.emoji;
                      // На десктопе сначала два ряда; на телефоне ряд листается и так.
                      const collapsed = !logosExpanded && i >= LOGOS_COLLAPSED && !active;
                      return (
                        <button
                          key={l.src || l.emoji || i}
                          type="button"
                          title={l.name}
                          aria-label={l.name}
                          aria-pressed={active}
                          onClick={() => selectLogoPreset(i)}
                          className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 text-xl transition-all lg:aspect-square lg:h-auto lg:w-auto ${collapsed ? "lg:hidden" : ""} ${active ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}
                          style={
                            l.src
                              ? { backgroundImage: `url(${l.src})`, backgroundSize: "contain", backgroundPosition: "center", backgroundRepeat: "no-repeat" }
                              : undefined
                          }
                        >
                          {l.emoji || null}
                        </button>
                      );
                    })}
                    {!logosExpanded && (
                      <button
                        type="button"
                        onClick={() => setLogosExpanded(true)}
                        title="Показать все логотипы"
                        aria-label="Показать все логотипы"
                        className="hidden items-center justify-center rounded-xl border-2 border-gray-200 bg-gray-50 text-sm font-bold text-indigo-600 hover:border-gray-300 lg:flex lg:aspect-square"
                      >
                        +{LOGO_PRESETS.length - LOGOS_COLLAPSED}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => logoFileRef.current?.click()}
                    className={`inline-flex h-11 items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-medium text-gray-700 hover:border-indigo-400 ${cfg.logoDataUrl ? "border-indigo-500 bg-indigo-50" : "border-gray-200"}`}
                  >
                    <ImageIcon size={15} />
                    {cfg.logoDataUrl ? "Свой логотип · заменить" : "Загрузить свой"}
                  </button>
                  <input ref={logoFileRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </>
              ) : (
                <div className="space-y-3">
                  {(["Строка 1", "Строка 2 (необяз.)", "Строка 3 (необяз.)"] as const).map((label, idx) => (
                    <label key={label} className="block">
                      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
                      <input
                        type="text"
                        value={centerLineSlots()[idx]}
                        onChange={(e) => setCenterLineSlot(idx as 0 | 1 | 2, e.target.value)}
                        maxLength={24}
                        placeholder={idx === 0 ? "Например: WELCOME" : ""}
                        className={INPUT_CLASS}
                      />
                    </label>
                  ))}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-gray-600">Шрифт</span>
                      <select
                        value={cfg.centerTextFont}
                        onChange={(e) => up("centerTextFont", e.target.value as QRTemplateConfig["centerTextFont"])}
                        className={INPUT_CLASS}
                      >
                        {CENTER_TEXT_FONTS.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <ColorRow label="Цвет текста" value={cfg.centerTextColor} onChange={(v) => up("centerTextColor", v)} stacked />
                  </div>
                  <Toggle checked={cfg.centerTextBold !== false} onChange={(v) => up("centerTextBold", v)} label="Жирный шрифт" />
                  {parseCenterTextLines(cfg.centerText).length === 0 && (
                    <p className="text-xs text-amber-700">Введите хотя бы одну строку — она появится в центре QR.</p>
                  )}
                </div>
              )}

              <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                <Toggle
                  checked={cfg.logoFill === false}
                  onChange={(v) => up("logoFill", !v)}
                  label={cfg.centerMode === "text" ? "Плашка под надписью (лучше читается)" : "Плашка под логотипом (лучше читается)"}
                />
                <Range label="Размер" min={10} max={30} value={cfg.logoSize} onChange={(v) => up("logoSize", v)} suffix="%" />
              </div>
            </Section>

            <Section
              title="Форма точек и маркеров"
              icon={<QrCode size={16} />}
              value={DOT_STYLES.find((d) => d.id === cfg.dotStyle)?.label.toLowerCase()}
            >
              <p className="mb-2 text-xs font-medium text-gray-600">Точки</p>
              <div className="grid grid-cols-4 gap-2">
                {DOT_STYLES.map((s) => (
                  <StyleThumb key={s.id} style={s.id} active={cfg.dotStyle === s.id} onClick={() => up("dotStyle", s.id)} />
                ))}
              </div>
              <p className="mb-2 mt-4 text-xs font-medium text-gray-600">Угловые маркеры</p>
              <div className="grid grid-cols-5 gap-2">
                {EYE_STYLES.map((s) => (
                  <EyeThumb key={s.id} eye={s.id} active={cfg.eyeStyle === s.id} onClick={() => up("eyeStyle", s.id)} />
                ))}
              </div>
            </Section>

            <Section title="Рамка с подписью" icon={<span className="h-3.5 w-3.5 rounded border-2 border-current" />} value={cfg.frame ? cfg.frameText : "нет"}>
              <Toggle checked={cfg.frame} onChange={(v) => up("frame", v)} label="Добавить рамку" />
              {cfg.frame && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">Текст</span>
                    <input
                      type="text"
                      value={cfg.frameText}
                      onChange={(e) => up("frameText", e.target.value)}
                      maxLength={32}
                      className={INPUT_CLASS}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">Стиль</span>
                    <select
                      value={cfg.frameStyle}
                      onChange={(e) => up("frameStyle", e.target.value as QRTemplateConfig["frameStyle"])}
                      className={INPUT_CLASS}
                    >
                      <option value="bottom">Подпись снизу</option>
                      <option value="rounded">Скруглённая рамка</option>
                      <option value="ribbon">Лента сверху</option>
                    </select>
                  </label>
                </div>
              )}
            </Section>

            <Section title="Фото-режим" icon={<ImageIcon size={16} />} value={photoImage ? "есть" : "нет"}>
              <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-gray-200 p-1" role="group" aria-label="Как показать фото">
                {(
                  [
                    ["overlay", "Фон под кодом"],
                    ["halftone", "Гравюра"],
                  ] as const
                ).map(([id, label]) => {
                  const active = (cfg.photoStyle ?? "overlay") === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => up("photoStyle", id)}
                      className={`h-10 rounded-lg text-sm font-medium ${active ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="mb-3 text-xs text-gray-500">
                {cfg.photoStyle === "halftone"
                  ? "Фото превращается в точечную гравюру, модули встают точками в центр клетки. Лучше всего — предмет на светлом фоне."
                  : "Фото становится фоном, поверх — полупрозрачные модули. Следите за предупреждением о сканировании."}
              </p>
              <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                {PHOTO_PRESETS.map((p) => (
                  <button
                    key={p.src}
                    type="button"
                    title={p.name}
                    aria-label={p.name}
                    onClick={() => selectPhotoPreset(p.src)}
                    className={`h-14 w-14 shrink-0 rounded-xl border-2 bg-cover bg-center ${cfg.photoSrc === p.src ? "border-indigo-500" : "border-gray-200"}`}
                    style={{ backgroundImage: `url(${p.src})` }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => photoFileRef.current?.click()}
                  className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:border-indigo-400"
                >
                  <ImageIcon size={15} />
                  {cfg.photoDataUrl ? "Своё фото · заменить" : "Загрузить своё"}
                </button>
                {photoImage && (
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="h-11 rounded-xl border border-gray-200 px-3 text-sm text-gray-500 hover:border-red-200 hover:text-red-600"
                  >
                    Убрать фото
                  </button>
                )}
              </div>
              <input ref={photoFileRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </Section>

            <Section
              title="Форма кода"
              icon={<Star size={16} />}
              value={[
                codeShape === "figure"
                  ? cfg.silhouette === "custom"
                    ? "своя фигура"
                    : SILHOUETTE_OPTIONS.find((o) => o.id === cfg.silhouette)?.label.toLowerCase()
                  : codeShape === "pattern"
                    ? `узор: ${SCATTER_SHAPES.find((s) => s.id === cfg.scatterShape)?.label.toLowerCase() ?? ""}`
                    : "квадрат",
                cfg.rotate45 ? "ромб" : null,
                cfg.inkShift ? "CMYK" : null,
              ]
                .filter(Boolean)
                .join(", ")}
            >
              <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl border border-gray-200 p-1" role="group" aria-label="Форма кода">
                {(
                  [
                    ["none", "Квадрат"],
                    ["figure", "Фигура"],
                    ["pattern", "Узор вокруг"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={codeShape === id}
                    onClick={() => setCodeShape(id)}
                    className={`h-10 rounded-lg text-sm font-medium ${codeShape === id ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {codeShape === "figure" && (
                <>
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                    {SILHOUETTE_OPTIONS.map((o) => (
                      <SilhouetteThumb
                        key={o.id}
                        id={o.id}
                        label={o.label}
                        active={cfg.silhouette === o.id}
                        onClick={() => selectSilhouette(o.id)}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => silhouetteFileRef.current?.click()}
                      aria-pressed={cfg.silhouette === "custom"}
                      title="Своя фигура"
                      className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 ${cfg.silhouette === "custom" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                    >
                      <ImageIcon size={20} />
                      <span className="text-[11px] font-medium">{cfg.silhouette === "custom" && silhouetteImage ? "Заменить" : "Своя"}</span>
                    </button>
                  </div>
                  <input ref={silhouetteFileRef} type="file" accept="image/*" onChange={handleSilhouetteUpload} className="hidden" />
                  <p className="mt-2 text-xs text-gray-400">
                    Своя фигура — PNG с прозрачным фоном или тёмный силуэт на белом (собака, логотип, зуб). Рамка с подписью с фигурой не рисуется.
                  </p>
                  <div className="mt-3">
                    <Range label="Размер кода в фигуре" min={50} max={100} value={cfg.silhouetteFit ?? 100} onChange={(v) => up("silhouetteFit", v)} suffix="%" />
                  </div>
                </>
              )}

              {codeShape === "pattern" && (
                <div className="space-y-3">
                  <Range label="Ширина узора" min={1} max={10} value={cfg.scatterDensity} onChange={(v) => up("scatterDensity", v)} />
                  <div className="flex flex-wrap gap-2">
                    {SCATTER_SHAPES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => up("scatterShape", s.id)}
                        aria-pressed={cfg.scatterShape === s.id}
                        className={`h-10 rounded-xl border-2 px-3 text-sm ${cfg.scatterShape === s.id ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600"}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 space-y-1 border-t border-gray-100 pt-3">
                <Toggle checked={!!cfg.rotate45} onChange={(v) => up("rotate45", v)} label="Повернуть ромбом (логотип остаётся ровным)" />
                <Toggle checked={!!cfg.inkShift} onChange={(v) => up("inkShift", v)} label="Эффект печати CMYK — сдвиг голубой и жёлтой краски" />
              </div>
            </Section>

            <Section title="Дополнительно" icon={<ChevronDown size={16} />}>
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Коррекция ошибок</span>
                  <select
                    value={cfg.ecc}
                    onChange={(e) => up("ecc", e.target.value as QRTemplateConfig["ecc"])}
                    className={INPUT_CLASS}
                  >
                    <option value="L">L (7%) — больше всего данных</option>
                    <option value="M">M (15%)</option>
                    <option value="Q">Q (25%)</option>
                    <option value="H">H (30%) — нужен для логотипа</option>
                  </select>
                  <span className="mt-1 block text-xs text-gray-400">Чем выше, тем больше кода можно закрыть логотипом без потери читаемости.</span>
                </label>
                <Range label="Белое поле вокруг кода" min={0} max={6} value={cfg.margin} onChange={(v) => up("margin", v)} />
              </div>
            </Section>

            {/* На мобилке сохранение и скачивание — в конце списка и в окне превью. */}
            <div className="space-y-3 pb-2 lg:hidden">
              <div className="rounded-2xl border border-gray-200 p-4">{saveBlock}</div>
            </div>
          </div>

          {/* Превью и действия: справа на десктопе */}
          <div className="hidden min-h-0 flex-col gap-3 overflow-y-auto p-5 lg:flex">
            <p className="text-sm font-semibold text-gray-800">Предпросмотр</p>
            <button
              type="button"
              onClick={openMockup}
              disabled={!hasRender}
              className="group relative flex min-h-[280px] items-center justify-center rounded-2xl p-4 disabled:cursor-default"
              style={{
                backgroundImage:
                  "linear-gradient(45deg,#f1f5f9 25%,transparent 25%),linear-gradient(-45deg,#f1f5f9 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#f1f5f9 75%),linear-gradient(-45deg,transparent 75%,#f1f5f9 75%)",
                backgroundSize: "20px 20px",
                backgroundPosition: "0 0,0 10px,10px -10px,10px 0",
              }}
              aria-label="Открыть QR крупно"
            >
              {payload && !renderError ? (
                <>
                  <canvas ref={attachPreview} className="h-auto max-h-[340px] w-auto max-w-full" style={{ display: hasRender ? "block" : "none" }} />
                  {hasRender && (
                    <span className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900/70 text-white opacity-0 transition group-hover:opacity-100">
                      <Maximize2 size={15} />
                    </span>
                  )}
                </>
              ) : (
                <p className="px-4 text-center text-sm text-gray-400">
                  {renderError ?? (contentSource === "dynamic" ? "Выберите QR-код из списка" : "Заполните поля — код появится сразу")}
                </p>
              )}
            </button>
            {scanAlert}
            {saveBlock}
            <div className="border-t border-gray-100 pt-3">{downloadControls}</div>
            <button
              type="button"
              onClick={openMockup}
              disabled={!hasRender}
              className="flex items-center justify-center gap-1.5 text-sm font-semibold text-indigo-600 hover:underline disabled:opacity-40"
            >
              <Maximize2 size={14} /> Открыть крупно и примерить на табличке
            </button>
          </div>
        </div>

        {/* Нижняя панель на мобилке: превью всегда на виду */}
        <div className="flex shrink-0 items-center gap-3 border-t border-gray-200 bg-white/95 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={openMockup}
            disabled={!hasRender}
            className="relative flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-xl border-2 border-gray-200 bg-white p-1"
            aria-label="Открыть QR крупно"
          >
            {hasRender ? (
              <canvas ref={attachThumb} className="h-full w-full object-contain" />
            ) : (
              <QrCode size={28} className="text-gray-300" />
            )}
            {scanLevel !== "ok" && hasRender && (
              <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white ring-2 ring-white">
                <AlertTriangle size={11} />
              </span>
            )}
            {hasRender && (
              <span className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-md bg-slate-900/70 text-white">
                <Maximize2 size={12} />
              </span>
            )}
          </button>
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy || logoLoading}
              className="col-span-2 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Save size={15} />
              <span className="truncate">{busy ? "Сохранение…" : saveLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownload("png")}
              disabled={busy || !hasRender}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 disabled:opacity-40"
            >
              <Download size={14} /> PNG
            </button>
            <button
              type="button"
              onClick={openMockup}
              disabled={!hasRender}
              className="flex h-10 items-center justify-center rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 disabled:opacity-40"
            >
              Ещё форматы
            </button>
          </div>
        </div>
      </div>

      {mockupUrl && (
        <QRMockupDialog
          imageUrl={mockupUrl}
          caption={contentSource === "manual" ? MOCK_CAPTIONS[content.type] : undefined}
          onClose={() => setMockupUrl(null)}
        >
          <div className="space-y-3">
            {scanAlert}
            {downloadControls}
          </div>
        </QRMockupDialog>
      )}
    </div>
  );
}

/** Сворачиваемая секция. На мобилке открыты только отмеченные `defaultOpen`. */
function Section({
  title,
  icon,
  value,
  defaultOpen = false,
  defaultOpenDesktop = false,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  value?: string | null;
  defaultOpen?: boolean;
  defaultOpenDesktop?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(
    () => defaultOpen || (defaultOpenDesktop && typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches),
  );
  return (
    <section className="rounded-2xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-[52px] w-full items-center gap-2.5 px-4 text-left"
      >
        <span className="flex w-4 shrink-0 justify-center text-indigo-500">{icon}</span>
        <span className="flex-1 text-[15px] font-semibold text-gray-900">{title}</span>
        {value && <span className="max-w-[40%] truncate text-xs text-gray-500">{value}</span>}
        <ChevronDown size={16} className={`shrink-0 text-gray-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-[40px] cursor-pointer items-center gap-2.5 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-[18px] w-[18px] shrink-0 rounded border-gray-300 text-indigo-600"
      />
      {label}
    </label>
  );
}

function Range({
  label,
  value,
  min,
  max,
  onChange,
  suffix = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs font-medium text-gray-600">
        {label}
        <span className="text-gray-400">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-full accent-indigo-600"
      />
    </label>
  );
}

/** Цвет: палитра + HEX. Поле можно набирать посимвольно — значение принимается, когда HEX полный. */
function ColorRow({
  label,
  value,
  onChange,
  extra,
  stacked = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  extra?: React.ReactNode;
  stacked?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    setSyncedValue(value);
    setDraft(value);
  }
  const commit = (raw: string) => {
    let v = raw.trim();
    if (/^[0-9a-fA-F]{6}$/.test(v)) v = `#${v}`;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v.toLowerCase());
    else setDraft(value);
  };
  return (
    <div className={stacked ? "block" : "block sm:flex sm:items-center sm:gap-2"}>
      <span className={`block text-xs font-medium text-gray-600 ${stacked ? "mb-1" : "mb-1 sm:mb-0 sm:w-24 sm:shrink-0"}`}>{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border border-gray-200"
        />
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (/^#?[0-9a-fA-F]{6}$/.test(e.target.value.trim())) commit(e.target.value);
          }}
          onBlur={(e) => commit(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          maxLength={7}
          aria-label={`${label}, HEX`}
          className="h-11 min-w-0 flex-1 rounded-xl border border-gray-200 px-3 font-mono text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
        />
        {extra}
      </div>
    </div>
  );
}
