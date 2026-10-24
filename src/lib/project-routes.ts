/** UI «Проект» = техническая сущность Establishment. Публичные URL не меняются. */

import { isMicrositeSlug } from "./microsite-host";

export const LAST_PROJECT_COOKIE = "qrstars_last_project";

/** Служебный раздел для QR без привязки к проекту (legacy). */
export const UNASSIGNED_PROJECT_ID = "unassigned";

export type ProjectSection =
  | "home"
  | "page"
  | "card"
  | "qrcodes"
  | "inbox"
  | "stats"
  | "settings";

export function isUnassignedProjectId(id: string | null | undefined): boolean {
  return id === UNASSIGNED_PROJECT_ID;
}

export function parseProjectIdFromPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const match = pathname.match(/^\/dashboard\/projects\/([^/]+)/);
  return match?.[1] ?? null;
}

export function isProjectDashboardPath(pathname: string | null | undefined): boolean {
  return Boolean(pathname?.startsWith("/dashboard/projects/"));
}

export function lastProjectCookieOptions() {
  return {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax" as const,
  };
}

export function projectHomePath(projectId: string): string {
  if (isUnassignedProjectId(projectId)) {
    return projectQrcodesPath(projectId);
  }
  return `/dashboard/projects/${projectId}`;
}

export function projectPagePath(projectId: string, search?: string): string {
  const path = `/dashboard/projects/${projectId}/page`;
  return search ? `${path}${search.startsWith("?") ? search : `?${search}`}` : path;
}

/** Редактор QR-визитки проекта (отдельно от микросайта). */
export function projectCardPath(projectId: string): string {
  return `/dashboard/projects/${projectId}/card`;
}

export function projectQrcodesPath(projectId: string): string {
  return `/dashboard/projects/${projectId}/qrcodes`;
}

export function projectQrPath(projectId: string, qrId: string): string {
  return `/dashboard/projects/${projectId}/qrcodes/${qrId}`;
}

export function projectQrNewPath(projectId: string): string {
  return projectQrPath(projectId, "new");
}

export function projectInboxPath(projectId: string, tab?: "reviews" | "submissions"): string {
  const path = `/dashboard/projects/${projectId}/inbox`;
  return tab ? `${path}?tab=${tab}` : path;
}

export function projectStatsPath(projectId: string): string {
  return `/dashboard/projects/${projectId}/stats`;
}

export function projectSettingsPath(projectId: string): string {
  return `/dashboard/projects/${projectId}/settings`;
}

export function projectSectionPath(
  projectId: string,
  section: ProjectSection = "home",
  extra?: string,
  search?: string,
): string {
  let path: string;
  switch (section) {
    case "page":
      path = projectPagePath(projectId);
      break;
    case "card":
      path = projectCardPath(projectId);
      break;
    case "qrcodes":
      path = extra ? projectQrPath(projectId, extra) : projectQrcodesPath(projectId);
      break;
    case "inbox":
      path = projectInboxPath(projectId);
      break;
    case "stats":
      path = projectStatsPath(projectId);
      break;
    case "settings":
      path = projectSettingsPath(projectId);
      break;
    default:
      path = projectHomePath(projectId);
  }
  if (!search) return path;
  return `${path}${search.startsWith("?") ? search : `?${search}`}`;
}

export function micrositePublicUrl(shortSlug: string | null | undefined): string | null {
  const slug = shortSlug?.trim().toLowerCase();
  if (!slug) return null;
  if (isMicrositeSlug(slug)) return `https://${slug}.qrstars.ru`;
  return `/a/${slug}`;
}
