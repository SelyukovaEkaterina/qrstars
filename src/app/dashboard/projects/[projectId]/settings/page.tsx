import ProjectSettingsEditor from "@/components/dashboard/project/ProjectSettingsEditor";
import { isUnassignedProjectId, projectQrcodesPath } from "@/lib/project-routes";
import { redirect } from "next/navigation";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (isUnassignedProjectId(projectId)) {
    redirect(projectQrcodesPath(projectId));
  }
  return <ProjectSettingsEditor />;
}
