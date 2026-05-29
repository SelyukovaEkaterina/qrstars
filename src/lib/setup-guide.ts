import prisma from "@/lib/prisma";
import { establishmentAccessWhere } from "@/lib/establishment-access";

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
