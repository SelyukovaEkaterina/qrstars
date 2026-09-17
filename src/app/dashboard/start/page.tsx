import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import SetupStartWizard from "@/components/dashboard/SetupStartWizard";
import prisma from "@/lib/prisma";
import { establishmentAccessWhere } from "@/lib/establishment-access";
import type { RegistrationUtm } from "@/lib/registration-utm";
import { parseRegistrationUtm } from "@/lib/registration-utm";
import {
  canAddEstablishment,
  countUserEstablishments,
  effectivePlan,
  findActiveSubscription,
  hasPaidFeatures,
} from "@/lib/subscription-utils";
import { PRO_TRIAL_DAYS, getProTrialState } from "@/lib/pro-trial";

export default async function SetupStartPage({
  searchParams,
}: {
  searchParams: Promise<{ rerun?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { rerun } = await searchParams;
  const isRerun = rerun === "1" || rerun === "true";
  const userId = (session.user as Record<string, unknown>).id as string;

  const [establishments, ownedCount, subscription, userRow, trial] = await Promise.all([
    prisma.establishment.findMany({
      where: establishmentAccessWhere(userId),
      select: {
        id: true,
        name: true,
        industry: true,
        yandexMapsUrl: true,
        phone: true,
        legalName: true,
        inn: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    countUserEstablishments(userId),
    findActiveSubscription(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { registrationUtm: true },
    }),
    getProTrialState(userId),
  ]);

  const plan = effectivePlan(subscription);
  const canAddNewEstablishment = canAddEstablishment(plan, ownedCount);
  const paid = hasPaidFeatures(plan);
  const initialRegistrationUtm = parseRegistrationUtm(userRow?.registrationUtm) as RegistrationUtm | null;

  return (
    <SetupStartWizard
      rerun={isRerun}
      existingEstablishments={establishments}
      canAddNewEstablishment={canAddNewEstablishment}
      hasPaidFeatures={paid}
      trialEligible={trial.eligible}
      trialDays={PRO_TRIAL_DAYS}
      initialRegistrationUtm={initialRegistrationUtm}
    />
  );
}
