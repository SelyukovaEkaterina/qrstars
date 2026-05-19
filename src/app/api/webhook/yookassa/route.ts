import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();
  const event = body.event;
  const payment = body.object;

  if (!payment) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (event === "payment.succeeded") {
    const userId = payment.metadata?.userId;
    if (!userId) return NextResponse.json({ received: true });

    if (payment.metadata?.type === "subscription" || payment.recurring) {
      await prisma.subscription.upsert({
        where: { id: payment.id },
        update: {
          status: "ACTIVE",
          plan: "PRO",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
        },
        create: {
          id: payment.id,
          plan: "PRO",
          status: "ACTIVE",
          userId,
          yookassaPaymentId: payment.payment_method?.id,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  if (event === "payment.canceled") {
    await prisma.subscription.updateMany({
      where: { yookassaPaymentId: payment.payment_method?.id },
      data: { status: "CANCELED" },
    });
  }

  return NextResponse.json({ received: true });
}
