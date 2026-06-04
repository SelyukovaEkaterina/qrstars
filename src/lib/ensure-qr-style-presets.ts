import prisma from "@/lib/prisma";
import { QR_CODE_TEMPLATES, qrStylePresetTemplateId } from "@/lib/qr-code-templates";
import type { Prisma } from "@/generated/prisma/client";

function presetLayout(presetId: string, config: (typeof QR_CODE_TEMPLATES)[number]["config"]): Prisma.InputJsonValue {
  return {
    __type: "qr-style",
    presetId,
    config: config as unknown as Prisma.InputJsonValue,
  };
}

/** Ensures public DB rows for each preset in QR_CODE_TEMPLATES so they can be linked via qrStyleTemplateId. */
export async function ensureQrStylePresets(): Promise<void> {
  for (const preset of QR_CODE_TEMPLATES) {
    const id = qrStylePresetTemplateId(preset.id);
    const layout = presetLayout(preset.id, preset.config);
    await prisma.template.upsert({
      where: { id },
      create: {
        id,
        name: preset.name,
        description: preset.description,
        width: 100,
        height: 100,
        layout,
        isPublic: true,
      },
      update: {
        name: preset.name,
        description: preset.description,
        layout,
        isPublic: true,
      },
    });
  }
}
