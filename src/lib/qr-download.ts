import {
  downloadQRTemplateAsPNG,
  downloadQRTemplateAsSVG,
  downloadSvgString,
  normalizeQRTemplateConfig,
  renderQRTemplate,
  resolveQrStyleConfig,
  type QrStyleTemplateSource,
} from "@/lib/qr-code-templates";
import { generateQRWithCenter, generateQRSvg } from "@/lib/qr-generator";

/** ~20×20 cm at 300 DPI — suitable for print and design handoff. */
export const QR_EXPORT_SIZE = 2400;

export type QrDownloadOptions = {
  qrStyleTemplateId?: string | null;
  qrStyleTemplates?: QrStyleTemplateSource[];
  isPro?: boolean;
  size?: number;
};

export async function downloadQrCode(
  format: "png" | "svg",
  payload: string,
  filenameBase: string,
  options: QrDownloadOptions = {},
): Promise<void> {
  const size = options.size ?? QR_EXPORT_SIZE;
  const config = resolveQrStyleConfig(
    options.qrStyleTemplateId,
    options.qrStyleTemplates ?? [],
  );

  if (config) {
    const canvas = document.createElement("canvas");
    await renderQRTemplate(canvas, normalizeQRTemplateConfig(config), payload, size);
    if (format === "png") {
      downloadQRTemplateAsPNG(canvas, filenameBase);
    } else {
      downloadQRTemplateAsSVG(canvas, filenameBase);
    }
    return;
  }

  if (format === "png") {
    const dataUrl = await generateQRWithCenter(payload, { isPro: options.isPro ?? false }, size);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${filenameBase}.png`;
    a.click();
    return;
  }

  const svg = await generateQRSvg(payload, { isPro: options.isPro ?? false }, size);
  downloadSvgString(svg, filenameBase);
}
