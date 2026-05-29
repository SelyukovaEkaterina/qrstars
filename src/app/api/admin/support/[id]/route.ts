import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { getTelegramTopicUrl } from "@/lib/telegram-support";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, name: true, phone: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ticket: {
      ...ticket,
      telegramTopicUrl:
        ticket.telegramTopicId != null
          ? getTelegramTopicUrl(ticket.telegramTopicId)
          : null,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const status = body.status as string | undefined;

  if (status !== "OPEN" && status !== "CLOSED") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json({ ticket });
}
