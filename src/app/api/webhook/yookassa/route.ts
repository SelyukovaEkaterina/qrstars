import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const PARTNER_COMMISSION_RATE = 0.15;
const HOLD_DAYS = 30;

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
          user: { connect: { id: userId } },
          yookassaPaymentId: payment.payment_method?.id,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const payingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { referredById: true },
      });

      if (payingUser?.referredById) {
        const paymentAmount = parseFloat(payment.amount?.value || "990");
        const commissionAmount = Math.round(paymentAmount * PARTNER_COMMISSION_RATE * 100) / 100;
        const availableAt = new Date(Date.now() + HOLD_DAYS * 24 * 60 * 60 * 1000);

        await prisma.partnerEarning.create({
          data: {
            amount: commissionAmount,
            paymentAmount,
            status: "PENDING",
            availableAt,
            paymentId: payment.id,
            description: `15% от оплаты подписки PRO (${paymentAmount} ₽)`,
            partner: { connect: { id: payingUser.referredById } },
            referralUser: { connect: { id: userId } },
          },
        });
      }
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
