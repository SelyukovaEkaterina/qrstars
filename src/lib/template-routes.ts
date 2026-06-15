const STATIC_TEMPLATE_SEGMENTS = new Set(["qr", "table-tents"]);

export function isTableTentTemplateEditorPath(pathname: string): boolean {
  const match = pathname.match(/^\/dashboard\/templates\/([^/]+)$/);
  if (!match) return false;
  return !STATIC_TEMPLATE_SEGMENTS.has(match[1]);
}

export const TEMPLATE_ROUTES = {
  qr: "/dashboard/templates/qr",
  tableTents: "/dashboard/templates/table-tents",
} as const;
