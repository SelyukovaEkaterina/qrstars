import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const { role, subscriptionPlan, subscriptionStatus } = body;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (role) {
    await prisma.user.update({ where: { id }, data: { role } });
  }

  if (subscriptionPlan) {
    const existing = await prisma.subscription.findFirst({ where: { userId: id } });
    if (existing) {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          plan: subscriptionPlan,
          status: subscriptionStatus || existing.status,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    } else {
      await prisma.subscription.create({
        data: {
          userId: id,
          plan: subscriptionPlan,
          status: subscriptionStatus || "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  const updated = await prisma.user.findUnique({
    where: { id },
    include: { subscriptions: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  return NextResponse.json({ user: updated });
}
