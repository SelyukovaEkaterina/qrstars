import prisma from "@/lib/prisma";
import {
  BUILTIN_STICKER_TEMPLATES,
  stickerPresetLayout,
  stickerPresetTemplateId,
} from "@/lib/builtin-sticker-templates";
import type { Prisma } from "@/generated/prisma/client";

/** Ensures public DB rows for built-in sticker presets (FK targets for QRCode.templateId). */
export async function ensureStickerPresets(): Promise<void> {
  for (const preset of BUILTIN_STICKER_TEMPLATES) {
    const id = stickerPresetTemplateId(preset.id);
    const layout = stickerPresetLayout(preset) as unknown as Prisma.InputJsonValue;
    await prisma.template.upsert({
      where: { id },
      create: {
        id,
        name: preset.name,
        description: preset.description,
        width: preset.width,
        height: preset.height,
        layout,
        isPublic: true,
      },
      update: {
        name: preset.name,
        description: preset.description,
        width: preset.width,
        height: preset.height,
        layout,
        isPublic: true,
      },
    });
  }
}
