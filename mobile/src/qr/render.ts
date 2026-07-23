import { Skia, ImageFormat } from "@shopify/react-native-skia";
import type { SkImage, SkPicture } from "@shopify/react-native-skia";

import type { QRTemplateConfig } from "./types";
import { computeLayout, drawQR } from "./engine";
import { ensureEmojiImage } from "./emoji-images";

export interface QRRenderResult {
  picture: SkPicture;
  width: number;
  height: number;
}

export interface QROptions {
  logoImage?: SkImage | null;
  photoImage?: SkImage | null;
  qrSize?: number;
}

export function renderEmojiToImage(emoji: string, size: number): SkImage {
  const surface = Skia.Surface.Make(size, size);
  if (!surface) throw new Error("Failed to create surface for emoji");
  const canvas = surface.getCanvas();
  const font = Skia.Font();
  font.setSize(size * 0.7);
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  const metrics = font.getMetrics();
  const baseline = size * 0.5 - (metrics.ascent + metrics.descent) / 2;
  canvas.drawText(emoji, size * 0.15, baseline, paint, font);
  return surface.makeImageSnapshot();
}

export function loadImageFromBase64(base64: string): SkImage | null {
  const clean = base64.replace(/^data:[^;]+;base64,/, "");
  const data = Skia.Data.fromBase64(clean);
  return Skia.Image.MakeImageFromEncoded(data);
}

function resolveLogoImage(cfg: QRTemplateConfig): SkImage | null {
  if (cfg.logoDataUrl) {
    return loadImageFromBase64(cfg.logoDataUrl);
  }
  if (cfg.logoPreset) {
    // Skia's default font can't render emoji — use the Twemoji image cache.
    return ensureEmojiImage(cfg.logoPreset);
  }
  return null;
}

export function buildQRPicture(
  cfg: QRTemplateConfig,
  payload: string,
  options: QROptions = {},
): QRRenderResult {
  const qrSize = options.qrSize ?? 600;
  const { width, height } = computeLayout(cfg, payload, qrSize);
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
  const logoImage = options.logoImage !== undefined ? options.logoImage : resolveLogoImage(cfg);
  drawQR(canvas, cfg, payload, { ...options, logoImage, qrSize });
  const picture = recorder.finishRecordingAsPicture();
  return { picture, width, height };
}

export function exportQRToPNG(
  cfg: QRTemplateConfig,
  payload: string,
  options: QROptions = {},
): Uint8Array {
  const qrSize = options.qrSize ?? 600;
  const { width, height } = computeLayout(cfg, payload, qrSize);
  const surface = Skia.Surface.Make(width, height);
  if (!surface) throw new Error("Failed to create surface for PNG export");
  const canvas = surface.getCanvas();
  const logoImage = options.logoImage !== undefined ? options.logoImage : resolveLogoImage(cfg);
  drawQR(canvas, cfg, payload, { ...options, logoImage, qrSize });
  const image = surface.makeImageSnapshot();
  return image.encodeToBytes(ImageFormat.PNG, 100);
}

export function exportQRToBase64(
  cfg: QRTemplateConfig,
  payload: string,
  options: QROptions = {},
): string {
  const qrSize = options.qrSize ?? 600;
  const { width, height } = computeLayout(cfg, payload, qrSize);
  const surface = Skia.Surface.Make(width, height);
  if (!surface) throw new Error("Failed to create surface for base64 export");
  const canvas = surface.getCanvas();
  const logoImage = options.logoImage !== undefined ? options.logoImage : resolveLogoImage(cfg);
  drawQR(canvas, cfg, payload, { ...options, logoImage, qrSize });
  const image = surface.makeImageSnapshot();
  return image.encodeToBase64(ImageFormat.PNG, 100);
}
