import {
  downloadQRTemplateAsJPG,
  downloadQRTemplateAsPNG,
  downloadSvgString,
  normalizeQRTemplateConfig,
  renderQRTemplate,
  renderQRTemplateSvg,
  resolveQrStyleConfig,
  type QrStyleTemplateSource,
} from "@/lib/qr-code-templates";
import { downloadBlob } from "@/lib/download-file";
import { generateQRWithCenter, generateQRSvg } from "@/lib/qr-generator";

/** ~20×20 cm at 300 DPI — suitable for print and design handoff. */
export const QR_EXPORT_SIZE = 2400;

/** Размеры PNG/JPG на выбор: экран, печать A5–A4, плакат, типография. */
export const QR_EXPORT_SIZES = [
  { value: 600, label: "600 px — экран" },
  { value: 1200, label: "1200 px — печать A5–A4" },
  { value: 2000, label: "2000 px — плакат" },
  { value: QR_EXPORT_SIZE, label: "2400 px — типография" },
] as const;

export type QrDownloadFormat = "png" | "jpg" | "svg";

export type QrDownloadOptions = {
  qrStyleTemplateId?: string | null;
  qrStyleTemplates?: QrStyleTemplateSource[];
  isPro?: boolean;
  size?: number;
  /** PNG only: transparent background (for overlays / design handoff). */
  transparentBackground?: boolean;
};

export async function downloadQrCode(
  format: QrDownloadFormat,
  payload: string,
  filenameBase: string,
  options: QrDownloadOptions = {},
): Promise<void> {
  const size = options.size ?? QR_EXPORT_SIZE;
  const transparent = format === "png" && !!options.transparentBackground;
  const config = resolveQrStyleConfig(
    options.qrStyleTemplateId,
    options.qrStyleTemplates ?? [],
  );

  if (config) {
    const exportConfig = normalizeQRTemplateConfig(transparent ? { ...config, bgTransparent: true } : config);
    if (format === "svg") {
      await downloadSvgString(await renderQRTemplateSvg(exportConfig, payload), filenameBase);
      return;
    }
    const canvas = document.createElement("canvas");
    await renderQRTemplate(canvas, exportConfig, payload, size);
    if (format === "jpg") {
      await downloadQRTemplateAsJPG(canvas, filenameBase);
      return;
    }
    await downloadQRTemplateAsPNG(
      canvas,
      transparent ? `${filenameBase}-transparent` : filenameBase,
    );
    return;
  }

  if (format === "svg") {
    const svg = await generateQRSvg(payload, { isPro: options.isPro ?? false }, size);
    await downloadSvgString(svg, filenameBase);
    return;
  }

  const dataUrl = await generateQRWithCenter(
    payload,
    { isPro: options.isPro ?? false },
    size,
    "#1e1b4b",
    transparent ? "#00000000" : "#ffffff",
  );
  const blob = await (await fetch(dataUrl)).blob();
  if (format === "jpg") {
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    URL.revokeObjectURL(img.src);
    await downloadQRTemplateAsJPG(canvas, filenameBase);
    return;
  }
  await downloadBlob(
    blob,
    `${transparent ? `${filenameBase}-transparent` : filenameBase}.png`,
  );
}
