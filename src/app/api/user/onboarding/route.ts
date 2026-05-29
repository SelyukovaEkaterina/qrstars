import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PATCH() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  await prisma.user.update({
    where: { id: userId },
    data: { onboardingCompleted: true },
  });

  return NextResponse.json({ ok: true });
}
