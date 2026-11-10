"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Download, Lock, Sparkles } from "lucide-react";
import {
  QR_ANIMATIONS,
  QR_BASE_SIZE,
  createQrAnimation,
  isSocialAnimation,
  playQrAnimation,
  SOCIAL_HANDLE_MAX,
  qrCenterBox,
  type QrAnimationId,
  type QrLayout,
} from "@/lib/qr-engine";
import { type QRTemplateConfig, parseCenterTextLines, renderQRTemplate } from "@/lib/qr-code-templates";
import {
  QR_GIF_DEFAULT_SIZE,
  QR_GIF_SIZES,
  downloadBlob,
  encodeQrGif,
  pickReadableIntensity,
} from "@/lib/qr-animation-export";
import { PLAN_PRICING, formatRub } from "@/lib/plans";
import { trackMetrikaGoal } from "@/lib/track-event";

type Props = {
  /** Последний статичный кадр редактора (600 px). */
  getBase: () => { canvas: HTMLCanvasElement; layout: QrLayout } | null;
  /** Меняется после каждой перерисовки — перезапускает превью. */
  renderKey: number;
  cfg: QRTemplateConfig;
  payload: string | null;
  photoImage: HTMLImageElement | null;
  logoImage: HTMLImageElement | null;
  silhouetteImage: HTMLImageElement | null;
  fileBase: string;
};

/** Статичный кадр на непрозрачном фоне: GIF и проверка декодером идут с фоном. */
function opaqueCopy(src: HTMLCanvasElement, bg: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0);
  return c;
}

/** Раздел «Анимация» редактора стиля: превью — всем, GIF — только PRO. */
export default function QRAnimationPanel({
  getBase,
  renderKey,
  cfg,
  payload,
  photoImage,
  logoImage,
  silhouetteImage,
  fileBase,
}: Props) {
  const [anim, setAnim] = useState<QrAnimationId>("shine");
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const [size, setSize] = useState<number>(QR_GIF_DEFAULT_SIZE);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "warn" | "error"; text: string } | null>(null);
  const [handle, setHandle] = useState("");
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const social = isSocialAnimation(anim);

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((d) => setIsPro(!!(d.hasPaidFeatures ?? d.isPro)))
      .catch(() => setIsPro(false));
  }, []);

  const hasCenter =
    (cfg.centerMode === "text" && parseCenterTextLines(cfg.centerText).length > 0) ||
    (cfg.centerMode !== "text" && !!logoImage);
  const bg = cfg.bgTransparent ? "#ffffff" : cfg.bg;
  const design = { fg: cfg.fg, bg, bgTransparent: false, gradient: cfg.gradient, grad1: cfg.grad1, grad2: cfg.grad2 };

  /**
   * Статичный кадр под анимацию шириной `width` (код `qrSize` = width·600/canvasW).
   * YouTube / Telegram: свой значок закрывает центр — коррекция H, без своего логотипа и надписи.
   */
  const renderBase = async (width: number, editorLayout: QrLayout) => {
    const c = document.createElement("canvas");
    const exportCfg: QRTemplateConfig = social
      ? { ...cfg, bgTransparent: false, bg, ecc: "H", centerMode: "image", centerText: "" }
      : { ...cfg, bgTransparent: false, bg };
    const layout = await renderQRTemplate(
      c,
      exportCfg,
      payload!,
      (width * QR_BASE_SIZE) / editorLayout.canvasW,
      photoImage,
      social || cfg.centerMode === "text" ? null : logoImage,
      silhouetteImage,
    );
    return { canvas: c, layout };
  };
  const centerBoxFor = (layout: QrLayout) => (!social && hasCenter ? qrCenterBox(layout, cfg.logoSize) : null);

  // Живое превью: эффекты — поверх последнего кадра редактора, соцсети — свой кадр.
  useEffect(() => {
    const base = getBase();
    const canvas = previewRef.current;
    if (!base || !canvas || !payload) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const src = social ? await renderBase(base.layout.canvasW, base.layout) : { canvas: opaqueCopy(base.canvas, bg), layout: base.layout };
      if (cancelled) return;
      const animation = createQrAnimation(src.canvas, {
        id: anim,
        design,
        layout: src.layout,
        centerBox: centerBoxFor(src.layout),
        handle,
      });
      stop = playQrAnimation(canvas, animation);
    }, social ? 250 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      stop?.();
    };
    // design собирается из cfg — достаточно renderKey, анимации и ника.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anim, renderKey, handle]);

  const handleDownload = async () => {
    const base = getBase();
    if (!payload || !base) return;
    if (!isPro) {
      trackMetrikaGoal("qr_gif_paywall", { animation: anim });
      return;
    }
    setMessage(null);
    setProgress(0);
    try {
      const { default: jsQR } = await import("jsqr");
      // Силу эффекта подбираем на превью 600 px: там декодер работает быстро.
      const check = social ? await renderBase(base.layout.canvasW, base.layout) : { canvas: opaqueCopy(base.canvas, bg), layout: base.layout };
      const { intensity, unreadable, baseUnreadable } = await pickReadableIntensity(
        check.canvas,
        { id: anim, design, layout: check.layout, centerBox: centerBoxFor(check.layout), handle },
        jsQR,
      );
      const out = await renderBase(size, base.layout);
      const animation = createQrAnimation(out.canvas, {
        id: anim,
        design,
        layout: out.layout,
        centerBox: centerBoxFor(out.layout),
        intensity,
        handle,
      });
      const blob = await encodeQrGif(animation, setProgress);
      downloadBlob(blob, `${fileBase}-${anim}-${size}px.gif`);
      trackMetrikaGoal("qr_gif_download", { animation: anim, size });
      const mb = (blob.size / 1024 / 1024).toFixed(1);
      if (baseUnreadable) {
        setMessage({
          kind: "warn",
          text: `GIF готов (${mb} МБ), но сам код читается плохо даже без анимации. Добавьте контраста, поле вокруг кода или уменьшите логотип.`,
        });
      } else if (unreadable > 0) {
        setMessage({
          kind: "warn",
          text: `GIF готов (${mb} МБ), но ${unreadable} из 40 кадров читаются плохо. Добавьте контраста или выберите другую анимацию и проверьте камерой.`,
        });
      } else {
        setMessage({
          kind: "ok",
          text: intensity < 1 ? `GIF готов (${mb} МБ). Эффект чуть ослаблен, чтобы код читался в каждом кадре.` : `GIF готов (${mb} МБ).`,
        });
      }
    } catch {
      setMessage({ kind: "error", text: "Не удалось собрать GIF. Попробуйте размер поменьше." });
    } finally {
      setProgress(null);
    }
  };

  const proPrice = formatRub(PLAN_PRICING.PRO.halfYearRub);

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Для экранов, сторис, сайта и писем. Каждый кадр проверяется декодером. Для печати скачайте обычный PNG или SVG.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {QR_ANIMATIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            title={a.hint}
            aria-pressed={anim === a.id}
            onClick={() => {
              setAnim(a.id);
              setMessage(null);
              trackMetrikaGoal("qr_gif_preview", { animation: a.id });
            }}
            className={`h-9 rounded-lg border px-3 text-sm font-medium transition ${anim === a.id ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-700 hover:border-gray-300"}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      {social && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600">
            Ник или название канала {anim === "youtube" ? "на YouTube" : "в Telegram"}
          </span>
          <input
            value={handle}
            maxLength={SOCIAL_HANDLE_MAX}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@mychannel"
            className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
          />
          <span className="mt-1 block text-xs text-gray-400">Одно слово получит «@». Ник — только подпись, ссылку он не меняет.</span>
          {payload && (
            <span className="mt-2 block rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
              {/\/q\/[^/]+$/.test(payload) ? (
                <>
                  Код динамический (<span className="break-all font-mono">{payload}</span>) — ведёт туда, куда настроен в карточке QR. Поставьте там
                  ссылку на канал или любую другую.
                </>
              ) : (
                <>
                  Код ведёт на <span className="break-all font-mono">{payload.length > 80 ? `${payload.slice(0, 80)}…` : payload}</span>. Поменять
                  ссылку — в разделе «Содержимое QR-кода» выше.
                </>
              )}
            </span>
          )}
        </label>
      )}
      <div className="flex justify-center rounded-xl bg-gray-50 p-3">
        {payload ? (
          <canvas ref={previewRef} className="h-auto max-h-[220px] w-auto max-w-full" />
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">Заполните содержимое — появится превью</p>
        )}
      </div>

      {isPro === false ? (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-indigo-900">
            <Lock size={14} /> Анимированный QR — в тарифе PRO
          </p>
          <p className="mt-1 text-xs text-indigo-800">
            Посмотреть можно бесплатно, скачать GIF — на PRO, {proPrice} за полгода. Там же White Label, микросайт и уведомления в Telegram.
          </p>
          <Link
            href="/dashboard/subscription"
            onClick={() => trackMetrikaGoal("qr_gif_paywall", { animation: anim })}
            className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white"
          >
            <Sparkles size={15} /> Подключить PRO
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="qr-gif-size" className="text-xs font-medium text-gray-500">
              Размер GIF
            </label>
            <select
              id="qr-gif-size"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm"
            >
              {QR_GIF_SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!payload || progress !== null || isPro === null}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-gray-900 text-sm font-semibold text-white disabled:opacity-40"
          >
            <Download size={15} />
            {progress !== null ? `Собираем GIF… ${Math.round(progress * 100)}%` : "Скачать GIF"}
          </button>
        </div>
      )}

      {message && (
        <p
          className={`rounded-lg px-3 py-2 text-xs ${message.kind === "ok" ? "bg-emerald-50 text-emerald-800" : message.kind === "warn" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
