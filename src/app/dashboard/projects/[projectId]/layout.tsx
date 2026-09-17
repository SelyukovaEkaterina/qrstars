import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireEstablishmentAccess } from "@/lib/establishment-access";
import { sessionUserId } from "@/lib/session-user";
import {
  UNASSIGNED_PROJECT_ID,
  isUnassignedProjectId,
} from "@/lib/project-routes";
import { getAccessibleProjects, userHasOrphanQrcodes } from "@/lib/resolve-dashboard-project";
import { ProjectScopeProvider, RememberProject } from "@/components/dashboard/ProjectScope";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = sessionUserId(session);
  if (!userId) redirect("/login?session=expired");

  const { projectId } = await params;
  const projects = await getAccessibleProjects(userId);

  if (isUnassignedProjectId(projectId)) {
    if (!(await userHasOrphanQrcodes(userId))) notFound();
    return (
      <ProjectScopeProvider
        value={{
          projectId: UNASSIGNED_PROJECT_ID,
          projectName: "Без проекта",
          shortSlug: null,
          isUnassigned: true,
          projects,
        }}
      >
        {children}
      </ProjectScopeProvider>
    );
  }

  const access = await requireEstablishmentAccess(userId, projectId);
  if (!access.ok) notFound();

  const current = projects.find((p) => p.id === projectId) ?? {
    id: access.establishment.id,
    name: access.establishment.name,
    shortSlug: null,
  };

  if (!current.shortSlug) {
    const row = await prisma.establishment.findUnique({
      where: { id: projectId },
      select: { shortSlug: true },
    });
    current.shortSlug = row?.shortSlug ?? null;
  }

  return (
    <ProjectScopeProvider
      value={{
        projectId,
        projectName: current.name,
        shortSlug: current.shortSlug,
        isUnassigned: false,
        projects,
      }}
    >
      <RememberProject projectId={projectId} />
      {children}
    </ProjectScopeProvider>
  );
}
