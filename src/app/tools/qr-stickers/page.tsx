"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import QRCodeLib from "qrcode";
import { Plus, Download, FileText, X, RotateCcw } from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────────── */
interface Theme {
  id: string;
  name: string;
  bg: string;
  text: string;
  qrDark: string;
  border?: string;
}

interface SizeOption {
  id: string;
  label: string;
  mm: number;
  previewPx: number;
}

/* ─── Constants ──────────────────────────────────────────────────────── */
const BUSINESS_PRESETS = [
  { id: "restaurant", name: "🍽 Ресторан / Кафе",   labels: ["МЕНЮ", "ОТЗЫВЫ", "ЧАЕВЫЕ"] },
  { id: "coffee",     name: "☕ Кофейня",            labels: ["МЕНЮ", "ОТЗЫВЫ", "БОНУСЫ"] },
  { id: "hotel",      name: "🏨 Отель",               labels: ["ЧЕК-ИН", "МЕНЮ", "ОТЗЫВЫ"] },
  { id: "beauty",     name: "💇 Салон / Барбершоп",  labels: ["ЗАПИСЬ", "ОТЗЫВЫ", "АКЦИИ"] },
  { id: "auto",       name: "🚗 Автосервис",          labels: ["ЗАПИСЬ", "ОТЗЫВЫ", "ПРАЙС"] },
  { id: "clinic",     name: "🏥 Клиника",             labels: ["ЗАПИСАТЬСЯ", "ОТЗЫВЫ", "УСЛУГИ"] },
  { id: "shop",       name: "🛍 Магазин",             labels: ["КАТАЛОГ", "ОТЗЫВЫ", "АКЦИИ"] },
  { id: "fitness",    name: "💪 Фитнес / Спорт",      labels: ["РАСПИСАНИЕ", "ОТЗЫВЫ", "АКЦИИ"] },
  { id: "custom",     name: "✏️ Свой вариант",        labels: [] },
];

const THEMES: Theme[] = [
  { id: "white",   name: "Белый",    bg: "#ffffff", text: "#1a1a2e", qrDark: "#1a1a2e", border: "#e5e7eb" },
  { id: "dark",    name: "Тёмный",   bg: "#1a1a2e", text: "#ffffff", qrDark: "#1a1a2e" },
  { id: "indigo",  name: "Индиго",   bg: "#4f46e5", text: "#ffffff", qrDark: "#1e1b4b" },
  { id: "emerald", name: "Изумруд",  bg: "#059669", text: "#ffffff", qrDark: "#064e3b" },
  { id: "rose",    name: "Розовый",  bg: "#e11d48", text: "#ffffff", qrDark: "#881337" },
  { id: "amber",   name: "Янтарь",   bg: "#d97706", text: "#ffffff", qrDark: "#78350f" },
  { id: "slate",   name: "Сланец",   bg: "#334155", text: "#f8fafc", qrDark: "#0f172a" },
];

const SIZES: SizeOption[] = [
  { id: "5x5", label: "5 × 5 см", mm: 50, previewPx: 280 },
  { id: "7x7", label: "7 × 7 см", mm: 70, previewPx: 350 },
];

const DPI = 300;
const MM2PX = DPI / 25.4; // ≈ 11.81 px per mm at 300 dpi

/* ─── Canvas helpers ─────────────────────────────────────────────────── */
function rrPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function renderSticker(
  canvas: HTMLCanvasElement,
  opts: {
    sizeMm: number;
    url: string;
    labels: string[];
    ctaText: string;
    theme: Theme;
    showWatermark: boolean;
  }
): Promise<void> {
  const { sizeMm, url, labels, ctaText, theme, showWatermark } = opts;
  const px = Math.round(sizeMm * MM2PX);
  canvas.width = px;
  canvas.height = px;

  const ctx = canvas.getContext("2d")!;
  const cr = px * 0.07; // corner radius

  /* Background */
  ctx.fillStyle = theme.bg;
  rrPath(ctx, 0, 0, px, px, cr);
  ctx.fill();

  /* Border (white theme only) */
  if (theme.border) {
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = Math.max(1, px * 0.003);
    rrPath(ctx, 1, 1, px - 2, px - 2, cr);
    ctx.stroke();
  }

  /* ── QR code ── */
  const qrTopPad = px * 0.058;
  const qrSize   = px * 0.635;
  const qrX      = (px - qrSize) / 2;
  const qrY      = qrTopPad;

  try {
    const qrDataUrl = await QRCodeLib.toDataURL(url || "https://qrstars.ru", {
      width: Math.round(qrSize * 2),
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: theme.qrDark, light: "#ffffff" },
    });
    const img = await loadImg(qrDataUrl);

    /* White card backing for coloured themes */
    if (theme.id !== "white") {
      const pad = px * 0.028;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.18)";
      ctx.shadowBlur  = px * 0.022;
      ctx.shadowOffsetY = px * 0.008;
      rrPath(ctx, qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2, px * 0.032);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.shadowBlur  = 0;
      ctx.shadowOffsetY = 0;
    }

    ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
  } catch {
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(qrX, qrY, qrSize, qrSize);
  }

  /* ── Divider ── */
  const divY = qrY + qrSize + px * 0.042;
  const divPad = px * 0.13;
  ctx.strokeStyle = theme.id === "white" ? "#e5e7eb" : `${theme.text}28`;
  ctx.lineWidth = Math.max(1, px * 0.004);
  ctx.beginPath();
  ctx.moveTo(divPad, divY);
  ctx.lineTo(px - divPad, divY);
  ctx.stroke();

  /* ── CTA text ── */
  const ctaFs = px * 0.068;
  const ctaY  = divY + px * 0.056;
  ctx.fillStyle = theme.text;
  ctx.font = `bold ${ctaFs}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ctaText, px / 2, ctaY);

  /* ── Labels ── */
  if (labels.length > 0) {
    const labFs = px * 0.046;
    ctx.font = `${labFs}px Arial, sans-serif`;
    ctx.fillStyle = theme.text;
    ctx.globalAlpha = 0.65;
    ctx.fillText(labels.join("  ·  "), px / 2, ctaY + px * 0.082);
    ctx.globalAlpha = 1;
  }

  /* ── Watermark ── */
  if (showWatermark) {
    const wmFs = px * 0.033;
    ctx.font = `${wmFs}px Arial, sans-serif`;
    ctx.fillStyle = theme.text;
    ctx.globalAlpha = 0.32;
    ctx.fillText("qrstars.ru", px / 2, px - px * 0.042);
    ctx.globalAlpha = 1;
  }
}

/* ─── PDF helpers ────────────────────────────────────────────────────── */
function calcGrid(sizeMm: number) {
  const margin = 10;
  const gap    = 5;
  const pageW  = 210;
  const pageH  = 297;
  const cols   = Math.floor((pageW - 2 * margin + gap) / (sizeMm + gap));
  const rows   = Math.floor((pageH - 2 * margin + gap) / (sizeMm + gap));
  return { cols, rows, perPage: cols * rows, margin, gap };
}

/* ═══════════════════════════════════════════════════════════════════════
   Page Component
═══════════════════════════════════════════════════════════════════════ */
export default function QRStickerPage() {
  const [url,           setUrl]           = useState("https://qrstars.ru");
  const [selectedSize,  setSelectedSize]  = useState(SIZES[0]);
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);
  const [selectedPreset,setSelectedPreset]= useState(BUSINESS_PRESETS[0]);
  const [labels,        setLabels]        = useState<string[]>(BUSINESS_PRESETS[0].labels);
  const [ctaText,       setCtaText]       = useState("Наведите камеру");
  const [newLabel,      setNewLabel]      = useState("");
  const [showWatermark, setShowWatermark] = useState(true);
  const [pdfCount,      setPdfCount]      = useState(10);
  const [busy,          setBusy]          = useState(false);

  const previewRef = useRef<HTMLCanvasElement>(null);

  /* ── Draw preview ── */
  const redraw = useCallback(async () => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const off = document.createElement("canvas");
    await renderSticker(off, { sizeMm: selectedSize.mm, url, labels, ctaText, theme: selectedTheme, showWatermark });
    const sz = selectedSize.previewPx;
    canvas.width  = sz;
    canvas.height = sz;
    canvas.getContext("2d")!.drawImage(off, 0, 0, sz, sz);
  }, [url, labels, ctaText, selectedTheme, selectedSize, showWatermark]);

  useEffect(() => {
    const t = setTimeout(redraw, 80);
    return () => clearTimeout(t);
  }, [redraw]);

  /* ── Preset select ── */
  const applyPreset = (p: typeof BUSINESS_PRESETS[0]) => {
    setSelectedPreset(p);
    if (p.id !== "custom") setLabels([...p.labels]);
  };

  /* ── Label CRUD ── */
  const addLabel = () => {
    const v = newLabel.trim().toUpperCase();
    if (v && !labels.includes(v) && labels.length < 5) {
      setLabels([...labels, v]);
      setNewLabel("");
    }
  };
  const removeLabel = (l: string) => setLabels(labels.filter(x => x !== l));

  /* ── Downloads ── */
  const downloadPNG = async () => {
    setBusy(true);
    try {
      const c = document.createElement("canvas");
      await renderSticker(c, { sizeMm: selectedSize.mm, url, labels, ctaText, theme: selectedTheme, showWatermark });
      const a = document.createElement("a");
      a.download = `qr-sticker-${selectedSize.id}.png`;
      a.href = c.toDataURL("image/png", 1.0);
      a.click();
    } finally { setBusy(false); }
  };

  const downloadPDF = async () => {
    setBusy(true);
    try {
      const c = document.createElement("canvas");
      await renderSticker(c, { sizeMm: selectedSize.mm, url, labels, ctaText, theme: selectedTheme, showWatermark });
      const imgData = c.toDataURL("image/png", 1.0);

      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const { cols, rows, perPage, margin, gap } = calcGrid(selectedSize.mm);

      for (let i = 0; i < pdfCount; i++) {
        if (i > 0 && i % perPage === 0) doc.addPage();
        const pos = i % perPage;
        const col = pos % cols;
        const row = Math.floor(pos / cols);
        const x   = margin + col * (selectedSize.mm + gap);
        const y   = margin + row * (selectedSize.mm + gap);
        doc.addImage(imgData, "PNG", x, y, selectedSize.mm, selectedSize.mm);
      }

      doc.save(`qr-stickers-${pdfCount}шт.pdf`);
    } finally { setBusy(false); }
  };

  const { perPage } = calcGrid(selectedSize.mm);
  const pagesNeeded = Math.ceil(pdfCount / perPage);

  /* ─── UI ─────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Генератор QR-стикеров</h1>
            <p className="text-sm text-gray-500 mt-0.5">Печатные стикеры 5×5 и 7×7 см для любого бизнеса</p>
          </div>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">internal tool</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* ── Left: Settings (3 cols) ── */}
          <div className="lg:col-span-3 space-y-5">

            {/* URL */}
            <Section title="Ссылка QR-кода">
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </Section>

            {/* Business presets */}
            <Section title="Тип бизнеса">
              <div className="grid grid-cols-2 gap-2">
                {BUSINESS_PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p)}
                    className={`text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                      selectedPreset.id === p.id
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium"
                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </Section>

            {/* Labels editor */}
            <Section title="Подписи под QR">
              {/* Chips */}
              <div className="flex flex-wrap gap-2 min-h-[32px] mb-3">
                {labels.length === 0 && (
                  <span className="text-sm text-gray-400 italic self-center">Нет подписей</span>
                )}
                {labels.map(l => (
                  <span
                    key={l}
                    className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full text-sm font-medium text-gray-700"
                  >
                    {l}
                    <button onClick={() => removeLabel(l)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>

              {/* Add label */}
              {labels.length < 5 && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLabel}
                    onChange={e => setNewLabel(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addLabel()}
                    placeholder="Добавить подпись (Enter)"
                    maxLength={20}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={addLabel}
                    className="px-3 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              )}
              {labels.length >= 5 && (
                <p className="text-xs text-gray-400">Максимум 5 подписей</p>
              )}

              {/* CTA text */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Призыв к действию
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ctaText}
                    onChange={e => setCtaText(e.target.value)}
                    maxLength={30}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => setCtaText("Наведите камеру")}
                    title="Сбросить"
                    className="px-2.5 py-2 border border-gray-200 rounded-lg text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>
            </Section>

            {/* Size */}
            <Section title="Размер стикера">
              <div className="flex gap-3">
                {SIZES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSize(s)}
                    className={`flex-1 py-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                      selectedSize.id === s.id
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </Section>

            {/* Theme */}
            <Section title="Цветовая тема">
              <div className="flex flex-wrap gap-2">
                {THEMES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTheme(t)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                      selectedTheme.id === t.id
                        ? "border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"
                      style={{ background: t.bg }}
                    />
                    <span className="text-gray-700">{t.name}</span>
                  </button>
                ))}
              </div>
            </Section>

            {/* Print settings */}
            <Section title="Настройки печати">
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showWatermark}
                    onChange={e => setShowWatermark(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">Показывать «qrstars.ru»</span>
                </label>

                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-700 whitespace-nowrap">Количество для PDF:</label>
                  <input
                    type="number"
                    value={pdfCount}
                    onChange={e => setPdfCount(Math.max(1, Math.min(200, Number(e.target.value))))}
                    min={1} max={200}
                    className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-gray-400">
                    = {pagesNeeded} стр. A4 ({perPage} шт./стр.)
                  </span>
                </div>
              </div>
            </Section>
          </div>

          {/* ── Right: Preview + Downloads (2 cols) ── */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sticky top-6">
              <div className="flex justify-between items-center mb-4">
                <span className="font-semibold text-gray-800">Предпросмотр</span>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {selectedSize.label}
                </span>
              </div>

              {/* Canvas preview */}
              <div className="flex justify-center mb-5">
                <div
                  className="rounded-xl overflow-hidden shadow-xl"
                  style={{
                    width:  selectedSize.previewPx,
                    height: selectedSize.previewPx,
                    background: "#f9fafb",
                  }}
                >
                  <canvas
                    ref={previewRef}
                    style={{ width: selectedSize.previewPx, height: selectedSize.previewPx, display: "block" }}
                  />
                </div>
              </div>

              {/* Download buttons */}
              <div className="space-y-2.5">
                <button
                  onClick={downloadPNG}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:scale-[.98] transition-all font-medium text-sm disabled:opacity-50"
                >
                  <Download size={16} />
                  Скачать PNG
                </button>
                <button
                  onClick={downloadPDF}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-lg hover:bg-black active:scale-[.98] transition-all font-medium text-sm disabled:opacity-50"
                >
                  <FileText size={16} />
                  Скачать PDF ({pdfCount} шт.)
                </button>
              </div>

              <p className="text-xs text-gray-400 text-center mt-3">
                {selectedSize.mm === 50 ? "591 × 591 px" : "827 × 827 px"} · 300 DPI
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ─── Small helper component ─────────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <p className="text-sm font-semibold text-gray-700 mb-3">{title}</p>
      {children}
    </div>
  );
}
