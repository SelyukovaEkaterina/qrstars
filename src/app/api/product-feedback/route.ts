import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notifyProductFeedback } from "@/lib/telegram-support";
import { apiErrorResponse } from "@/lib/api-error";

const MAX_MESSAGE_LENGTH = 4_000;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as Record<string, unknown> | undefined)?.id;
  if (typeof userId !== "string") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const pageUrl = typeof body.pageUrl === "string" ? body.pageUrl.trim().slice(0, 500) : null;

    if (!message) {
      return NextResponse.json({ error: "Опишите идею или проблему" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: `Сообщение не должно быть длиннее ${MAX_MESSAGE_LENGTH} символов` }, { status: 400 });
    }

    const feedback = await prisma.productFeedback.create({
      data: { userId, message, pageUrl: pageUrl || null },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    await notifyProductFeedback({
      id: feedback.id,
      userId: feedback.user.id,
      email: feedback.user.email,
      name: feedback.user.name,
      message: feedback.message,
      pageUrl: feedback.pageUrl,
    }).catch((error) => console.error("notifyProductFeedback:", error));

    return NextResponse.json({ id: feedback.id, createdAt: feedback.createdAt }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Не удалось отправить сообщение");
  }
}
