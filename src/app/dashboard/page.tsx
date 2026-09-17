import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { sessionUserId } from "@/lib/session-user";
import { resolveProjectHomePath } from "@/lib/resolve-dashboard-project";

export default async function DashboardIndexPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = sessionUserId(session);
  if (!userId) redirect("/login?session=expired");
  redirect(await resolveProjectHomePath(userId));
}
