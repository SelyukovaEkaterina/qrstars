/**
 * Проверка `layout` пользовательских шаблонов. Логотипы и фото лежат в layout data-URL'ом,
 * а `/api/qrcodes` отдаёт layout вместе с каждым QR — без лимита ответы раздуваются до мегабайт.
 */
export const MAX_TEMPLATE_LAYOUT_BYTES = 1_500_000;

export function validateTemplateLayout(layout: unknown): string | null {
  if (!layout || typeof layout !== "object" || Array.isArray(layout)) {
    return "Некорректное оформление шаблона";
  }
  const size = new TextEncoder().encode(JSON.stringify(layout)).length;
  if (size > MAX_TEMPLATE_LAYOUT_BYTES) {
    return "Шаблон слишком большой: уменьшите логотип или фото";
  }
  return null;
}
