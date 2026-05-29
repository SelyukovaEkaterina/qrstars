import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { isSupportTelegramConfigured, getTelegramTopicUrl } from "@/lib/telegram-support";
import { supportMessagePreview } from "@/lib/support-attachments";

export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const status = searchParams.get("status") || "all";
  const limit = 30;
  const skip = (page - 1) * limit;

  const where =
    status === "open"
      ? { status: "OPEN" as const }
      : status === "closed"
        ? { status: "CLOSED" as const }
        : {};

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
      include: {
        user: { select: { id: true, email: true, name: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            author: true,
            body: true,
            attachmentName: true,
            createdAt: true,
          },
        },
        _count: { select: { messages: true } },
      },
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return NextResponse.json({
    configured: isSupportTelegramConfigured(),
    tickets: tickets.map((t) => ({
      id: t.id,
      status: t.status,
      subject: t.subject,
      user: t.user,
      messageCount: t._count.messages,
      lastMessage: t.messages[0]
        ? {
            author: t.messages[0].author,
            body: supportMessagePreview(
              t.messages[0].body,
              t.messages[0].attachmentName
            ),
            createdAt: t.messages[0].createdAt,
          }
        : null,
      telegramTopicUrl:
        t.telegramTopicId != null ? getTelegramTopicUrl(t.telegramTopicId) : null,
      updatedAt: t.updatedAt,
      createdAt: t.createdAt,
    })),
    page,
    pages: Math.ceil(total / limit) || 1,
    total,
  });
}
