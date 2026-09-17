"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useParams } from "next/navigation";
import {
  LAST_PROJECT_COOKIE,
  UNASSIGNED_PROJECT_ID,
  isUnassignedProjectId,
  lastProjectCookieOptions,
} from "@/lib/project-routes";

export type ProjectScopeValue = {
  projectId: string;
  projectName: string;
  shortSlug: string | null;
  isUnassigned: boolean;
  projects: Array<{ id: string; name: string; shortSlug: string | null }>;
};

const ProjectScopeContext = createContext<ProjectScopeValue | null>(null);

export function ProjectScopeProvider({
  value,
  children,
}: {
  value: ProjectScopeValue;
  children: ReactNode;
}) {
  return <ProjectScopeContext.Provider value={value}>{children}</ProjectScopeContext.Provider>;
}

export function useProjectScope(): ProjectScopeValue | null {
  return useContext(ProjectScopeContext);
}

export function useLockedProjectId(): string | null {
  const scope = useProjectScope();
  const params = useParams();
  if (scope?.projectId) return scope.projectId;
  if (typeof params.projectId === "string") return params.projectId;
  return null;
}

export function RememberProject({ projectId }: { projectId: string }) {
  useEffect(() => {
    if (!projectId || isUnassignedProjectId(projectId)) return;
    const opts = lastProjectCookieOptions();
    document.cookie = `${LAST_PROJECT_COOKIE}=${encodeURIComponent(projectId)}; Path=${opts.path}; Max-Age=${opts.maxAge}; SameSite=${opts.sameSite}`;
    try {
      localStorage.setItem(LAST_PROJECT_COOKIE, projectId);
    } catch {
      /* private mode */
    }
  }, [projectId]);
  return null;
}
