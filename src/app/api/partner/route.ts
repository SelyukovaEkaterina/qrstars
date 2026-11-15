import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/utils";
import { REFERRAL_BONUS_DAYS, maskEmail } from "@/lib/referral";

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/** «Приведи друга»: ссылка, приглашённые (email замаскирован) и полученные месяцы PRO. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true, id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!user.referralCode) {
    let code = generateReferralCode();
    let exists = await prisma.user.findUnique({ where: { referralCode: code } });
    while (exists) {
      code = generateReferralCode();
      exists = await prisma.user.findUnique({ where: { referralCode: code } });
    }
    await prisma.user.update({
      where: { id: userId },
      data: { referralCode: code },
    });
    user = { ...user, referralCode: code };
  }

  const [referredUsers, rewards] = await Promise.all([
    prisma.user.findMany({
      where: { referredById: userId },
      select: { id: true, email: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.referralReward.findMany({
      where: { referrerId: userId },
      select: { friendId: true, referrerDays: true, createdAt: true },
    }),
  ]);

  const rewardByFriend = new Map(rewards.map((r) => [r.friendId, r]));
  const bonusDaysEarned = rewards.reduce((sum, r) => sum + r.referrerDays, 0);

  return NextResponse.json({
    referralCode: user.referralCode,
    referralLink: `${getAppBaseUrl()}/register?ref=${user.referralCode}`,
    bonusDays: REFERRAL_BONUS_DAYS,
    stats: {
      totalReferrals: referredUsers.length,
      paidReferrals: rewards.length,
      bonusDaysEarned,
    },
    // Пригласивший видит только маску email: чужие ПД не раскрываем.
    referredUsers: referredUsers.map((u) => {
      const reward = rewardByFriend.get(u.id);
      return {
        emailMasked: maskEmail(u.email),
        createdAt: u.createdAt,
        paid: Boolean(reward),
        rewardedAt: reward?.createdAt ?? null,
        bonusDays: reward?.referrerDays ?? 0,
      };
    }),
  });
}
