import type { StickerConfig } from "@/components/dashboard/StickerDesigner";

export interface BuiltinStickerPreset {
  id: string;
  name: string;
  /** Короткое имя для онбординга */
  shortName: string;
  sizeLabel: string;
  description: string;
  width: number;
  height: number;
  stickerConfig: Omit<StickerConfig, "url"> & { url?: string };
}

export const BUILTIN_STICKER_TEMPLATES: BuiltinStickerPreset[] = [
  {
    id: "universal-a6",
    name: "Универсальный тейбл-тент A6 (Меню/Отзывы/Чаевые)",
    shortName: "Универсальный тейбл-тент (A6)",
    sizeLabel: "148 × 105 мм",
    description: "Тейбл-тент формата A6 (лежачий) для столов. Меню, отзывы и чаевые в одном QR.",
    width: 148,
    height: 105,
    stickerConfig: {
      headline: "МЕНЮ · ОТЗЫВЫ · ЧАЕВЫЕ",
      ctaText: "Наведите камеру",
      labels: ["МЕНЮ", "ОТЗЫВЫ", "ЧАЕВЫЕ"],
      formatId: "a6l",
      layoutId: "ticket",
      paletteId: "light",
      brandColor: "#4F46E5",
      dotStyle: "rounded",
      eyeStyle: "rounded",
      showWatermark: false,
      pdfCount: 1,
    },
  },
  {
    id: "reviews-a6",
    name: "Тейбл-тент Отзывы A6 (Портрет)",
    shortName: "Тейбл-тент Отзывы (A6)",
    sizeLabel: "105 × 148 мм",
    description: "Вертикальный тейбл-тент A6 для сбора отзывов.",
    width: 105,
    height: 148,
    stickerConfig: {
      headline: "ОЦЕНИТЕ НАС",
      ctaText: "Наведите камеру",
      labels: ["★★★★★"],
      formatId: "a6p",
      layoutId: "editorial",
      paletteId: "cream",
      brandColor: "#A87C4F",
      dotStyle: "rounded",
      eyeStyle: "leaf",
      showWatermark: false,
      pdfCount: 1,
    },
  },
  {
    id: "sticker-7x7",
    name: "Стикер Отзывы 7×7 см",
    shortName: "Стикер Отзывы (7×7)",
    sizeLabel: "70 × 70 мм",
    description: "Средний стикер для столов, стоек или дверей.",
    width: 70,
    height: 70,
    stickerConfig: {
      headline: "ОТЗЫВ",
      ctaText: "Наведите камеру",
      labels: ["★★★★★"],
      formatId: "7x7",
      layoutId: "standard",
      paletteId: "dark",
      brandColor: "#F59E0B",
      dotStyle: "dots",
      eyeStyle: "circle",
      showWatermark: false,
      pdfCount: 1,
    },
  },
  {
    id: "sticker-5x5",
    name: "Компактный стикер Отзывы 5×5 см",
    shortName: "Стикер Отзывы (5×5)",
    sizeLabel: "50 × 50 мм",
    description: "Маленький квадратный стикер для экономии места.",
    width: 50,
    height: 50,
    stickerConfig: {
      headline: "ОЦЕНИТЕ НАС",
      ctaText: "Наведите камеру",
      labels: [],
      formatId: "5x5",
      layoutId: "standard",
      paletteId: "sunset",
      brandColor: "#EF4444",
      dotStyle: "rounded",
      eyeStyle: "circle",
      showWatermark: false,
      pdfCount: 1,
    },
  },
];

/** Stable Template.id for a built-in preset (public row in DB for FK). */
export function stickerPresetTemplateId(presetId: string): string {
  return `sticker-preset-${presetId}`;
}

export function isBuiltInStickerTemplateId(id: string): boolean {
  return id.startsWith("sticker-preset-");
}

export function stickerPresetLayout(preset: BuiltinStickerPreset): {
  __type: "sticker";
  width: number;
  height: number;
  background: { type: "solid"; color: string };
  elements: [];
  stickerConfig: StickerConfig;
} {
  return {
    __type: "sticker",
    width: preset.width,
    height: preset.height,
    background: { type: "solid", color: "#f8fafc" },
    elements: [],
    stickerConfig: {
      url: "https://qrstars.ru",
      ...preset.stickerConfig,
    } as StickerConfig,
  };
}

export type StickerTemplateSource = {
  id: string;
  name?: string;
  layout?: unknown;
};

export function resolveStickerPreset(
  templateId: string | null | undefined,
): BuiltinStickerPreset | null {
  if (!templateId || !isBuiltInStickerTemplateId(templateId)) return null;
  const presetId = templateId.slice("sticker-preset-".length);
  return BUILTIN_STICKER_TEMPLATES.find((p) => p.id === presetId) ?? null;
}

/** Resolve table-tent layout from DB row or built-in preset id. */
export function resolveStickerTemplate(
  templateId: string | null | undefined,
  templates: StickerTemplateSource[] = [],
): { id: string; name: string; layout: ReturnType<typeof stickerPresetLayout> } | null {
  if (!templateId) return null;

  const preset = resolveStickerPreset(templateId);
  if (preset) {
    return {
      id: templateId,
      name: preset.name,
      layout: stickerPresetLayout(preset),
    };
  }

  const tpl = templates.find((t) => t.id === templateId);
  const layout = tpl?.layout as ReturnType<typeof stickerPresetLayout> | undefined;
  if (layout?.__type === "sticker") {
    return { id: templateId, name: tpl?.name ?? "Шаблон", layout };
  }

  return null;
}

export function resolveStickerConfig(
  templateId: string | null | undefined,
  templates: StickerTemplateSource[] = [],
): StickerConfig | null {
  const resolved = resolveStickerTemplate(templateId, templates);
  return resolved?.layout.stickerConfig ?? null;
}

export function resolveStickerName(
  templateId: string | null | undefined,
  templates: StickerTemplateSource[] = [],
): string | null {
  if (!templateId) return null;
  const preset = resolveStickerPreset(templateId);
  if (preset) return preset.name;
  return templates.find((t) => t.id === templateId)?.name ?? null;
}

/** Virtual template rows for UI lists (no DB read required). */
export function builtinStickerTemplateRows(): Array<{
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  layout: ReturnType<typeof stickerPresetLayout>;
  isBuiltIn: true;
}> {
  return BUILTIN_STICKER_TEMPLATES.map((preset) => ({
    id: stickerPresetTemplateId(preset.id),
    name: preset.name,
    description: preset.description,
    width: preset.width,
    height: preset.height,
    layout: stickerPresetLayout(preset),
    isBuiltIn: true as const,
  }));
}
