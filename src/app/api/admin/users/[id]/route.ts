import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      registrationSource: true,
      registrationUtm: true,
      metrikaClientId: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const { role, subscriptionPlan, subscriptionStatus, marketingEmailsEnabled, createdAt } = body;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userUpdate: { role?: typeof user.role; marketingEmailsEnabled?: boolean; createdAt?: Date } = {};

  if (role) {
    userUpdate.role = role;
  }

  if (typeof marketingEmailsEnabled === "boolean") {
    userUpdate.marketingEmailsEnabled = marketingEmailsEnabled;
  }

  if (createdAt && process.env.E2E_TESTING === "true") {
    const parsed = new Date(createdAt);
    if (!Number.isNaN(parsed.getTime())) {
      userUpdate.createdAt = parsed;
    }
  }

  if (Object.keys(userUpdate).length > 0) {
    await prisma.user.update({ where: { id }, data: userUpdate });
  }

  if (subscriptionPlan) {
    const existing = await prisma.subscription.findFirst({ where: { userId: id } });
    if (existing) {
      await prisma.subscription.updateMany({
        where: { userId: id },
        data: {
          plan: subscriptionPlan,
          status: subscriptionStatus || existing.status,
        },
      });
    } else {
      await prisma.subscription.create({
        data: {
          user: { connect: { id: id } },
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
