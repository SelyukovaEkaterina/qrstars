"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
} from "lucide-react";
import { scanUrlForCode } from "@/lib/utils";
import {
  type QRTemplateConfig,
  type QRTemplatePreset,
  type QRDotStyle,
  type QREyeStyle,
  COLOR_PRESETS,
  CENTER_TEXT_FONTS,
  LOGO_PRESETS,
  SCATTER_SHAPES,
  parseCenterTextLines,
  renderQRTemplate,
  downloadQRTemplateAsPNG,
  downloadQRTemplateAsJPG,
  randomizeQRConfig,
  normalizeQRTemplateConfig,
} from "@/lib/qr-code-templates";
import {
  type QRContentState,
  type QRContentType,
  DEFAULT_QR_CONTENT,
  buildQRPayload,
  loadLogoPreset,
  PHOTO_PRESETS,
  renderDotStylePreview,
  renderEyeStylePreview,
} from "@/lib/qr-free-generator";

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
  { id: "url", label: "URL", icon: <Link2 size={14} /> },
  { id: "wifi", label: "WiFi", icon: <Wifi size={14} /> },
  { id: "text", label: "Текст", icon: <Type size={14} /> },
  { id: "email", label: "Email", icon: <Mail size={14} /> },
  { id: "phone", label: "Телефон", icon: <Phone size={14} /> },
  { id: "vcard", label: "Контакт", icon: <IdCard size={14} /> },
  { id: "sms", label: "SMS", icon: <MessageSquare size={14} /> },
];

const DOT_STYLES: { id: QRDotStyle; label: string }[] = [
  { id: "classic", label: "Квадраты" },
  { id: "rounded", label: "Скруглённые" },
];

const EYE_STYLES: { id: QREyeStyle; label: string }[] = [
  { id: "square", label: "Квадрат" },
  { id: "rounded", label: "Скруглён." },
  { id: "circle", label: "Круг" },
  { id: "leaf", label: "Лист" },
  { id: "dot", label: "Точка" },
];

function StyleThumb({ style, active, onClick }: { style: QRDotStyle; active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (c) renderDotStylePreview(c, style);
  }, [style]);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 py-2 rounded-lg border-2 transition-all ${active ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}
    >
      <canvas ref={ref} width={40} height={40} className="rounded" />
      <span className="text-[10px] text-gray-600">{DOT_STYLES.find((s) => s.id === style)?.label}</span>
    </button>
  );
}

function EyeThumb({ eye, active, onClick }: { eye: QREyeStyle; active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (c) renderEyeStylePreview(c, eye);
  }, [eye]);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 py-2 rounded-lg border-2 transition-all ${active ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}
    >
      <canvas ref={ref} width={40} height={40} className="rounded" />
      <span className="text-[10px] text-gray-600">{EYE_STYLES.find((s) => s.id === eye)?.label}</span>
    </button>
  );
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
  const [cfg, setCfg] = useState<QRTemplateConfig>(() => normalizeQRTemplateConfig({ ...preset.config }));
  const [content, setContent] = useState<QRContentState>({ ...DEFAULT_QR_CONTENT });
  const [userQrcodes, setUserQrcodes] = useState<UserQR[]>([]);
  const [contentSource, setContentSource] = useState<"manual" | "dynamic">("dynamic");
  const router = useRouter();
  const [selectedQrId, setSelectedQrId] = useState<string | null>(bindQrId ?? null);
  const [bound, setBound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoImage, setPhotoImage] = useState<HTMLImageElement | null>(null);
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const [activeLogoKey, setActiveLogoKey] = useState<string | null>(null);
  const [photoWarning, setPhotoWarning] = useState(false);
  const [saveName, setSaveName] = useState(existingName || preset.name);
  const [showSaveName, setShowSaveName] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const photoFileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const up = useCallback(
    <K extends keyof QRTemplateConfig>(k: K, v: QRTemplateConfig[K]) =>
      setCfg((prev) => ({ ...prev, [k]: v })),
    [],
  );

  const setContentField = <K extends keyof QRContentState>(k: K, v: QRContentState[K]) =>
    setContent((prev) => ({ ...prev, [k]: v }));

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
      })
      .catch(() => {});
  }, [bindQrId]);

  useEffect(() => {
    if (cfg.centerMode === "text") return;
    let cancelled = false;
    (async () => {
      try {
        if (cfg.logoDataUrl) {
          const img = new Image();
          await new Promise<void>((res, rej) => {
            img.onload = () => res();
            img.onerror = rej;
            img.src = cfg.logoDataUrl!;
          });
          if (!cancelled) setLogoImage(img);
          return;
        }
        if (cfg.logoSrc) {
          const img = await loadLogoPreset({ name: "", src: cfg.logoSrc });
          if (!cancelled) {
            setLogoImage(img);
            setActiveLogoKey(cfg.logoSrc);
          }
          return;
        }
        if (cfg.logoPreset) {
          const img = await loadLogoPreset({ name: "", emoji: cfg.logoPreset });
          if (!cancelled) setLogoImage(img);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedQr = userQrcodes.find((q) => q.id === selectedQrId) ?? null;
  const payload =
    contentSource === "dynamic" && selectedQr
      ? scanUrlForCode(selectedQr.code)
      : buildQRPayload(content);

  const centerLineSlots = (): [string, string, string] => {
    const parts = (cfg.centerText ?? "").split("\n");
    return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
  };

  const setCenterLineSlot = (index: 0 | 1 | 2, value: string) => {
    const slots = centerLineSlots();
    slots[index] = value;
    up("centerText", slots.join("\n"));
  };

  const switchCenterMode = (mode: "image" | "text") => {
    if (mode === cfg.centerMode) return;
    up("centerMode", mode);
    if (mode === "text") clearLogo();
    else up("centerText", "");
  };

  const redraw = useCallback(async () => {
    const canvas = previewRef.current;
    if (!canvas || !payload) return;
    const logoForRender = cfg.centerMode === "text" ? null : logoImage;
    try {
      await renderQRTemplate(canvas, cfg, payload, 600, photoImage, logoForRender);
      if (photoImage) {
        setPhotoWarning(true);
      } else {
        setPhotoWarning(false);
      }
    } catch (e) {
      console.error("QR render err", e);
    }
  }, [cfg, payload, photoImage, logoImage]);

  useEffect(() => {
    const t = setTimeout(redraw, 100);
    return () => clearTimeout(t);
  }, [redraw]);

  const selectLogoPreset = async (idx: number) => {
    const p = LOGO_PRESETS[idx];
    try {
      const img = await loadLogoPreset(p);
      setLogoImage(img);
      setActiveLogoKey(p.src || p.emoji || String(idx));
      setCfg((prev) => ({
        ...prev,
        centerMode: "image",
        centerText: "",
        logoPreset: p.emoji || null,
        logoSrc: p.src || null,
        logoDataUrl: null,
      }));
    } catch {
      /* ignore */
    }
  };

  const clearLogo = () => {
    setLogoImage(null);
    setActiveLogoKey(null);
    setCfg((prev) => ({
      ...prev,
      logoPreset: null,
      logoSrc: null,
      logoDataUrl: null,
    }));
    if (logoFileRef.current) logoFileRef.current.value = "";
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        setLogoImage(img);
        setActiveLogoKey("custom");
        setCfg((prev) => ({
          ...prev,
          centerMode: "image",
          centerText: "",
          logoPreset: null,
          logoSrc: null,
          logoDataUrl: dataUrl,
        }));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setPhotoImage(img);
        setActivePhotoKey("custom");
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const [activePhotoKey, setActivePhotoKey] = useState<string | null>(null);

  const selectPhotoPreset = (src: string) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setPhotoImage(img);
      setActivePhotoKey(src);
    };
    img.src = src;
  };

  const clearPhoto = () => {
    setPhotoImage(null);
    setActivePhotoKey(null);
    if (photoFileRef.current) photoFileRef.current.value = "";
  };

  const goCreateDynamic = () => {
    onClose();
    router.push("/dashboard/qrcodes/new");
  };

  const handleRandomize = () => {
    const next = randomizeQRConfig();
    setCfg(next);
    if (next.logoSrc) {
      loadLogoPreset({ name: "", src: next.logoSrc }).then(setLogoImage).catch(() => {});
      setActiveLogoKey(next.logoSrc);
    } else if (next.logoPreset) {
      loadLogoPreset({ name: "", emoji: next.logoPreset }).then(setLogoImage).catch(() => {});
      setActiveLogoKey(next.logoPreset);
    } else {
      clearLogo();
    }
    setPhotoImage(null);
    setActivePhotoKey(null);
  };

  const configForSave = (): QRTemplateConfig => {
    const base = { ...cfg };
    if (base.centerMode === "text") {
      return {
        ...base,
        logoPreset: null,
        logoSrc: null,
        logoDataUrl: null,
      };
    }
    if (logoImage && activeLogoKey === "custom" && cfg.logoDataUrl) {
      return { ...base, centerText: "" };
    }
    if (!logoImage) {
      return { ...base, logoPreset: null, logoSrc: null, logoDataUrl: null, centerText: "" };
    }
    return { ...base, centerText: "" };
  };

  const bindTemplateToQr = async (templateId: string, qrId: string) => {
    const res = await fetch("/api/qrcodes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: qrId, qrStyleTemplateId: templateId }),
    });
    if (!res.ok) return false;
    setBound(true);
    setTimeout(() => setBound(false), 2500);
    onBound?.(qrId, templateId);
    return true;
  };

  const handleSave = async (name: string, options?: { bindToQrId?: string | null }) => {
    setBusy(true);
    try {
      const layout = { __type: "qr-style", config: configForSave() };
      let templateId = existingId;
      if (existingId) {
        const res = await fetch(`/api/templates/${existingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), layout }),
        });
        if (!res.ok) return;
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        onSaved?.(existingId, name.trim(), configForSave());
      } else {
        const res = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), layout }),
        });
        if (!res.ok) return;
        const d = await res.json();
        templateId = d.template.id;
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        onSaved?.(d.template.id, name.trim(), configForSave());
      }
      const bindTarget = options?.bindToQrId ?? selectedQrId;
      if (templateId && bindTarget) {
        await bindTemplateToQr(templateId, bindTarget);
      }
    } finally {
      setBusy(false);
      setShowSaveName(false);
    }
  };

  const renderAtSize = async (size: number) => {
    if (!payload) return null;
    const c = document.createElement("canvas");
    const logoForRender = cfg.centerMode === "text" ? null : logoImage;
    await renderQRTemplate(c, cfg, payload, size, photoImage, logoForRender);
    return c;
  };

  const downloadBaseName = selectedQr ? `qr-${selectedQr.code}` : `qr-${preset.id}`;

  const handleDownloadPNG = async () => {
    setBusy(true);
    try {
      const c = await renderAtSize(1200);
      if (c) downloadQRTemplateAsPNG(c, downloadBaseName);
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadJPG = async () => {
    setBusy(true);
    try {
      const c = await renderAtSize(1200);
      if (c) downloadQRTemplateAsJPG(c, downloadBaseName);
    } finally {
      setBusy(false);
    }
  };

  const applyToQr = () => {
    if (existingId) {
      void handleSave(saveName, { bindToQrId: selectedQrId });
      return;
    }
    setShowSaveName(true);
  };

  const saveLabel =
    selectedQrId || bindQrId
      ? existingId
        ? "Применить к QR"
        : "Сохранить и применить к QR"
      : existingId
        ? "Сохранить изменения"
        : "Сохранить в библиотеку";

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl my-4 sm:my-8">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">
                {existingId ? saveName : `QR-код: ${preset.name}`}
              </h2>
              <p className="text-sm text-gray-500 truncate">
                {existingId ? "Шаблон QR-кода" : preset.description}
              </p>
            </div>
            {saved && (
              <span className="hidden sm:flex text-sm font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 items-center gap-1 shrink-0">
                <Check size={14} /> Сохранено
              </span>
            )}
            {bound && (
              <span className="hidden sm:flex text-sm font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 items-center gap-1 shrink-0">
                <Check size={14} /> Привязано к QR
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row">
          <div className="xl:flex-1 p-4 sm:p-5 space-y-5 max-h-[75vh] overflow-y-auto border-b xl:border-b-0 xl:border-r border-gray-100">
            {bindQrId && selectedQr && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm text-indigo-900">
                Оформите QR-код <strong>«{qrDisplayName(selectedQr)}»</strong> и нажмите «Применить к QR» — стиль сохранится
                в библиотеке и будет использоваться для скачивания PNG.
              </div>
            )}

            <Panel title="Содержимое QR-кода">
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setContentSource("dynamic")}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                    contentSource === "dynamic"
                      ? "bg-indigo-600 text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <QrCode size={14} />
                  Динамический QR-код
                </button>
                <button
                  type="button"
                  onClick={() => setContentSource("manual")}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                    contentSource === "manual"
                      ? "bg-indigo-600 text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <Link2 size={14} />
                  Статический QR-код
                </button>
              </div>
              {contentSource === "dynamic" ? (
                userQrcodes.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">У вас пока нет динамических QR-кодов.</p>
                    <button
                      type="button"
                      onClick={goCreateDynamic}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition"
                    >
                      <Plus size={14} />
                      Создать динамический
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={selectedQrId ?? ""}
                      onChange={(e) => setSelectedQrId(e.target.value || null)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Выберите QR-код…</option>
                      {userQrcodes.map((qr) => (
                        <option key={qr.id} value={qr.id}>
                          {qrDisplayName(qr)} ({qr.code})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={goCreateDynamic}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 transition"
                    >
                      <Plus size={13} />
                      Создать динамический
                    </button>
                  </div>
                )
              ) : null}
            </Panel>

            {contentSource === "manual" && (
            <div className="flex flex-wrap gap-1.5">
              {CONTENT_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setContentField("type", tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                    content.type === tab.id
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
            )}

            {contentSource === "manual" && content.type === "url" && (
              <Panel title="Адрес ссылки">
                <input
                  type="url"
                  value={content.url}
                  onChange={(e) => setContentField("url", e.target.value)}
                  placeholder="https://example.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </Panel>
            )}

            {contentSource === "manual" && content.type === "wifi" && (
              <Panel title="WiFi">
                <div className="space-y-3">
                  <input
                    type="text"
                    value={content.wifiSsid}
                    onChange={(e) => setContentField("wifiSsid", e.target.value)}
                    placeholder="Название сети (SSID)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    value={content.wifiPass}
                    onChange={(e) => setContentField("wifiPass", e.target.value)}
                    placeholder="Пароль"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <select
                    value={content.wifiEnc}
                    onChange={(e) => setContentField("wifiEnc", e.target.value as QRContentState["wifiEnc"])}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="WPA">WPA/WPA2</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">Без пароля</option>
                  </select>
                </div>
              </Panel>
            )}

            {contentSource === "manual" && content.type === "text" && (
              <Panel title="Произвольный текст">
                <textarea
                  value={content.text}
                  onChange={(e) => setContentField("text", e.target.value)}
                  rows={4}
                  placeholder="Введите текст..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </Panel>
            )}

            {contentSource === "manual" && content.type === "email" && (
              <Panel title="Email">
                <div className="space-y-3">
                  <input
                    type="email"
                    value={content.emailAddr}
                    onChange={(e) => setContentField("emailAddr", e.target.value)}
                    placeholder="hello@example.com"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    value={content.emailSubj}
                    onChange={(e) => setContentField("emailSubj", e.target.value)}
                    placeholder="Тема (необязательно)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <textarea
                    value={content.emailBody}
                    onChange={(e) => setContentField("emailBody", e.target.value)}
                    rows={2}
                    placeholder="Сообщение"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </Panel>
            )}

            {contentSource === "manual" && content.type === "phone" && (
              <Panel title="Телефон">
                <input
                  type="tel"
                  value={content.phone}
                  onChange={(e) => setContentField("phone", e.target.value)}
                  placeholder="+7 (999) 123-45-67"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </Panel>
            )}

            {contentSource === "manual" && content.type === "vcard" && (
              <Panel title="Контакт (vCard)">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={content.vcardFname}
                    onChange={(e) => setContentField("vcardFname", e.target.value)}
                    placeholder="Имя"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    value={content.vcardLname}
                    onChange={(e) => setContentField("vcardLname", e.target.value)}
                    placeholder="Фамилия"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    value={content.vcardPhone}
                    onChange={(e) => setContentField("vcardPhone", e.target.value)}
                    placeholder="Телефон"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    value={content.vcardEmail}
                    onChange={(e) => setContentField("vcardEmail", e.target.value)}
                    placeholder="Email"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    value={content.vcardOrg}
                    onChange={(e) => setContentField("vcardOrg", e.target.value)}
                    placeholder="Организация"
                    className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    value={content.vcardUrl}
                    onChange={(e) => setContentField("vcardUrl", e.target.value)}
                    placeholder="Сайт"
                    className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </Panel>
            )}

            {contentSource === "manual" && content.type === "sms" && (
              <Panel title="SMS">
                <div className="space-y-3">
                  <input
                    type="tel"
                    value={content.smsPhone}
                    onChange={(e) => setContentField("smsPhone", e.target.value)}
                    placeholder="+7 999 123-45-67"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <textarea
                    value={content.smsBody}
                    onChange={(e) => setContentField("smsBody", e.target.value)}
                    rows={2}
                    placeholder="Текст сообщения"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </Panel>
            )}

            <button
              type="button"
              onClick={handleRandomize}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-colors"
            >
              <Shuffle size={16} />
              Случайный дизайн
            </button>

            <Panel title="Стиль точек">
              <div className="grid grid-cols-2 gap-2">
                {DOT_STYLES.map((s) => (
                  <StyleThumb
                    key={s.id}
                    style={s.id}
                    active={cfg.dotStyle === s.id}
                    onClick={() => up("dotStyle", s.id)}
                  />
                ))}
              </div>
            </Panel>

            <Panel title="Стиль глазков">
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {EYE_STYLES.map((s) => (
                  <EyeThumb
                    key={s.id}
                    eye={s.id}
                    active={cfg.eyeStyle === s.id}
                    onClick={() => up("eyeStyle", s.id)}
                  />
                ))}
              </div>
              <label className="flex items-center gap-2 cursor-pointer mt-3">
                <input
                  type="checkbox"
                  checked={cfg.eyeCustom}
                  onChange={(e) => up("eyeCustom", e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-gray-700">Отдельный цвет глазков</span>
              </label>
              {cfg.eyeCustom && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="color"
                    value={cfg.eyeColor}
                    onChange={(e) => up("eyeColor", e.target.value)}
                    className="h-8 w-10 rounded border border-gray-200 cursor-pointer"
                  />
                  <span className="text-[10px] text-gray-400">Три угловых маркера</span>
                </div>
              )}
            </Panel>

            <Panel title="Цветовые пресеты">
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1">
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
                    className="group flex flex-col items-center"
                  >
                    <div
                      className="h-7 w-7 rounded-md border border-gray-200 group-hover:border-indigo-300"
                      style={{
                        background: p.gradient
                          ? `linear-gradient(135deg, ${p.grad1}, ${p.grad2})`
                          : p.fg,
                      }}
                    />
                    <span className="text-[8px] text-gray-500 block text-center mt-0.5 truncate max-w-full px-0.5">
                      {p.name}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                <ColorRow label="Цвет точек" value={cfg.fg} onChange={(v) => up("fg", v)} />
                <ColorRow
                  label="Фон"
                  value={cfg.bg}
                  onChange={(v) => {
                    up("bg", v);
                    up("bgTransparent", false);
                  }}
                  transparent={
                    <button
                      type="button"
                      onClick={() => up("bgTransparent", !cfg.bgTransparent)}
                      className={`text-[10px] px-2 py-1 rounded border ${cfg.bgTransparent ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-500"}`}
                    >
                      ∅
                    </button>
                  }
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cfg.gradient}
                    onChange={(e) => up("gradient", e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600"
                  />
                  <span className="text-xs text-gray-700">Градиент точек</span>
                </label>
                {cfg.gradient && (
                  <div className="space-y-2 pl-1">
                    <div className="flex gap-2">
                      <input type="color" value={cfg.grad1} onChange={(e) => up("grad1", e.target.value)} className="h-8 w-10 rounded border cursor-pointer" />
                      <input type="color" value={cfg.grad2} onChange={(e) => up("grad2", e.target.value)} className="h-8 w-10 rounded border cursor-pointer" />
                    </div>
                    <select
                      value={cfg.gradType}
                      onChange={(e) => up("gradType", e.target.value as QRTemplateConfig["gradType"])}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                    >
                      <option value="linear-tb">Линейный ↓</option>
                      <option value="linear-lr">Линейный →</option>
                      <option value="linear-diag">Диагональный</option>
                      <option value="radial">Радиальный</option>
                    </select>
                  </div>
                )}
              </div>
            </Panel>

            <Panel title="Точки вокруг кода">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={cfg.scatter}
                  onChange={(e) => up("scatter", e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600"
                />
                <span className="text-xs text-gray-700">Рассыпать точки</span>
              </label>
              {cfg.scatter && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-16">Расстояние</span>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={cfg.scatterDensity}
                      onChange={(e) => up("scatterDensity", Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-500 w-4">{cfg.scatterDensity}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {SCATTER_SHAPES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => up("scatterShape", s.id)}
                        className={`px-2 py-1 rounded border text-[10px] ${cfg.scatterShape === s.id ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-500"}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Panel>

            <Panel title="Картинка или текст в центре">
              <div className="flex rounded-lg border border-gray-200 p-0.5 mb-3">
                <button
                  type="button"
                  onClick={() => switchCenterMode("image")}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${cfg.centerMode === "image" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                >
                  Картинка
                </button>
                <button
                  type="button"
                  onClick={() => switchCenterMode("text")}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${cfg.centerMode === "text" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                >
                  Текст
                </button>
              </div>

              {cfg.centerMode === "image" ? (
                <>
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-1 mb-2 max-h-32 overflow-y-auto">
                    {LOGO_PRESETS.map((l, i) => {
                      const key = l.src || l.emoji || String(i);
                      const active = activeLogoKey === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          title={l.name}
                          onClick={() => selectLogoPreset(i)}
                          className={`aspect-square flex items-center justify-center rounded-lg border-2 text-lg transition-all overflow-hidden ${active ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}
                          style={
                            l.src
                              ? {
                                  backgroundImage: `url(${l.src})`,
                                  backgroundSize: "contain",
                                  backgroundPosition: "center",
                                  backgroundRepeat: "no-repeat",
                                }
                              : undefined
                          }
                        >
                          {l.emoji || null}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => logoFileRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:border-indigo-400"
                    >
                      <ImageIcon size={14} />
                      Загрузить свой
                    </button>
                    <button
                      type="button"
                      onClick={clearLogo}
                      className="px-2 py-2 text-xs rounded-lg border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200"
                    >
                      Убрать
                    </button>
                  </div>
                  <input ref={logoFileRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </>
              ) : (
                <div className="space-y-2 mb-2">
                  {(["Строка 1", "Строка 2 (необяз.)", "Строка 3 (необяз.)"] as const).map((label, idx) => {
                    const slots = centerLineSlots();
                    return (
                      <div key={label}>
                        <label className="text-[10px] text-gray-500 mb-0.5 block">{label}</label>
                        <input
                          type="text"
                          value={slots[idx]}
                          onChange={(e) => setCenterLineSlot(idx as 0 | 1 | 2, e.target.value)}
                          maxLength={24}
                          placeholder={idx === 0 ? "Например: WELCOME" : ""}
                          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    );
                  })}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Шрифт</label>
                      <select
                        value={cfg.centerTextFont}
                        onChange={(e) => up("centerTextFont", e.target.value as QRTemplateConfig["centerTextFont"])}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                      >
                        {CENTER_TEXT_FONTS.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Цвет текста</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={cfg.centerTextColor}
                          onChange={(e) => up("centerTextColor", e.target.value)}
                          className="w-9 h-9 rounded border border-gray-200 cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => up("centerTextColor", cfg.fg)}
                          className="text-[10px] text-indigo-600 hover:underline"
                        >
                          Как у точек
                        </button>
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cfg.centerTextBold !== false}
                      onChange={(e) => up("centerTextBold", e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600"
                    />
                    Жирный шрифт
                  </label>
                  {parseCenterTextLines(cfg.centerText).length === 0 && (
                    <p className="text-[10px] text-amber-700">Введите хотя бы одну строку — она появится в центре QR.</p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cfg.logoFill !== false}
                    onChange={(e) => up("logoFill", e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600"
                  />
                  {cfg.centerMode === "text" ? "Точки под надписью" : "Точки под логотипом"}
                </label>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-gray-500">Размер</span>
                  <input
                    type="range"
                    min={10}
                    max={30}
                    value={cfg.logoSize}
                    onChange={(e) => up("logoSize", Number(e.target.value))}
                    className="w-16"
                  />
                </div>
              </div>
            </Panel>

            <Panel title="Фото-режим">
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 mb-2">
                {PHOTO_PRESETS.map((p) => (
                  <button
                    key={p.src}
                    type="button"
                    title={p.name}
                    onClick={() => selectPhotoPreset(p.src)}
                    className={`aspect-square rounded-lg border-2 bg-cover bg-center ${activePhotoKey === p.src ? "border-indigo-500" : "border-gray-200"}`}
                    style={{ backgroundImage: `url(${p.src})` }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => photoFileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:border-indigo-400"
                >
                  <ImageIcon size={14} />
                  Загрузить своё
                </button>
                {photoImage && (
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="px-2 py-2 text-xs rounded-lg border border-gray-200 text-gray-500 hover:text-red-600"
                  >
                    Убрать
                  </button>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-gray-500">Отступ</span>
                  <input
                    type="range"
                    min={0}
                    max={6}
                    value={cfg.margin}
                    onChange={(e) => up("margin", Number(e.target.value))}
                    className="w-16"
                  />
                </div>
              </div>
              <input ref={photoFileRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </Panel>

            <Panel title="Рамка с подписью">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={cfg.frame}
                  onChange={(e) => up("frame", e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600"
                />
                <span className="text-xs text-gray-700">Рамка</span>
              </label>
              {cfg.frame && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={cfg.frameText}
                    onChange={(e) => up("frameText", e.target.value)}
                    maxLength={32}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <select
                    value={cfg.frameStyle}
                    onChange={(e) => up("frameStyle", e.target.value as QRTemplateConfig["frameStyle"])}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
                  >
                    <option value="bottom">Подпись снизу</option>
                    <option value="rounded">Скруглённая рамка</option>
                    <option value="ribbon">Лента сверху</option>
                  </select>
                </div>
              )}
            </Panel>

            <button
              type="button"
              onClick={() => setAdvancedOpen((o) => !o)}
              className="w-full flex items-center gap-2 text-sm font-semibold text-gray-700 py-2"
            >
              <ChevronDown size={16} className={`transition ${advancedOpen ? "rotate-180" : ""}`} />
              Дополнительно
            </button>
            {advancedOpen && (
              <Panel title="Уровень коррекции">
                <select
                  value={cfg.ecc}
                  onChange={(e) => up("ecc", e.target.value as QRTemplateConfig["ecc"])}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="L">L (7%)</option>
                  <option value="M">M (15%)</option>
                  <option value="Q">Q (25%)</option>
                  <option value="H">H (30%)</option>
                </select>
              </Panel>
            )}
          </div>

          <div className="xl:w-[380px] flex-shrink-0 p-4 sm:p-5 flex flex-col">
            <p className="text-sm font-semibold text-gray-800 mb-2">Предпросмотр</p>
            {userQrcodes.length > 0 && (
              <div className="mb-3">
                <label className="text-[11px] font-medium text-gray-500 mb-1 block">QR для скачивания</label>
                <select
                  value={contentSource === "dynamic" ? (selectedQrId ?? "") : ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) {
                      setContentSource("dynamic");
                      setSelectedQrId(id);
                    } else {
                      setContentSource("manual");
                      setSelectedQrId(null);
                    }
                  }}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Статический QR-код</option>
                  {userQrcodes.map((qr) => (
                    <option key={qr.id} value={qr.id}>
                      {qrDisplayName(qr)} · {qr.code}
                    </option>
                  ))}
                </select>
                {selectedQr && contentSource === "dynamic" && (
                  <p className="text-[10px] text-gray-400 mt-1 truncate font-mono">{scanUrlForCode(selectedQr.code)}</p>
                )}
              </div>
            )}
            <div
              className="flex-1 flex items-center justify-center p-4 rounded-xl min-h-[280px] qr-preview-checker"
              style={{
                backgroundImage: `
                  linear-gradient(45deg, #f1f5f9 25%, transparent 25%),
                  linear-gradient(-45deg, #f1f5f9 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, #f1f5f9 75%),
                  linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)`,
                backgroundSize: "20px 20px",
                backgroundPosition: "0 0, 0 10px, 10px -10px, 10px 0",
              }}
            >
              {!payload ? (
                <p className="text-sm text-gray-400 text-center px-4">
                  {contentSource === "dynamic" ? "Выберите QR-код из списка" : "Заполните поля для генерации QR"}
                </p>
              ) : (
                <canvas ref={previewRef} className="max-w-full max-h-[360px] w-auto h-auto" style={{ display: "block" }} />
              )}
            </div>

            {photoWarning && photoImage && (
              <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>
                  Фото может ухудшить читаемость QR. Попробуйте более тёмное изображение или другое фото.
                </span>
              </div>
            )}

            <div className="mt-4 space-y-2">
              {(selectedQrId || bindQrId) && !showSaveName && (
                <p className="text-xs text-gray-500 leading-relaxed">
                  Оформление сохранится в библиотеке и будет использоваться для PNG/JPG и печати выбранного QR.
                </p>
              )}
              {showSaveName ? (
                <div className="space-y-2">
                  <input
                    autoFocus
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveName.trim() && handleSave(saveName, { bindToQrId: selectedQrId })}
                    placeholder="Название шаблона"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    maxLength={60}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSaveName(false)}
                      className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSave(saveName, { bindToQrId: selectedQrId })}
                      disabled={busy || !saveName.trim()}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 min-w-0"
                    >
                      <Save className="w-4 h-4 shrink-0" aria-hidden />
                      <span className="truncate">{busy ? "Сохранение…" : saveLabel}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={applyToQr}
                  disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
                >
                  <Save className="w-4 h-4 shrink-0" aria-hidden />
                  {busy ? "Сохранение…" : saveLabel}
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPNG}
                  disabled={busy || !payload}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-40"
                >
                  <Download size={14} /> PNG
                </button>
                <button
                  type="button"
                  onClick={handleDownloadJPG}
                  disabled={busy || !payload}
                  className="flex items-center justify-center gap-1.5 py-2.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40"
                >
                  <Download size={14} /> JPG
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 p-3">
      <p className="text-xs font-semibold text-gray-600 mb-2">{title}</p>
      {children}
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
  transparent,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  transparent?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 w-20 flex-shrink-0">{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 rounded border border-gray-200 cursor-pointer"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const v = e.target.value.trim();
          if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);
        }}
        className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
        maxLength={7}
      />
      {transparent}
    </div>
  );
}
