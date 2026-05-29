import prisma from "@/lib/prisma";
import { establishmentAccessWhere } from "@/lib/establishment-access";

/** Профиль онбординга по первому QR после мастера «первый запуск». */
export type SetupProfile = "reviews" | "landing";

export async function getSetupProfile(userId: string): Promise<SetupProfile | null> {
  const qr = await prisma.qRCode.findFirst({
    where: {
      userId,
      isActive: true,
      establishmentId: { not: null },
      source: "DASHBOARD",
    },
    orderBy: { createdAt: "asc" },
    select: { mode: true },
  });
  if (!qr) return null;
  if (qr.mode === "REVIEW") return "reviews";
  if (qr.mode === "LANDING") return "landing";
  return null;
}

/** Нужен мастер «первый запуск» — нет своих заведений и нет доступа как участник команды. */
export async function userNeedsSetupGuide(userId: string): Promise<boolean> {
  const [ownedCount, activeMembershipCount, accessibleCount] = await Promise.all([
    prisma.establishment.count({ where: { userId } }),
    prisma.establishmentMember.count({
      where: { userId, status: "ACTIVE" },
    }),
    prisma.establishment.count({ where: establishmentAccessWhere(userId) }),
  ]);

  if (accessibleCount > 0) return false;
  if (activeMembershipCount > 0) return false;
  return ownedCount === 0;
}
