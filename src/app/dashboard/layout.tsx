import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { OnboardingTour } from "@/components/dashboard/OnboardingTour";
import SetupGuideRedirect from "@/components/dashboard/SetupGuideRedirect";
import { userNeedsSetupGuide } from "@/lib/setup-guide";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as Record<string, unknown>).id as string;
  const [user, needsSetup] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingCompleted: true },
    }),
    userNeedsSetupGuide(userId),
  ]);

  return (
    <>
      <SetupGuideRedirect />
      {children}
      {!needsSetup && (
        <OnboardingTour completed={user?.onboardingCompleted ?? false} />
      )}
    </>
  );
}
