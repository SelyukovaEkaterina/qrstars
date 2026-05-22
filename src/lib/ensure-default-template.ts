import prisma from "@/lib/prisma";
import { TEMPLATE_PRESETS } from "@/lib/template-presets";

const DEFAULT_TEMPLATE_NAME = "Стандартная табличка";

export async function ensureDefaultTemplate(userId: string): Promise<void> {
  const count = await prisma.template.count({
    where: { OR: [{ userId }, { isPublic: true }] },
  });

  if (count > 0) return;

  const preset = TEMPLATE_PRESETS[0];
  await prisma.template.create({
    data: {
      name: DEFAULT_TEMPLATE_NAME,
      description: preset.description,
      width: preset.layout.width,
      height: preset.layout.height,
      layout: preset.layout as object,
      isPublic: false,
      user: { connect: { id: userId } },
    },
  });
}
