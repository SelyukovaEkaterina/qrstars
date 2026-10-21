import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { OnboardingTour } from "@/components/dashboard/OnboardingTour";
import QaModeBanner from "@/components/dashboard/QaModeBanner";
import SetupGuideRedirect from "@/components/dashboard/SetupGuideRedirect";
import { getSetupProfile, userNeedsSetupGuide } from "@/lib/setup-guide";
import { sessionUserId } from "@/lib/session-user";
import DashboardChrome from "@/components/dashboard/DashboardChrome";
import GeneratorStyleImporter from "@/components/dashboard/GeneratorStyleImporter";
import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Кабинет — QrStars",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = sessionUserId(session);
  if (!userId) redirect("/login?session=expired");

  const [user, needsSetup, setupProfile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingCompleted: true },
    }),
    userNeedsSetupGuide(userId),
    getSetupProfile(userId),
  ]);

  if (!user) redirect("/login?session=expired");

  return (
    <>
      <QaModeBanner />
      <SetupGuideRedirect />
      <Suspense fallback={null}>
        <GeneratorStyleImporter />
      </Suspense>
      <DashboardChrome>{children}</DashboardChrome>
      {!needsSetup && (
        <OnboardingTour
          userId={userId}
          completed={user?.onboardingCompleted ?? false}
          setupProfile={setupProfile}
        />
      )}
    </>
  );
}
