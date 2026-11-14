/**
 * Раздел кабинета по адресу страницы — для события `dash.section_viewed`.
 * Идентификаторы проектов и QR отбрасываются: в аналитике нужен тип страницы.
 * Без зависимостей (клиент и тесты).
 */
export function dashboardSection(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const parts = pathname.split("?")[0].split("#")[0].split("/").filter(Boolean);
  if (parts[0] !== "dashboard") return null;
  if (parts.length === 1) return "home";

  if (parts[1] === "projects") {
    if (parts.length === 2) return "projects";
    if (parts.length === 3) return "project.home";
    const sub = parts[3];
    if (sub === "qrcodes") return parts.length > 4 ? "project.qrcode" : "project.qrcodes";
    return `project.${sub}`;
  }

  if (parts[1] === "settings" && parts[2]) return `settings.${parts[2]}`;
  return parts[1];
}

/** Ведёт ли ссылка на страницу тарифов. */
export function isSubscriptionHref(href: string | null | undefined): boolean {
  if (!href) return false;
  const path = href.replace(/^https?:\/\/[^/]+/i, "").split("?")[0].split("#")[0];
  return path === "/dashboard/subscription" || path.startsWith("/dashboard/subscription/");
}
