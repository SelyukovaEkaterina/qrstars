"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Download, FileText, Image as ImageIcon, Loader2, Lock, Printer, RotateCcw, X } from "lucide-react";
import {
  PRINT_ACCENTS,
  PRINT_DESIGNS,
  PRINT_FORMATS,
  PRINT_TEXT_PRESETS,
  buildSheetLayout,
  defaultPrintSettings,
  exportDpi,
  findPrintFormat,
  itemSize,
  normalizeHex,
  sanitizePrintSettings,
  scenarioForMode,
  supportsExactOutput,
  supportsOrientation,
  type PrintDesignId,
  type PrintSettings,
} from "@/lib/print-sheet/layout";
import { renderSheet, renderSign, type SignContent } from "@/lib/print-sheet/render";
import { buildPdf, canvasToJpeg } from "@/lib/print-sheet/pdf";
import {
  renderQRTemplate,
  resolveQrStyleConfig,
  type QRTemplateConfig,
  type QrStyleTemplateSource,
} from "@/lib/qr-code-templates";
import { generateQRWithCenter } from "@/lib/qr-generator";
import { downloadBlob, downloadCanvas } from "@/lib/download-file";
import { scanUrlForCode, toSameOriginStorageUrl } from "@/lib/utils";
import { PLAN_PRICING, formatRub } from "@/lib/plans";
import { trackMetrikaGoal } from "@/lib/track-event";

export interface PrintSheetDesignerProps {
  qrId: string;
  code: string;
  mode: string;
  projectName: string;
  logoUrl: string | null;
  brandColor: string | null;
  wifi: { ssid: string; password: string | null } | null;
  qrStyleTemplateId: string | null;
  qrStyleTemplates: QrStyleTemplateSource[];
  isPro: boolean;
  onClose: () => void;
}

const STORAGE_PREFIX = "qrstars_print_sheet_v1:";
/** Сторона картинки QR: хватает на 170 мм при 300 dpi. */
const QR_SOURCE_PX = 2000;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function renderQrSource(
  payload: string,
  config: QRTemplateConfig | null,
  isPro: boolean,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  if (config) {
    await renderQRTemplate(canvas, config, payload, QR_SOURCE_PX);
    return canvas;
  }
  const img = await loadImage(await generateQRWithCenter(payload, { isPro }, QR_SOURCE_PX));
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d")!.drawImage(img, 0, 0);
  return canvas;
}

function bodyFontFamily(): string {
  if (typeof document === "undefined") return "sans-serif";
  return getComputedStyle(document.body).fontFamily || "sans-serif";
}

function readStored(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function shortLink(code: string): string {
  return scanUrlForCode(code).replace(/^https?:\/\//, "");
}

/** Грубая оценка: код читается примерно с расстояния в 10 своих сторон. */
function scanDistanceLabel(qrMm: number): string {
  const cm = Math.round(qrMm);
  if (cm >= 100) return `до ${(cm / 100).toFixed(1).replace(".", ",")} м`;
  return `до ~${Math.max(10, Math.round(cm / 5) * 5)} см`;
}

export default function PrintSheetDesigner(props: PrintSheetDesignerProps) {
  const { qrId, code, mode, projectName, logoUrl, brandColor, wifi, isPro, onClose } = props;
  const scenario = scenarioForMode(mode);
  const projectAccent = normalizeHex(brandColor);
  const defaults = useMemo(() => defaultPrintSettings(scenario, projectAccent), [scenario, projectAccent]);

  const [settings, setSettings] = useState<PrintSettings>(() => {
    if (typeof window === "undefined") return defaults;
    const own = readStored(STORAGE_PREFIX + qrId);
    if (own) return sanitizePrintSettings(own, defaults);
    // Новый QR: формат и дизайн — с прошлого раза, тексты — под режим этого QR,
    // цвет — проекта (прошлый мог быть из другого проекта).
    const last = readStored(STORAGE_PREFIX + "last") as Partial<PrintSettings> | null;
    if (!last) return defaults;
    return sanitizePrintSettings(
      {
        ...defaults,
        formatId: last.formatId,
        orientation: last.orientation,
        output: last.output,
        design: last.design,
        accent: projectAccent ?? last.accent,
      },
      defaults,
    );
  });

  const [qrSource, setQrSource] = useState<HTMLCanvasElement | null>(null);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [fontFamily, setFontFamily] = useState(bodyFontFamily);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<"" | "pdf" | "png">("");
  const [error, setError] = useState("");
  const [qrMm, setQrMm] = useState(0);
  const [designThumbs, setDesignThumbs] = useState<Partial<Record<PrintDesignId, string>>>({});
  const previewRef = useRef<HTMLCanvasElement>(null);
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });

  const format = findPrintFormat(settings.formatId);
  const layout = useMemo(
    () => buildSheetLayout(format, settings.orientation, settings.output),
    [format, settings.orientation, settings.output],
  );
  const branding = !(isPro && settings.hideBranding);

  const update = useCallback(<K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Метрика: открыли редактор.
  useEffect(() => {
    trackMetrikaGoal("print_sheet_open", { mode });
  }, [mode]);

  // Сохраняем настройки.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + qrId, JSON.stringify(settings));
      localStorage.setItem(STORAGE_PREFIX + "last", JSON.stringify(settings));
    } catch {
      /* приватный режим */
    }
  }, [qrId, settings]);

  // Esc закрывает, фон не прокручивается.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Список шаблонов у родителя пересоздаётся на каждый рендер — сравниваем сам конфиг.
  const styleConfigKey = JSON.stringify(resolveQrStyleConfig(props.qrStyleTemplateId, props.qrStyleTemplates));

  // QR со стилем, шрифт.
  useEffect(() => {
    let cancelled = false;
    void document.fonts?.ready.then(() => !cancelled && setFontFamily(bodyFontFamily()));
    renderQrSource(scanUrlForCode(code), JSON.parse(styleConfigKey) as QRTemplateConfig | null, isPro)
      .then((c) => !cancelled && setQrSource(c))
      .catch(() => !cancelled && setLoadError("Не удалось нарисовать QR-код. Обновите страницу."));
    return () => {
      cancelled = true;
    };
  }, [code, styleConfigKey, isPro]);

  // Логотип проекта.
  useEffect(() => {
    if (!logoUrl) return;
    let cancelled = false;
    loadImage(toSameOriginStorageUrl(logoUrl))
      .then((img) => !cancelled && setLogo(img))
      .catch(() => !cancelled && setLogo(null));
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  // Размер области превью.
  useEffect(() => {
    const el = previewBoxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setBoxSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const logoImage = logoUrl ? logo : null;
  const content = useMemo<SignContent | null>(() => {
    if (!qrSource) return null;
    const logo = logoImage;
    return {
      settings,
      scenario,
      name: projectName,
      logo,
      logoAspect: logo ? logo.naturalWidth / Math.max(1, logo.naturalHeight) : 1,
      qr: qrSource,
      qrPx: qrSource.width,
      link: shortLink(code),
      wifi,
      branding,
      fontFamily,
    };
  }, [qrSource, settings, scenario, projectName, logoImage, code, wifi, branding, fontFamily]);

  // Превью листа.
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !content || !boxSize.w || !boxSize.h) return;
    const id = requestAnimationFrame(() => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const fit = Math.min(boxSize.w / layout.pageWMm, boxSize.h / layout.pageHMm);
      const { qrMm: mm } = renderSheet(canvas, layout, content, fit * dpr);
      canvas.style.width = `${Math.round(layout.pageWMm * fit)}px`;
      canvas.style.height = `${Math.round(layout.pageHMm * fit)}px`;
      setQrMm(mm);
    });
    return () => cancelAnimationFrame(id);
  }, [content, layout, boxSize]);

  // Миниатюры дизайнов — на текущем формате и текстах.
  useEffect(() => {
    if (!content) return;
    const t = setTimeout(() => {
      const { wMm, hMm } = itemSize(format, settings.orientation);
      const k = 140 / Math.max(wMm, hMm);
      const next: Partial<Record<PrintDesignId, string>> = {};
      for (const d of PRINT_DESIGNS) {
        const c = document.createElement("canvas");
        c.width = Math.round(wMm * k);
        c.height = Math.round(hMm * k);
        const ctx = c.getContext("2d")!;
        renderSign(ctx, { x: 0, y: 0, w: wMm, h: hMm }, k, { ...content, settings: { ...content.settings, design: d.id } });
        next[d.id] = c.toDataURL("image/png");
      }
      setDesignThumbs(next);
    }, 250);
    return () => clearTimeout(t);
  }, [content, format, settings.orientation]);

  const fileBase = `qr-${code}-${format.id}${supportsOrientation(format) && settings.orientation === "landscape" ? "-landscape" : ""}`;

  const downloadPdf = async () => {
    if (!content) return;
    setBusy("pdf");
    setError("");
    try {
      const dpi = exportDpi(layout.pageWMm, layout.pageHMm);
      const canvas = document.createElement("canvas");
      renderSheet(canvas, layout, content, dpi / 25.4);
      const jpeg = await canvasToJpeg(canvas, 0.94);
      const pdf = buildPdf(
        [
          {
            jpeg,
            pxW: canvas.width,
            pxH: canvas.height,
            wMm: layout.pageWMm,
            hMm: layout.pageHMm,
            bleedMm: layout.bleedMm || undefined,
          },
        ],
        settings.title || "QR",
        "QrStars print sheet",
      );
      await downloadBlob(pdf, `${fileBase}${layout.bleedMm > 0 ? "-tipografiya" : ""}.pdf`);
      trackMetrikaGoal("print_sheet_download", { format: format.id, design: settings.design, output: layout.bleedMm > 0 ? "exact" : "sheet", file: "pdf" });
    } catch {
      setError("Не удалось собрать PDF. Попробуйте ещё раз или скачайте PNG.");
    } finally {
      setBusy("");
    }
  };

  const downloadPng = async () => {
    if (!content) return;
    setBusy("png");
    setError("");
    try {
      const { wMm, hMm } = itemSize(format, settings.orientation);
      const dpi = exportDpi(wMm, hMm);
      const k = dpi / 25.4;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(wMm * k);
      canvas.height = Math.round(hMm * k);
      renderSign(canvas.getContext("2d")!, { x: 0, y: 0, w: wMm, h: hMm }, k, content, {
        rounded: format.kind === "stickers",
      });
      await downloadCanvas(canvas, `${fileBase}.png`);
      trackMetrikaGoal("print_sheet_download", { format: format.id, design: settings.design, output: settings.output, file: "png" });
    } catch {
      setError("Не удалось сохранить PNG.");
    } finally {
      setBusy("");
    }
  };

  const resetTexts = () => {
    const d = PRINT_TEXT_PRESETS[scenario][0];
    setSettings((prev) => ({ ...prev, title: d.title, subtitle: d.subtitle, footer: d.footer }));
  };

  const accentChoices = useMemo(() => {
    const list = projectAccent ? [projectAccent, ...PRINT_ACCENTS.filter((c) => c !== projectAccent)] : PRINT_ACCENTS;
    return list;
  }, [projectAccent]);

  const presets = PRINT_TEXT_PRESETS[scenario];
  const groups: { title: string; kind: string }[] = [
    { title: "Табличка", kind: "sign" },
    { title: "Домик на стол", kind: "tent" },
    { title: "Стикеры", kind: "stickers" },
  ];
  const chip = (active: boolean) =>
    `rounded-xl border px-3 py-2 text-left text-sm transition ${
      active
        ? "border-indigo-600 bg-indigo-50 text-indigo-800 ring-1 ring-indigo-600"
        : "border-gray-200 bg-white text-gray-700 hover:border-indigo-300"
    }`;
  const sectionTitle = "mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500";
  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  const toggles: { key: keyof PrintSettings; label: string; hidden?: boolean; disabled?: boolean; hint?: string }[] = [
    {
      key: "showLogo",
      label: "Логотип",
      disabled: !logoImage,
      hint: logoImage ? undefined : "Загрузите логотип в редакторе микросайта",
    },
    { key: "showName", label: "Название проекта" },
    { key: "showStars", label: "Звёзды ★★★★★" },
    { key: "showHint", label: "Подсказка «Наведите камеру»" },
    { key: "showWifi", label: "Имя сети и пароль", hidden: !wifi?.ssid },
    { key: "showLink", label: "Ссылка под кодом", hint: shortLink(code) },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] flex bg-slate-900/60 backdrop-blur-sm lg:items-center lg:justify-center lg:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Табличка для печати"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full w-full flex-col overflow-hidden bg-white lg:h-[92dvh] lg:max-w-6xl lg:rounded-3xl">
        <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <Printer className="h-5 w-5 shrink-0 text-indigo-600" />
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-gray-900 sm:text-lg">Табличка для печати</h2>
              <p className="truncate text-xs text-gray-500">Готовый PDF: распечатайте дома или отнесите в типографию</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Превью */}
          <div className="flex shrink-0 flex-col bg-slate-100 lg:order-2 lg:min-h-0 lg:flex-1">
            <div ref={previewBoxRef} className="relative m-3 h-[38dvh] sm:m-5 lg:h-auto lg:flex-1">
              <div className="absolute inset-0 flex items-center justify-center">
                {loadError ? (
                  <p className="text-sm text-red-600">{loadError}</p>
                ) : !content ? (
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                ) : null}
                <canvas
                  ref={previewRef}
                  className={`rounded-sm bg-white shadow-xl shadow-slate-900/15 ${content ? "" : "hidden"}`}
                />
              </div>
            </div>
            <div className="px-4 pb-3 text-center text-xs text-gray-600 sm:px-5">
              <p>{layout.note}</p>
              {qrMm > 0 && (
                <p className={`mt-0.5 ${qrMm < 20 ? "font-semibold text-amber-700" : "text-gray-500"}`}>
                  QR-код {Math.round(qrMm)} мм — сканируется {scanDistanceLabel(qrMm)}
                  {qrMm < 20 && ". Мелковато: уберите часть текста или выберите формат крупнее"}
                </p>
              )}
            </div>
          </div>

          {/* Настройки */}
          <div className="min-h-0 flex-1 overflow-y-auto border-gray-100 px-4 py-4 sm:px-5 lg:order-1 lg:w-[420px] lg:flex-none lg:border-r">
            <section className="mb-6">
              <h3 className={sectionTitle}>Формат</h3>
              <div className="space-y-3">
                {groups.map((g) => (
                  <div key={g.kind}>
                    <p className="mb-1.5 text-xs text-gray-500">{g.title}</p>
                    <div className={`grid gap-2 ${g.kind === "sign" ? "grid-cols-4" : g.kind === "tent" ? "grid-cols-2" : "grid-cols-3"}`}>
                      {PRINT_FORMATS.filter((f) => f.kind === g.kind).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => update("formatId", f.id)}
                          className={chip(settings.formatId === f.id)}
                          title={f.hint}
                        >
                          <span className="block font-semibold">{f.label}</span>
                          {g.kind !== "sign" && <span className="block text-[11px] leading-tight text-gray-500">{f.hint}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {format.kind === "sign" && <p className="text-xs text-gray-500">{format.hint}</p>}
              </div>

              {supportsOrientation(format) && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(["portrait", "landscape"] as const).map((o) => (
                    <button key={o} type="button" onClick={() => update("orientation", o)} className={chip(settings.orientation === o)}>
                      <span className="flex items-center gap-2 font-medium">
                        <span
                          className={`inline-block border-2 border-current ${o === "portrait" ? "h-4 w-3" : "h-3 w-4"} rounded-[2px]`}
                        />
                        {o === "portrait" ? "Вертикально" : "Горизонтально"}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {supportsExactOutput(format) && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => update("output", "sheet")} className={chip(settings.output === "sheet")}>
                    <span className="block font-medium">{format.id === "a3" ? "Лист A3" : "Свой принтер"}</span>
                    <span className="block text-[11px] leading-tight text-gray-500">
                      {format.id === "a6" ? "4 шт. на A4" : format.id === "a5" ? "2 шт. на A4" : format.id === "a3" ? "копицентр" : "лист A4"}
                    </span>
                  </button>
                  <button type="button" onClick={() => update("output", "exact")} className={chip(settings.output === "exact")}>
                    <span className="block font-medium">Типография</span>
                    <span className="block text-[11px] leading-tight text-gray-500">точный формат, вылеты 2 мм</span>
                  </button>
                </div>
              )}
            </section>

            <section className="mb-6">
              <h3 className={sectionTitle}>Дизайн</h3>
              <div className="grid grid-cols-5 gap-2">
                {PRINT_DESIGNS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => update("design", d.id)}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-1.5 text-[11px] font-medium transition ${
                      settings.design === d.id
                        ? "border-indigo-600 text-indigo-800 ring-1 ring-indigo-600"
                        : "border-gray-200 text-gray-600 hover:border-indigo-300"
                    }`}
                  >
                    <span className="flex h-16 w-full items-center justify-center">
                      {designThumbs[d.id] ? (
                        <img src={designThumbs[d.id]} alt="" className="max-h-16 max-w-full rounded-sm shadow-sm" />
                      ) : (
                        <span className="h-12 w-9 rounded-sm bg-gray-100" />
                      )}
                    </span>
                    {d.label}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {accentChoices.map((c, i) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => update("accent", c)}
                    title={i === 0 && projectAccent ? "Цвет проекта" : c}
                    aria-label={i === 0 && projectAccent ? "Цвет проекта" : `Цвет ${c}`}
                    className={`h-8 w-8 rounded-full border-2 transition ${
                      settings.accent === c ? "border-gray-900 ring-2 ring-white ring-offset-0" : "border-white shadow"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <label
                  className="relative flex h-8 cursor-pointer items-center gap-1 rounded-full border border-gray-200 px-2.5 text-xs text-gray-600 hover:border-indigo-300"
                  title="Свой цвет"
                >
                  <span className="h-4 w-4 rounded-full border border-gray-300" style={{ backgroundColor: settings.accent }} />
                  Свой
                  <input
                    type="color"
                    value={settings.accent}
                    onChange={(e) => update("accent", normalizeHex(e.target.value) ?? settings.accent)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
              </div>
              {projectAccent && settings.accent === projectAccent && (
                <p className="mt-1.5 text-xs text-gray-500">Цвет проекта — как на микросайте</p>
              )}
            </section>

            <section className="mb-6">
              <div className="mb-2 flex items-center justify-between">
                <h3 className={sectionTitle + " mb-0"}>Текст</h3>
                <button type="button" onClick={resetTexts} className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600">
                  <RotateCcw className="h-3 w-3" /> Сбросить
                </button>
              </div>
              <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                {presets.map((p) => (
                  <button
                    key={p.title}
                    type="button"
                    onClick={() => setSettings((prev) => ({ ...prev, title: p.title, subtitle: p.subtitle, footer: p.footer }))}
                    className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      settings.title === p.title
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-gray-200 text-gray-700 hover:border-indigo-300"
                    }`}
                  >
                    {p.title}
                  </button>
                ))}
              </div>
              <div className="space-y-2.5">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Заголовок</span>
                  <input
                    className={inputClass}
                    value={settings.title}
                    maxLength={80}
                    onChange={(e) => update("title", e.target.value)}
                    placeholder="Оцените нас"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Подзаголовок</span>
                  <textarea
                    className={inputClass + " resize-none"}
                    rows={2}
                    value={settings.subtitle}
                    maxLength={160}
                    onChange={(e) => update("subtitle", e.target.value)}
                    placeholder="Можно оставить пустым"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Подпись внизу</span>
                  <input
                    className={inputClass}
                    value={settings.footer}
                    maxLength={80}
                    onChange={(e) => update("footer", e.target.value)}
                    placeholder="Например: Спасибо, что вы с нами!"
                  />
                </label>
              </div>
              {format.kind === "stickers" && (
                <p className="mt-2 text-xs text-gray-500">
                  На маленьком стикере остаются заголовок и QR — остальное не влезет.
                </p>
              )}
            </section>

            <section className="mb-6">
              <h3 className={sectionTitle}>Что показать</h3>
              <div className="space-y-1">
                {toggles
                  .filter((t) => !t.hidden)
                  .map((t) => (
                    <label
                      key={t.key}
                      className={`flex items-start gap-3 rounded-lg px-2 py-2 ${t.disabled ? "opacity-60" : "cursor-pointer hover:bg-gray-50"}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        checked={!t.disabled && (settings[t.key] as boolean)}
                        disabled={t.disabled}
                        onChange={(e) => update(t.key, e.target.checked as never)}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm text-gray-800">{t.label}</span>
                        {t.hint && <span className="block truncate text-xs text-gray-500">{t.hint}</span>}
                      </span>
                    </label>
                  ))}
                {isPro ? (
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={!settings.hideBranding}
                      onChange={(e) => update("hideBranding", !e.target.checked)}
                    />
                    <span className="text-sm text-gray-800">Подпись «Сделано в QrStars»</span>
                  </label>
                ) : (
                  <div className="flex items-start gap-3 rounded-lg bg-indigo-50/60 px-2 py-2">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                    <p className="text-xs text-gray-600">
                      Внизу таблички — мелкая подпись QrStars. Без неё — на{" "}
                      <Link href="/dashboard/subscription" className="font-semibold text-indigo-700 hover:underline">
                        PRO от {formatRub(PLAN_PRICING.PRO.halfYearRub)}
                      </Link>
                      .
                    </p>
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Стиль самого QR-кода берётся из шаблона в карточке QR. Код динамический: ссылку можно менять после печати.
              </p>
            </section>
          </div>
        </div>

        <footer className="border-t border-gray-100 bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-5">
          {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void downloadPdf()}
              disabled={!content || !!busy}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60 sm:flex-none"
            >
              {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Скачать PDF
            </button>
            <button
              type="button"
              onClick={() => void downloadPng()}
              disabled={!content || !!busy}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 transition hover:border-indigo-300 disabled:opacity-60"
              title="Одна табличка картинкой — для соцсетей или отправки в типографию"
            >
              {busy === "png" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              PNG
            </button>
            <p className="hidden min-w-0 flex-1 text-xs text-gray-500 sm:block">
              <Download className="mr-1 inline h-3 w-3" />
              Печатайте в масштабе 100% («Фактический размер»), без «Вписать в страницу»
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
