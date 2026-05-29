import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import SetupStartWizard from "@/components/dashboard/SetupStartWizard";
import { userNeedsSetupGuide } from "@/lib/setup-guide";

export default async function SetupStartPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as Record<string, unknown>).id as string;
  const needsSetup = await userNeedsSetupGuide(userId);
  if (!needsSetup) {
    redirect("/dashboard");
  }

  return <SetupStartWizard />;
}
