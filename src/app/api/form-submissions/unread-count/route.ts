import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { establishmentAccessWhere } from "@/lib/establishment-access";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const unreadCount = await prisma.formSubmission.count({
    where: {
      isRead: false,
      form: { establishment: establishmentAccessWhere(userId) },
    },
  });

  return NextResponse.json({ unreadCount });
}
