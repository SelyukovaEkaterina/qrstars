"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Box, Download, Lock } from "lucide-react";
import {
  QR_STL_COLOR_PAIRS,
  QR_STL_DEFAULTS,
  QR_STL_MIN_MODULE_MM,
  QR_STL_PREVIEW_DEFAULT_VIEW,
  bindQrStlOrbit,
  buildQrStlModel,
  drawQrStlPreview,
  encodeBinaryStl,
  estimatePlaGrams,
  qrStlModuleMm,
  zipStore,
  type QrModules,
  type QrStlOptions,
} from "@/lib/qr-engine";
import { downloadBlob } from "@/lib/download-file";
import { PLAN_PRICING, formatRub } from "@/lib/plans";
import { trackMetrikaGoal } from "@/lib/track-event";

type Props = {
  payload: string | null;
  fileBase: string;
};

const SIZES = [30, 40, 50, 60, 80, 100, 150];
const BASES = [1.2, 1.6, 2, 3];
const RELIEFS = [0.6, 1, 1.5, 2];
const fmt = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 1 });

/** Раздел «3D-печать (STL)» редактора стиля: превью — всем, STL — только PRO. */
export default function QR3DPrintPanel({ payload, fileBase }: Props) {
  const [opts, setOpts] = useState<QrStlOptions>(QR_STL_DEFAULTS);
  const [colors, setColors] = useState<string>(QR_STL_COLOR_PAIRS[0].id);
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef({ azimuth: QR_STL_PREVIEW_DEFAULT_VIEW.azimuth, elevation: QR_STL_PREVIEW_DEFAULT_VIEW.elevation });
  const [viewTick, setViewTick] = useState(0);

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((d) => setIsPro(!!(d.hasPaidFeatures ?? d.isPro)))
      .catch(() => setIsPro(false));
    trackMetrikaGoal("qr_stl_preview", { source: "dashboard" });
  }, []);

  const [qrLib, setQrLib] = useState<typeof import("qrcode") | null>(null);
  useEffect(() => {
    import("qrcode").then(setQrLib);
  }, []);
  // Для печати коррекция M: логотипа в модели нет, а модули крупнее, чем с H.
  const modules = useMemo<QrModules | null>(() => {
    if (!payload || !qrLib) return null;
    try {
      return qrLib.create(payload, { errorCorrectionLevel: "M" }).modules as unknown as QrModules;
    } catch {
      return null;
    }
  }, [payload, qrLib]);

  const pair = QR_STL_COLOR_PAIRS.find((p) => p.id === colors) ?? QR_STL_COLOR_PAIRS[0];
  const moduleMm = modules ? qrStlModuleMm(modules, opts) : 0;
  const stats = useMemo(() => {
    if (!modules) return null;
    const m = buildQrStlModel(modules, opts);
    return { ...m, grams: estimatePlaGrams(m.single) };
  }, [modules, opts]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !modules) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const css = canvas.clientWidth || 320;
    canvas.width = Math.round(css * dpr);
    canvas.height = Math.round(css * dpr * 0.8);
    drawQrStlPreview(canvas, modules, opts, { ...viewRef.current, lightColor: pair.light, darkColor: pair.dark });
  }, [modules, opts, pair, viewTick]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return bindQrStlOrbit(
      canvas,
      () => viewRef.current,
      (v) => {
        viewRef.current = v;
        setViewTick((t) => t + 1);
      },
    );
  }, [modules]);

  const set = <K extends keyof QrStlOptions>(key: K, value: QrStlOptions[K]) => setOpts((o) => ({ ...o, [key]: value }));

  const dynamic = !!payload && /\/q\/[^/]+$/.test(payload);
  // Статический код бесплатно и на лендинге — здесь тоже; PRO нужен для динамического.
  const locked = dynamic && !isPro;

  const download = async (format: "stl" | "zip") => {
    if (!modules || !stats) return;
    if (locked) {
      trackMetrikaGoal("qr_stl_paywall", { format });
      return;
    }
    setBusy(true);
    try {
      const name = `${fileBase}-3d-${opts.sizeMm}mm`;
      if (format === "stl") {
        const bytes = encodeBinaryStl(stats.single, "QrStars QR code");
        await downloadBlob(new Blob([bytes as BlobPart], { type: "model/stl" }), `${name}.stl`);
      } else {
        const files = stats.parts.map((p) => ({
          name: `${name}-${p.name === "base" ? "1-base" : "2-top"}.stl`,
          data: encodeBinaryStl(p.triangles, `QrStars QR ${p.name}`),
        }));
        await downloadBlob(new Blob([zipStore(files) as BlobPart], { type: "application/zip" }), `${name}-2-colors.zip`);
      }
      trackMetrikaGoal("qr_stl_download", { format, size: opts.sizeMm, style: opts.style });
    } finally {
      setBusy(false);
    }
  };

  const select = "h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm";

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Модель для 3D-принтера: табличка, брелок, подставка. Печатается двумя цветами — сменой филамента на нужной высоте или на
        многоцветном принтере.
      </p>

      <div className="relative mx-auto max-w-[420px] rounded-xl bg-gradient-to-b from-slate-100 to-slate-200">
        {modules ? (
          <canvas ref={canvasRef} className="block aspect-[5/4] w-full" aria-label="3D-превью модели" />
        ) : (
          <p className="py-10 text-center text-sm text-gray-400">Заполните содержимое — появится модель</p>
        )}
        {modules && <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-slate-500">Покрутите мышью или пальцем</span>}
      </div>

      <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
        {(
          [
            ["raised", "Рельеф"],
            ["engraved", "Гравировка"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={opts.style === id}
            onClick={() => set("style", id)}
            className={`h-8 rounded-md px-3 text-sm font-medium ${opts.style === id ? "bg-indigo-600 text-white" : "text-gray-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-medium text-gray-600">
          Размер
          <select className={select} value={opts.sizeMm} onChange={(e) => set("sizeMm", Number(e.target.value))}>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}×{s} мм
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-600">
          Поле вокруг кода
          <select className={select} value={opts.margin} onChange={(e) => set("margin", Number(e.target.value))}>
            {[1, 2, 3, 4].map((m) => (
              <option key={m} value={m}>
                {m} мод.
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-600">
          Подложка
          <select className={select} value={opts.baseMm} onChange={(e) => set("baseMm", Number(e.target.value))}>
            {BASES.map((b) => (
              <option key={b} value={b}>
                {fmt(b)} мм
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-600">
          {opts.style === "raised" ? "Высота рельефа" : "Глубина гравировки"}
          <select className={select} value={opts.reliefMm} onChange={(e) => set("reliefMm", Number(e.target.value))}>
            {RELIEFS.map((r) => (
              <option key={r} value={r}>
                {fmt(r)} мм
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={!!opts.keyring} onChange={(e) => set("keyring", e.target.checked)} className="h-4 w-4 rounded" />
        Ушко для брелока
      </label>

      <div>
        <span className="mb-1 block text-xs font-medium text-gray-600">Пластик в превью: светлый и тёмный</span>
        <div className="flex flex-wrap gap-1.5">
          {QR_STL_COLOR_PAIRS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.label}
              aria-label={p.label}
              aria-pressed={colors === p.id}
              onClick={() => setColors(p.id)}
              className={`flex h-8 w-11 overflow-hidden rounded-lg border-2 ${colors === p.id ? "border-indigo-500" : "border-gray-200"}`}
            >
              <span className="h-full w-1/2" style={{ background: p.light }} />
              <span className="h-full w-1/2" style={{ background: p.dark }} />
            </button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-600">
          Модуль {fmt(moduleMm)} мм · {fmt(stats.widthMm)}×{fmt(stats.depthMm)}×{fmt(stats.heightMm)} мм · до {fmt(stats.grams)} г PLA
          <br />
          Одним файлом: подложку печатайте {opts.style === "raised" ? "светлым" : "тёмным"} пластиком, на высоте{" "}
          <b>{fmt(stats.colorChangeMm)} мм</b> смените на {opts.style === "raised" ? "тёмный" : "светлый"}.
        </div>
      )}
      {modules && moduleMm < QR_STL_MIN_MODULE_MM && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Модули мельче {fmt(QR_STL_MIN_MODULE_MM)} мм — сопло 0,4 мм пропечатает их плохо. Увеличьте размер
          {dynamic ? "" : " или используйте динамический QR: у него короткая ссылка и модули крупнее"}.
        </p>
      )}
      {payload && (
        <p className="text-xs text-gray-500">
          {dynamic
            ? "Код динамический: напечатали один раз — ссылку меняете в карточке QR, модель перепечатывать не нужно."
            : "Код статический: ссылка зашита в пластик. Для таблички лучше динамический QR — его можно перенастроить после печати."}
        </p>
      )}

      {isPro === false && dynamic ? (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-indigo-900">
            <Lock size={14} /> Динамический QR для 3D-печати — в тарифе PRO
          </p>
          <p className="mt-1 text-xs text-indigo-800">
            STL с динамическим кодом — ссылку можно менять после печати — на PRO, {formatRub(PLAN_PRICING.PRO.halfYearRub)} за полгода.
            Статический код со ссылкой внутри можно скачать бесплатно на{" "}
            <a href="https://qrstars.ru/qr-kod-dlya-3d-pechati.html" target="_blank" rel="noopener" className="font-semibold underline">
              qrstars.ru
            </a>
            .
          </p>
          <Link
            href="/dashboard/subscription"
            onClick={() => trackMetrikaGoal("qr_stl_paywall", { format: "cta" })}
            className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white"
          >
            <Box size={15} /> Подключить PRO
          </Link>
        </div>
      ) : (
        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => download("stl")}
            disabled={!modules || busy || (dynamic && isPro === null)}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-gray-900 text-sm font-semibold text-white disabled:opacity-40"
          >
            <Download size={15} /> Скачать STL
          </button>
          <button
            type="button"
            onClick={() => download("zip")}
            disabled={!modules || busy || (dynamic && isPro === null)}
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-800 disabled:opacity-40"
          >
            Две детали для многоцветной печати (ZIP)
          </button>
        </div>
      )}
    </div>
  );
}
