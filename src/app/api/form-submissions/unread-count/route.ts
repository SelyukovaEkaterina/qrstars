import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { establishmentAccessWhere } from "@/lib/establishment-access";

/**
 * Непрочитанные заявки с форм.
 * Без параметров — по всем доступным проектам; `?establishmentId=` — только по одному проекту
 * (доступ проверяется через establishmentAccessWhere, чужой проект → 404).
 * Жалобы (Review) не считаются: у отзывов нет признака «прочитано» для владельца.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const establishmentId = new URL(request.url).searchParams.get("establishmentId")?.trim();

  if (establishmentId) {
    const establishment = await prisma.establishment.findFirst({
      where: { id: establishmentId, ...establishmentAccessWhere(userId) },
      select: { id: true },
    });
    if (!establishment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const unreadCount = await prisma.formSubmission.count({
      where: { isRead: false, form: { establishmentId: establishment.id } },
    });
    return NextResponse.json({ unreadCount });
  }

  const unreadCount = await prisma.formSubmission.count({
    where: {
      isRead: false,
      form: { establishment: establishmentAccessWhere(userId) },
    },
  });

  return NextResponse.json({ unreadCount });
}
