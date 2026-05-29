"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Loader2,
  ArrowLeft,
  Printer,
  CheckCircle2,
} from "lucide-react";
import Button from "@/components/ui/Button";
import {
  renderSticker,
  FORMATS,
  type StickerConfig,
} from "@/components/dashboard/StickerDesigner";
import {
  BATCH_PRINT_TEMPLATES,
  type BatchPrintTemplate,
} from "@/lib/batch-print-templates";
import {
  renderPremiumA4Sheet,
  type PremiumA4Deps,
  type PremiumA4TextOpts,
} from "@/lib/premium-a4-sheet";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface BatchQR {
  id: string;
  code: string;
  serialCode: string | null;
  isActive: boolean;
}
interface Batch {
  id: string;
  masterCode: string;
  label: string | null;
  qty: number;
  createdAt: string;
  qrcodes: BatchQR[];
}

// QR-коды ведут на landing-домен (qrstars.ru), который проксирует
// `/q/*`, `/scan/*`, `/activate/*` на app-контейнер.
const BASE_URL = "https://qrstars.ru";


/* ─────────────────────────────────────────────
   Template preview thumbnail
───────────────────────────────────────────── */
function TemplateThumbnail({ tpl }: { tpl: BatchPrintTemplate }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fmt = FORMATS.find((f) => f.id === tpl.config.formatId) || FORMATS[0];

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const previewFmt = { ...fmt, previewW: 160, previewH: 160, dpi: 72 };
    const cfg: StickerConfig = {
      ...tpl.config,
      url: `${BASE_URL}/q/demo`,
      pdfCount: 1,
    };
    renderSticker(c, cfg, previewFmt, true).catch(() => {});
  }, [tpl, fmt]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: 160, height: 160, objectFit: "contain" }}
      className="rounded-lg"
    />
  );
}

/* ─────────────────────────────────────────────
   Main page
───────────────────────────────────────────── */
export default function BatchPrintPage() {
  const { id } = useParams<{ id: string }>();
  const { status } = useSession();
  const router = useRouter();

  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTpl, setSelectedTpl] = useState<string>(
    BATCH_PRINT_TEMPLATES[0].id
  );
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/admin/login");
  }, [status, router]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/batches/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.batch) setBatch(d.batch);
        else setError(d.error || "Ошибка загрузки");
      })
      .catch(() => setError("Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleGenerate = useCallback(async () => {
    if (!batch) return;
    const tpl = BATCH_PRINT_TEMPLATES.find((t) => t.id === selectedTpl);
    if (!tpl) return;

    setGenerating(true);
    setProgress(0);
    setError("");

    try {
      const { jsPDF } = await import("jspdf");
      const fmt = FORMATS.find((f) => f.id === tpl.config.formatId) || FORMATS[0];

      // A4 layout constants (mm)
      const A4_W = 210;
      const A4_H = 297;
      const MARGIN = 8;
      const GAP = 5;
      const HEADER_H = 9;  // reserved for 2-line page header
      const INFO_H = 9;    // mm below each sticker for serial number

      // ── Premium A4 layout: единый рендерер из src/lib/premium-a4-sheet ──
      // Лицо стикера НЕ привязано к заведению — на момент печати с фабрики
      // QR-коды ещё не активированы.
      if (tpl.sheetLayout === "premium-a4-8x8") {
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

        // Cyrillic-safe text via canvas → PNG (jsPDF default fonts lack Cyrillic).
        const text = (
          s: string, x: number, y: number, opts: PremiumA4TextOpts = {}
        ) => {
          const { size = 8, bold = false, rgb = [40, 40, 40], align = "left", angle } = opts;
          const scale = 4;
          const fsPx = size * scale;
          const fontStr = `${bold ? "700" : "400"} ${fsPx}px Arial,sans-serif`;
          const meas = document.createElement("canvas").getContext("2d")!;
          meas.font = fontStr;
          const tw = Math.ceil(meas.measureText(s).width) + 4;
          const th = Math.ceil(fsPx * 1.5);

          // Render text to a tight horizontal canvas
          const tmpC = document.createElement("canvas");
          tmpC.width = tw; tmpC.height = th;
          const tmpCtx = tmpC.getContext("2d")!;
          tmpCtx.font = fontStr;
          tmpCtx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
          tmpCtx.textBaseline = "alphabetic";
          tmpCtx.fillText(s, 2, th * 0.78);

          const ppi = scale * 96;
          const wMm = (tw / ppi) * 25.4;
          const hMm = (th / ppi) * 25.4;

          if (!angle) {
            const drawX = align === "center" ? x - wMm / 2 : align === "right" ? x - wMm : x;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (doc as any).addImage(tmpC.toDataURL("image/png"), "PNG", drawX, y - hMm * 0.78, wMm, hMm);
            return;
          }

          // Rotated: bake rotation into a swap-dim canvas, place centered at (x, y)
          const rad = (angle * Math.PI) / 180;
          const cos = Math.abs(Math.cos(rad));
          const sin = Math.abs(Math.sin(rad));
          const outW = Math.ceil(tw * cos + th * sin);
          const outH = Math.ceil(tw * sin + th * cos);
          const c = document.createElement("canvas");
          c.width = outW; c.height = outH;
          const ctx = c.getContext("2d")!;
          ctx.translate(outW / 2, outH / 2);
          // canvas rotate uses CW positive; jsPDF angle uses CCW positive — invert
          ctx.rotate(-rad);
          ctx.drawImage(tmpC, -tw / 2, -th / 2);
          const outWMm = (outW / ppi) * 25.4;
          const outHMm = (outH / ppi) * 25.4;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (doc as any).addImage(c.toDataURL("image/png"), "PNG",
            x - outWMm / 2, y - outHMm / 2, outWMm, outHMm);
        };

        const deps: PremiumA4Deps = {
          doc, text,
          baseUrl: BASE_URL,
          onProgress: setProgress,
        };
        await renderPremiumA4Sheet(batch, deps);

        const labelPart = batch.label
          ? batch.label.replace(/[^a-z0-9а-яё_-]/gi, "-")
          : "batch";
        doc.save(`qrstars-premium-${labelPart}-${batch.masterCode}.pdf`);

        setGenerating(false);
        setProgress(0);
        return;
      }

      const colW = fmt.wMm;
      const rowH = fmt.hMm + INFO_H;

      const cols = Math.max(1, Math.floor((A4_W - 2 * MARGIN + GAP) / (colW + GAP)));
      const rows = Math.max(1, Math.floor((A4_H - 2 * MARGIN - HEADER_H + GAP) / (rowH + GAP)));
      const perPage = cols * rows;

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // ── Cyrillic text helper ──────────────────────────────────────────
      // jsPDF's built-in fonts don't support Cyrillic, so we render Russian
      // text on a canvas and embed it as a PNG image, aligning to the same
      // baseline position as doc.text(text, x, y) would use.
      function pdfCyrl(
        text: string, x: number, y: number,
        opts: { size?: number; bold?: boolean; rgb?: [number, number, number] } = {}
      ) {
        const { size = 7, bold = false, rgb = [40, 40, 40] } = opts;
        const scale = 4; // 4× oversampling → ~384 ppi
        const fsPx = size * scale;
        const fontStr = `${bold ? "700" : "400"} ${fsPx}px Arial,sans-serif`;
        const tmp = document.createElement("canvas");
        tmp.width = 1; tmp.height = 1;
        const tCtx = tmp.getContext("2d")!;
        tCtx.font = fontStr;
        const tw = Math.ceil(tCtx.measureText(text).width) + 4;
        const th = Math.ceil(fsPx * 1.5);
        const c = document.createElement("canvas");
        c.width = tw; c.height = th;
        const cCtx = c.getContext("2d")!;
        cCtx.font = fontStr;
        cCtx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        cCtx.textBaseline = "alphabetic";
        cCtx.fillText(text, 2, th * 0.78);
        const ppi = scale * 96;
        const wMm = (tw / ppi) * 25.4;
        const hMm = (th / ppi) * 25.4;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (doc as any).addImage(c.toDataURL("image/png"), "PNG", x, y - hMm * 0.78, wMm, hMm);
      }

      const batchUrl = `app.qrstars.ru/activate/batch/${batch.masterCode}`;
      let isFirstPage = true;

      const addPage = async (qrs: BatchQR[]) => {
        if (!isFirstPage) doc.addPage();
        isFirstPage = false;

        // Two-line page header
        const dateStr = new Date().toLocaleDateString("ru-RU");
        const labelPart = batch.label ? ` · ${batch.label}` : "";
        pdfCyrl(
          `SmartReview · Набор: ${batch.masterCode}${labelPart} · Дата: ${dateStr}`,
          MARGIN, MARGIN - 0.5,
          { size: 6, rgb: [150, 150, 150] }
        );
        doc.setFontSize(5.5);
        doc.setTextColor(100, 100, 100);
        doc.text(`Activation: ${batchUrl}`, MARGIN, MARGIN + 3.5);

        for (let i = 0; i < qrs.length; i++) {
          const qr = qrs[i];
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = MARGIN + col * (colW + GAP);
          const y = MARGIN + HEADER_H + row * (rowH + GAP);

          // Render sticker canvas
          const canvas = document.createElement("canvas");
          const cfg: StickerConfig = {
            ...tpl.config,
            url: `${BASE_URL}/q/${qr.code}`,
            pdfCount: 1,
          };
          await renderSticker(canvas, cfg, fmt, false);

          // Cut guide
          doc.setLineDashPattern([1, 1], 0);
          doc.setDrawColor(180, 180, 180);
          doc.setLineWidth(0.2);
          doc.rect(x - 1, y - 1, colW + 2, fmt.hMm + 2);
          doc.setLineDashPattern([], 0);

          // Sticker image
          doc.addImage(canvas.toDataURL("image/png", 1.0), "PNG", x, y, colW, fmt.hMm);

          // Serial number strip below sticker
          const infoY = y + fmt.hMm + 3.5;
          pdfCyrl(`Сер.: ${qr.serialCode || qr.code}`, x, infoY, { size: 6, bold: true, rgb: [40, 40, 40] });
          doc.setFontSize(5);
          doc.setTextColor(120, 120, 120);
          doc.text(qr.code, x, infoY + 3.5);

          setProgress(Math.round(((i + 1) / qrs.length) * 100));
          if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
        }
      };

      for (let p = 0; p < batch.qrcodes.length; p += perPage) {
        await addPage(batch.qrcodes.slice(p, p + perPage));
      }

      // ── Summary page ─────────────────────────────────────────────────
      doc.addPage();

      pdfCyrl("Список QR-кодов набора", MARGIN, 16, { size: 13, bold: true, rgb: [30, 30, 30] });

      pdfCyrl(
        `Набор: ${batch.masterCode}   Шаблон: ${tpl.name}   Количество: ${batch.qrcodes.length} шт.`,
        MARGIN, 23,
        { size: 8, rgb: [80, 80, 80] }
      );

      // Batch activation box
      const boxY = 27;
      doc.setFillColor(255, 248, 220);
      doc.setDrawColor(210, 150, 0);
      doc.setLineWidth(0.4);
      doc.rect(MARGIN, boxY, A4_W - 2 * MARGIN, 16, "FD");
      pdfCyrl("Пакетная активация всех кодов набора:", MARGIN + 3, boxY + 5, { size: 7.5, bold: true, rgb: [110, 70, 0] });
      pdfCyrl("Мастер-код:", MARGIN + 3, boxY + 11, { size: 7, rgb: [80, 55, 0] });
      doc.setFontSize(8);
      doc.setTextColor(30, 10, 0);
      doc.setFont("helvetica", "bold");
      doc.text(batch.masterCode, MARGIN + 27, boxY + 11);
      doc.setFont("helvetica", "normal");
      pdfCyrl("Ссылка:", MARGIN + 60, boxY + 11, { size: 7, rgb: [80, 55, 0] });
      doc.setFontSize(7);
      doc.setTextColor(0, 70, 160);
      doc.text(batchUrl, MARGIN + 76, boxY + 11);

      // Table
      const tableTop = 49;
      const rowStep = 5.5;

      pdfCyrl("#",              MARGIN,       tableTop, { size: 7, bold: true, rgb: [40, 40, 40] });
      pdfCyrl("Серийный №",     MARGIN + 10,  tableTop, { size: 7, bold: true, rgb: [40, 40, 40] });
      pdfCyrl("Код QR",         MARGIN + 50,  tableTop, { size: 7, bold: true, rgb: [40, 40, 40] });
      pdfCyrl("Статус",         MARGIN + 90,  tableTop, { size: 7, bold: true, rgb: [40, 40, 40] });
      pdfCyrl("URL активации",  MARGIN + 110, tableTop, { size: 7, bold: true, rgb: [40, 40, 40] });

      doc.setLineWidth(0.3);
      doc.setDrawColor(200, 200, 200);
      doc.line(MARGIN, tableTop + 1.5, A4_W - MARGIN, tableTop + 1.5);

      let ty = tableTop + rowStep;
      batch.qrcodes.forEach((qr, idx) => {
        if (ty > A4_H - MARGIN) {
          doc.addPage();
          ty = MARGIN + 10;
        }
        doc.setFontSize(6.5);
        doc.setTextColor(60, 60, 60);
        doc.setFont("helvetica", "normal");
        doc.text(String(idx + 1), MARGIN, ty);
        doc.text(qr.serialCode || "-", MARGIN + 10, ty);
        doc.text(qr.code, MARGIN + 50, ty);
        if (qr.isActive) {
          pdfCyrl("активирован", MARGIN + 90, ty, { size: 6.5, rgb: [0, 120, 50] });
        } else {
          pdfCyrl("не активирован", MARGIN + 90, ty, { size: 6.5, rgb: [160, 60, 0] });
        }
        doc.setFontSize(6);
        doc.setTextColor(80, 80, 80);
        doc.text(`app.qrstars.ru/q/${qr.code}`, MARGIN + 110, ty);
        ty += rowStep;
      });

      const label = batch.label ? batch.label.replace(/[^a-z0-9а-яё_-]/gi, "-") : "batch";
      doc.save(`qrstars-${label}-${batch.masterCode}.pdf`);
    } catch (e) {
      console.error(e);
      setError("Ошибка генерации PDF. Попробуйте ещё раз.");
    } finally {
      setGenerating(false);
      setProgress(0);
    }
  }, [batch, selectedTpl]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (error && !batch) {
    return (
      <div className="text-red-400 p-8">{error}</div>
    );
  }

  if (!batch) return null;

  const tpl = BATCH_PRINT_TEMPLATES.find((t) => t.id === selectedTpl)!;
  const fmt = FORMATS.find((f) => f.id === tpl.config.formatId) || FORMATS[0];
  const isPremium = tpl.sheetLayout === "premium-a4-8x8";
  const cols = isPremium ? 2 : Math.max(1, Math.floor((210 - 16 + 5) / (fmt.wMm + 5)));
  const rows = isPremium ? 3 : Math.max(1, Math.floor((297 - 16 - 9 + 5) / (fmt.hMm + 9 + 5)));
  const perPage = cols * rows;
  const pages = Math.ceil(batch.qrcodes.length / perPage);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/admin/batches")}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Printer className="w-6 h-6 text-amber-400" />
            Печать набора
          </h1>
          <p className="text-gray-400 mt-0.5">
            <span className="font-mono text-amber-300">{batch.masterCode}</span>
            {batch.label && <span className="ml-2">{batch.label}</span>}
            <span className="ml-2 text-gray-500">· {batch.qrcodes.length} шт.</span>
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Template selector */}
      <div className="bg-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="text-white font-semibold">Выберите шаблон стикера</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {BATCH_PRINT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTpl(t.id)}
              className={`rounded-xl border-2 p-3 flex flex-col items-center gap-2 transition-all text-left ${
                selectedTpl === t.id
                  ? "border-amber-400 bg-gray-700"
                  : "border-gray-600 bg-gray-750 hover:border-gray-400"
              }`}
            >
              <div className="relative">
                <TemplateThumbnail tpl={t} />
                {selectedTpl === t.id && (
                  <CheckCircle2 className="w-5 h-5 text-amber-400 absolute top-1 right-1 drop-shadow" />
                )}
              </div>
              <div>
                <p className="text-white text-sm font-medium text-center">{t.name}</p>
                <p className="text-gray-400 text-xs text-center mt-0.5">{t.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* PDF info */}
      <div className="bg-gray-800 rounded-xl p-6 space-y-3">
        <h2 className="text-white font-semibold">Параметры листа</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div className="bg-gray-700 rounded-lg p-3">
            <p className="text-gray-400 text-xs mb-1">Формат стикера</p>
            <p className="text-white font-medium">{fmt.name}</p>
            <p className="text-gray-500 text-xs">{fmt.sub}</p>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <p className="text-gray-400 text-xs mb-1">На листе A4</p>
            <p className="text-white font-medium">{perPage} шт.</p>
            <p className="text-gray-500 text-xs">{cols} × {rows}</p>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <p className="text-gray-400 text-xs mb-1">Страниц</p>
            <p className="text-white font-medium">{pages} + 1</p>
            <p className="text-gray-500 text-xs">+список кодов</p>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <p className="text-gray-400 text-xs mb-1">Всего QR</p>
            <p className="text-white font-medium">{batch.qrcodes.length}</p>
            <p className="text-gray-500 text-xs">
              {batch.qrcodes.filter((q) => q.isActive).length} активировано
            </p>
          </div>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-3 text-xs text-gray-400 space-y-1">
          <p>• Каждый стикер содержит уникальный QR-код и серийный номер для отслеживания.</p>
          <p>• PDF содержит страницу-реестр со всеми кодами и <strong>пакетной ссылкой активации</strong> (мастер-код <code className="bg-gray-600 px-1 rounded text-amber-300">{batch.masterCode}</code>).</p>
          <p>• Распечатайте на плотной бумаге (200+ г/м²) и вырежьте по пунктирным направляющим.</p>
        </div>
      </div>

      {/* Generate button */}
      <div className="flex items-center gap-4">
        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold px-6 py-3"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Генерация… {progress}%
            </>
          ) : (
            <>
              <Printer className="w-4 h-4 mr-2" />
              Скачать PDF для печати
            </>
          )}
        </Button>
        {generating && (
          <div className="flex-1 bg-gray-700 rounded-full h-2">
            <div
              className="bg-amber-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* QR list preview */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-3">
          QR-коды в наборе ({batch.qrcodes.length} шт.)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
          {batch.qrcodes.map((qr, i) => (
            <div
              key={qr.id}
              className={`rounded-lg p-2.5 text-xs ${
                qr.isActive ? "bg-green-900/30 border border-green-800" : "bg-gray-700"
              }`}
            >
              <p className="text-gray-400">#{i + 1} · {qr.serialCode || "—"}</p>
              <p className="font-mono text-white text-[11px] mt-0.5 break-all">{qr.code}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
