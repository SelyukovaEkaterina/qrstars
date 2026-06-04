import { generateQRWithCenter } from "@/lib/qr-generator";
import {
  renderQRTemplate,
  resolveQrStyleConfig,
  type QrStyleTemplateSource,
} from "@/lib/qr-code-templates";

export async function qrPreviewDataUrl(
  payload: string,
  options: {
    qrStyleTemplateId?: string | null;
    qrStyleTemplates?: QrStyleTemplateSource[];
    isPro?: boolean;
    size?: number;
  },
): Promise<string> {
  const config = resolveQrStyleConfig(
    options.qrStyleTemplateId,
    options.qrStyleTemplates ?? [],
  );
  const size = options.size ?? 512;

  if (config) {
    const canvas = document.createElement("canvas");
    await renderQRTemplate(canvas, config, payload, size);
    return canvas.toDataURL("image/png");
  }

  return generateQRWithCenter(payload, { isPro: options.isPro ?? false }, size);
}
