import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { establishmentAccessWhere, orphanQrcodeWhere } from "@/lib/establishment-access";
import {
  LAST_PROJECT_COOKIE,
  UNASSIGNED_PROJECT_ID,
  isUnassignedProjectId,
  projectHomePath,
  projectSectionPath,
  type ProjectSection,
} from "@/lib/project-routes";

export type DashboardProject = {
  id: string;
  name: string;
  shortSlug: string | null;
};

export async function getAccessibleProjects(userId: string): Promise<DashboardProject[]> {
  return prisma.establishment.findMany({
    where: establishmentAccessWhere(userId),
    select: { id: true, name: true, shortSlug: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function userHasOrphanQrcodes(userId: string): Promise<boolean> {
  const count = await prisma.qRCode.count({ where: orphanQrcodeWhere(userId) });
  return count > 0;
}

export async function resolveProjectId(
  userId: string,
  preferred?: string | null,
): Promise<string | null> {
  const projects = await getAccessibleProjects(userId);
  if (preferred && !isUnassignedProjectId(preferred) && projects.some((p) => p.id === preferred)) {
    return preferred;
  }
  const cookieStore = await cookies();
  const last = cookieStore.get(LAST_PROJECT_COOKIE)?.value;
  if (last && projects.some((p) => p.id === last)) return last;
  if (projects.length >= 1) return projects[0].id;
  if (await userHasOrphanQrcodes(userId)) return UNASSIGNED_PROJECT_ID;
  return null;
}

export async function resolveProjectSectionPath(
  userId: string,
  section: ProjectSection,
  preferred?: string | null,
  extra?: string,
  search?: string,
): Promise<string> {
  const projectId = await resolveProjectId(userId, preferred);
  if (!projectId) return "/dashboard/projects";
  if (isUnassignedProjectId(projectId) && section !== "qrcodes") {
    return projectSectionPath(projectId, "qrcodes");
  }
  return projectSectionPath(projectId, section, extra, search);
}

export async function resolveProjectHomePath(userId: string): Promise<string> {
  const projectId = await resolveProjectId(userId);
  if (!projectId) return "/dashboard/projects";
  return projectHomePath(projectId);
}
