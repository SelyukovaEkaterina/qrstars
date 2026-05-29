import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { PlanId } from "@/lib/plans";

const PARTNER_COMMISSION_RATE = 0.15;
const HOLD_DAYS = 30;

function subscriptionPeriodMs(billing: string | undefined): number {
  if (billing === "yearly") return 365 * 24 * 60 * 60 * 1000;
  return 30 * 24 * 60 * 60 * 1000;
}

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
      const planMeta = payment.metadata?.plan;
      const plan: PlanId =
        planMeta === "NETWORK" ? "NETWORK" : planMeta === "PRO" ? "PRO" : "PRO";
      const billing = payment.metadata?.billing as string | undefined;
      const periodEnd = new Date(Date.now() + subscriptionPeriodMs(billing));

      await prisma.subscription.upsert({
        where: { id: payment.id },
        update: {
          status: "ACTIVE",
          plan,
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
        create: {
          id: payment.id,
          plan,
          status: "ACTIVE",
          user: { connect: { id: userId } },
          yookassaPaymentId: payment.payment_method?.id,
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
        },
      });

      const payingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { referredById: true },
      });

      if (payingUser?.referredById) {
        const paymentAmount = parseFloat(payment.amount?.value || "690");
        const commissionAmount = Math.round(paymentAmount * PARTNER_COMMISSION_RATE * 100) / 100;
        const availableAt = new Date(Date.now() + HOLD_DAYS * 24 * 60 * 60 * 1000);
        const planLabel = plan === "NETWORK" ? "Сеть" : "PRO";

        await prisma.partnerEarning.create({
          data: {
            amount: commissionAmount,
            paymentAmount,
            status: "PENDING",
            availableAt,
            paymentId: payment.id,
            description: `15% от оплаты подписки ${planLabel} (${paymentAmount} ₽)`,
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
