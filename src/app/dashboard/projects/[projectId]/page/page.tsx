import MicrositeEditor from "@/components/dashboard/project/MicrositeEditor";
import { isUnassignedProjectId, projectQrcodesPath } from "@/lib/project-routes";
import { redirect } from "next/navigation";

export default async function ProjectMicrositePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (isUnassignedProjectId(projectId)) {
    redirect(projectQrcodesPath(projectId));
  }
  return <MicrositeEditor />;
}
