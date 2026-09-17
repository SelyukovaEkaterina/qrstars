import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { sessionUserId } from "@/lib/session-user";
import { projectSettingsPath } from "@/lib/project-routes";
import { resolveProjectId } from "@/lib/resolve-dashboard-project";

export default async function LegacyEstablishmentSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = sessionUserId(session);
  if (!userId) redirect("/login?session=expired");
  const { id } = await params;
  const projectId = await resolveProjectId(userId, id);
  redirect(projectSettingsPath(projectId || id));
}
