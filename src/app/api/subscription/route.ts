import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createPayment } from "@/lib/yookassa";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const subscription = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ subscription });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();
  const { action } = body;

  if (action === "subscribe") {
    const existing = await prisma.subscription.findFirst({
      where: { userId, status: "ACTIVE", plan: "PRO" },
    });

    if (existing) {
      return NextResponse.json({ error: "У вас уже есть Pro-подписка" }, { status: 400 });
    }

    if (!process.env.YOOKASSA_SHOP_ID) {
      await prisma.subscription.upsert({
        where: { id: `mock-${userId}` },
        update: { plan: "PRO", status: "ACTIVE" },
        create: {
          plan: "PRO",
          status: "ACTIVE",
          userId,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      return NextResponse.json({ success: true, mode: "mock" });
    }

    const payment = await createPayment(
      990,
      "QrStars.ru Pro — подписка на 1 месяц",
      userId,
      { type: "subscription" }
    );

    return NextResponse.json({
      paymentUrl: payment.confirmation?.confirmation_url,
      paymentId: payment.id,
    });
  }

  if (action === "cancel") {
    await prisma.subscription.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { cancelAtPeriodEnd: true },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
