/**
 * Анимированный QR → GIF (кабинет, только PRO). Кадры рисует `qr-engine/animate.ts`,
 * здесь — проверка каждого кадра декодером и сборка GIF через `gifenc`.
 */
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import {
  checkScanLevel,
  createQrAnimation,
  type JsQrDecoder,
  type QrAnimation,
  type QrAnimationOptions,
  type QrLayout,
} from "@/lib/qr-engine";

/** Ширина GIF. Больше 1080 не даём: файл раздувается до десятков мегабайт. */
export const QR_GIF_SIZES = [
  { value: 480, label: "480 px — сайт, письма" },
  { value: 720, label: "720 px — соцсети" },
  { value: 1080, label: "1080 px — экраны, сторис" },
] as const;
export const QR_GIF_DEFAULT_SIZE = 720;

/** Если какой-то кадр не читается, эффект ослабляется по этим ступеням. */
const INTENSITY_STEPS = [1, 0.7, 0.45, 0.25];

const nextTick = () => new Promise<void>((r) => setTimeout(r, 0));

/** Номера кадров, которые декодер не читает даже крупно. */
export async function findUnreadableFrames(anim: QrAnimation, L: QrLayout, jsQR: JsQrDecoder): Promise<number[]> {
  const c = document.createElement("canvas");
  c.width = anim.width;
  c.height = anim.height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const bad: number[] = [];
  for (let i = 0; i < anim.frames; i++) {
    anim.draw(ctx, i);
    if (checkScanLevel(c, L, jsQR) === "screen") bad.push(i);
    if (i % 5 === 4) await nextTick();
  }
  return bad;
}

/**
 * Подбирает самую сильную версию эффекта, у которой читаются все кадры.
 * `base` — статичный кадр с непрозрачным фоном (проверять удобно на превью 600 px).
 */
export async function pickReadableIntensity(
  base: HTMLCanvasElement,
  opts: Omit<QrAnimationOptions, "intensity">,
  jsQR: JsQrDecoder,
): Promise<{ intensity: number; unreadable: number; baseUnreadable: boolean }> {
  // Сам статичный код не читается — анимация тут ни при чём, ослаблять бессмысленно.
  if (checkScanLevel(base, opts.layout, jsQR) === "screen") return { intensity: 1, unreadable: 0, baseUnreadable: true };
  let last = { intensity: INTENSITY_STEPS[INTENSITY_STEPS.length - 1], unreadable: 0 };
  for (const intensity of INTENSITY_STEPS) {
    const bad = await findUnreadableFrames(createQrAnimation(base, { ...opts, intensity }), opts.layout, jsQR);
    if (bad.length === 0) return { intensity, unreadable: 0, baseUnreadable: false };
    last = { intensity, unreadable: bad.length };
  }
  return { ...last, baseUnreadable: false };
}

/** Собирает GIF (бесконечный повтор). Палитра — своя у каждого кадра: «Перелив» меняет цвета. */
export async function encodeQrGif(anim: QrAnimation, onProgress?: (share: number) => void): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = anim.width;
  c.height = anim.height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const gif = GIFEncoder();
  for (let i = 0; i < anim.frames; i++) {
    anim.draw(ctx, i);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, c.width, c.height, { palette, delay: anim.delayMs, repeat: 0 });
    onProgress?.((i + 1) / anim.frames);
    await nextTick();
  }
  gif.finish();
  const bytes = gif.bytes();
  return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
    type: "image/gif",
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
