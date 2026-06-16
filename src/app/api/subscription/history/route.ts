import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const orders = await prisma.paymentOrder.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      invId: true,
      kind: true,
      plan: true,
      billing: true,
      amount: true,
      status: true,
      paidAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    history: orders.map((order) => ({
      ...order,
      amount: Number(order.amount),
    })),
  });
}
