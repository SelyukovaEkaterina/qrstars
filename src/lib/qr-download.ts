import {
  downloadQRTemplateAsPNG,
  downloadQRTemplateAsSVG,
  downloadSvgString,
  normalizeQRTemplateConfig,
  renderQRTemplate,
  resolveQrStyleConfig,
  type QrStyleTemplateSource,
} from "@/lib/qr-code-templates";
import { downloadBlob } from "@/lib/download-file";
import { generateQRWithCenter, generateQRSvg } from "@/lib/qr-generator";

/** ~20×20 cm at 300 DPI — suitable for print and design handoff. */
export const QR_EXPORT_SIZE = 2400;

export type QrDownloadOptions = {
  qrStyleTemplateId?: string | null;
  qrStyleTemplates?: QrStyleTemplateSource[];
  isPro?: boolean;
  size?: number;
  /** PNG only: transparent background (for overlays / design handoff). */
  transparentBackground?: boolean;
};

export async function downloadQrCode(
  format: "png" | "svg",
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
    const canvas = document.createElement("canvas");
    const exportConfig = transparent ? { ...config, bgTransparent: true } : config;
    await renderQRTemplate(
      canvas,
      normalizeQRTemplateConfig(exportConfig),
      payload,
      size,
    );
    if (format === "png") {
      await downloadQRTemplateAsPNG(
        canvas,
        transparent ? `${filenameBase}-transparent` : filenameBase,
      );
    } else {
      await downloadQRTemplateAsSVG(canvas, filenameBase);
    }
    return;
  }

  if (format === "png") {
    const dataUrl = await generateQRWithCenter(
      payload,
      { isPro: options.isPro ?? false },
      size,
      "#1e1b4b",
      transparent ? "#00000000" : "#ffffff",
    );
    const blob = await (await fetch(dataUrl)).blob();
    await downloadBlob(
      blob,
      `${transparent ? `${filenameBase}-transparent` : filenameBase}.png`,
    );
    return;
  }

  const svg = await generateQRSvg(payload, { isPro: options.isPro ?? false }, size);
  await downloadSvgString(svg, filenameBase);
}
