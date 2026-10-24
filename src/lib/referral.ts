import prisma from "@/lib/prisma";
import { normalizeInviteEmail } from "@/lib/establishment-access";

/** Партнёр по реферальному коду; сам себя пригласить нельзя. */
export async function findReferrerId(
  referralCode: string | null | undefined,
  newUserEmail: string,
): Promise<string | null> {
  if (!referralCode) return null;
  const referrer = await prisma.user.findUnique({
    where: { referralCode },
    select: { id: true, email: true },
  });
  if (!referrer) return null;
  if (normalizeInviteEmail(referrer.email) === normalizeInviteEmail(newUserEmail)) return null;
  return referrer.id;
}
