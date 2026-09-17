import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { sessionUserId } from "@/lib/session-user";
import { resolveProjectSectionPath } from "@/lib/resolve-dashboard-project";
import type { ProjectSection } from "@/lib/project-routes";

function firstString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function redirectLegacyDashboard(
  section: ProjectSection,
  searchParams: Promise<Record<string, string | string[] | undefined>>,
  extra?: string,
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = sessionUserId(session);
  if (!userId) redirect("/login?session=expired");

  const sp = await searchParams;
  const preferred =
    firstString(sp.estId) ||
    firstString(sp.establishmentId) ||
    firstString(sp.est) ||
    firstString(sp.id);
  const keep = new URLSearchParams();
  for (const key of ["tab", "section", "welcome", "linkEst", "linkQr", "createEst"]) {
    const value = firstString(sp[key]);
    if (value) keep.set(key, value);
  }
  const extraPath = extra || firstString(sp.qrId);
  redirect(
    await resolveProjectSectionPath(
      userId,
      section,
      preferred,
      extraPath,
      keep.toString() || undefined,
    ),
  );
}
