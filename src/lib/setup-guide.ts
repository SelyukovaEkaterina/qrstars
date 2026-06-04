import prisma from "@/lib/prisma";
import { establishmentAccessWhere } from "@/lib/establishment-access";

/** Профиль онбординга по первому QR после мастера «первый запуск». */
export type SetupProfile = "reviews" | "landing" | "redirect";

export async function getSetupProfile(userId: string): Promise<SetupProfile | null> {
  const qr = await prisma.qRCode.findFirst({
    where: {
      userId,
      isActive: true,
      source: "DASHBOARD",
    },
    orderBy: { createdAt: "asc" },
    select: { mode: true },
  });
  if (!qr) return null;
  if (qr.mode === "REVIEW") return "reviews";
  if (qr.mode === "LANDING") return "landing";
  if (qr.mode === "REDIRECT") return "redirect";
  return null;
}

/**
 * Нужен мастер «первый запуск» — нет заведений и нет своих QR (в т.ч. без привязки к заведению).
 */
export async function userNeedsSetupGuide(userId: string): Promise<boolean> {
  const [accessibleCount, ownedQrCount] = await Promise.all([
    prisma.establishment.count({
      where: establishmentAccessWhere(userId),
    }),
    prisma.qRCode.count({ where: { userId } }),
  ]);
  return accessibleCount === 0 && ownedQrCount === 0;
}
