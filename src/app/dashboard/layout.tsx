import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { OnboardingTour } from "@/components/dashboard/OnboardingTour";
import QaModeBanner from "@/components/dashboard/QaModeBanner";
import SetupGuideRedirect from "@/components/dashboard/SetupGuideRedirect";
import { getSetupProfile, userNeedsSetupGuide } from "@/lib/setup-guide";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as Record<string, unknown>).id as string;
  const [user, needsSetup, setupProfile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingCompleted: true },
    }),
    userNeedsSetupGuide(userId),
    getSetupProfile(userId),
  ]);

  return (
    <>
      <QaModeBanner />
      <SetupGuideRedirect />
      {children}
      {!needsSetup && (
        <OnboardingTour
          completed={user?.onboardingCompleted ?? false}
          setupProfile={setupProfile}
        />
      )}
    </>
  );
}
