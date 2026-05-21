import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/utils";

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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

  const [referredUsers, earnings, withdrawals] = await Promise.all([
    prisma.user.findMany({
      where: { referredById: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        subscriptions: {
          where: { status: "ACTIVE", plan: "PRO" },
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { plan: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.partnerEarning.findMany({
      where: { partnerId: userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.partnerWithdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const now = new Date();
  const totalEarned = earnings.reduce((sum, e) => sum + e.amount, 0);
  const availableBalance = earnings
    .filter((e) => e.status === "AVAILABLE" || (e.status === "PENDING" && e.availableAt <= now))
    .reduce((sum, e) => sum + e.amount, 0);
  const pendingBalance = earnings
    .filter((e) => e.status === "PENDING" && e.availableAt > now)
    .reduce((sum, e) => sum + e.amount, 0);
  const withdrawnTotal = withdrawals
    .filter((w) => w.status === "PAID")
    .reduce((sum, w) => sum + w.amount, 0);

  return NextResponse.json({
    referralCode: user.referralCode,
    referralLink: `${getAppBaseUrl()}/register?ref=${user.referralCode}`,
    stats: {
      totalReferrals: referredUsers.length,
      totalEarned,
      availableBalance,
      pendingBalance,
      withdrawnTotal,
    },
    referredUsers,
    earnings,
    withdrawals,
  });
}
