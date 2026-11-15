import type { FormPreset } from "@/lib/form-config";

/** Данные `prisma.form.create` из шаблона (без связи с проектом). */
export function formCreateFromPreset(
  preset: FormPreset,
  opts: { title?: string | null; enabled: boolean }
) {
  return {
    title: opts.title?.trim().slice(0, 200) || preset.title,
    submitLabel: preset.submitLabel,
    successMessage: preset.successMessage,
    preset: preset.id,
    enabled: opts.enabled,
    fields: {
      create: preset.fields.map((f, idx) => ({
        label: f.label,
        placeholder: f.placeholder ?? null,
        helpText: f.helpText ?? null,
        type: f.type,
        required: f.required,
        options: f.options ?? undefined,
        order: idx,
      })),
    },
  };
}
