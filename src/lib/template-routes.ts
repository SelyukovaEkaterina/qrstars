const STATIC_TEMPLATE_SEGMENTS = new Set(["qr", "table-tents"]);

export function isTableTentTemplateEditorPath(pathname: string): boolean {
  const match = pathname.match(/^\/dashboard\/templates\/([^/]+)$/);
  if (!match) return false;
  return !STATIC_TEMPLATE_SEGMENTS.has(match[1]);
}

export const TEMPLATE_ROUTES = {
  qr: "/dashboard/settings/templates",
  tableTents: "/dashboard/settings/templates",
} as const;

export function templateSettingsPath(
  searchParams?: Record<string, string | string[] | undefined>,
  dropKeys: string[] = [],
): string {
  if (!searchParams) return TEMPLATE_ROUTES.qr;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (dropKeys.includes(key) || value == null) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => qs.append(key, v));
    } else {
      qs.set(key, value);
    }
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return `${TEMPLATE_ROUTES.qr}${suffix}`;
}
