import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import SetupStartWizard from "@/components/dashboard/SetupStartWizard";
import prisma from "@/lib/prisma";
import { establishmentAccessWhere } from "@/lib/establishment-access";
import {
  canAddEstablishment,
  countUserEstablishments,
  effectivePlan,
  findActiveSubscription,
} from "@/lib/subscription-utils";

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

  const [establishments, ownedCount, subscription] = await Promise.all([
    prisma.establishment.findMany({
      where: establishmentAccessWhere(userId),
      select: { id: true, name: true, yandexMapsUrl: true, phone: true, legalName: true, inn: true },
      orderBy: { createdAt: "desc" },
    }),
    countUserEstablishments(userId),
    findActiveSubscription(userId),
  ]);

  const plan = effectivePlan(subscription);
  const canAddNewEstablishment = canAddEstablishment(plan, ownedCount);

  return (
    <SetupStartWizard
      rerun={isRerun}
      existingEstablishments={establishments}
      canAddNewEstablishment={canAddNewEstablishment}
    />
  );
}
