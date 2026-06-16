import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  amountsMatch,
  getRobokassaConfig,
  verifyResultSignature,
} from "@/lib/robokassa";
import { handlePaidPaymentOrder } from "@/lib/subscription-activate";

export async function GET(request: NextRequest) {
  const config = getRobokassaConfig();
  if (!config) {
    return new NextResponse("Robokassa not configured", { status: 503 });
  }

  const query: Record<string, string | undefined> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  const invIdRaw = query.InvId ?? query.invId ?? query.InvoiceID;
  const outSum = query.OutSum ?? query.outsum;

  if (!invIdRaw || !outSum) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const invId = parseInt(invIdRaw, 10);
  if (Number.isNaN(invId)) {
    return new NextResponse("Invalid InvId", { status: 400 });
  }

  if (!verifyResultSignature(query, config.password2)) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  const order = await prisma.paymentOrder.findUnique({ where: { invId } });
  if (!order) {
    return new NextResponse("Order not found", { status: 404 });
  }

  if (!amountsMatch(Number(order.amount), outSum)) {
    return new NextResponse("Amount mismatch", { status: 400 });
  }

  if (order.status !== "PAID") {
    await handlePaidPaymentOrder(invId);
  }

  return new NextResponse(`OK${invId}`, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
