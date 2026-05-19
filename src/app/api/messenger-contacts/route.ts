import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

async function getUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return (session.user as Record<string, unknown>).id as string;
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contacts = await prisma.messengerContact.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ contacts });
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { provider, externalId, label } = body as {
    provider?: string;
    externalId?: string;
    label?: string;
  };

  if (provider !== "TELEGRAM" && provider !== "MAX") {
    return NextResponse.json({ error: "Некорректный провайдер" }, { status: 400 });
  }

  if (!externalId?.trim()) {
    return NextResponse.json({ error: "externalId обязателен" }, { status: 400 });
  }

  const contact = await prisma.messengerContact.upsert({
    where: {
      userId_provider_externalId: {
        userId,
        provider,
        externalId: externalId.trim(),
      },
    },
    create: {
      userId,
      provider,
      externalId: externalId.trim(),
      label: label?.trim() || (provider === "TELEGRAM" ? "Telegram" : "MAX"),
    },
    update: {
      ...(label !== undefined && { label: label?.trim() || null }),
    },
  });

  return NextResponse.json({ contact });
}

export async function DELETE(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const existing = await prisma.messengerContact.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.businessCard.updateMany({
      where: { contactMessengerId: id },
      data: { contactMessengerId: null },
    }),
    prisma.messengerContact.delete({ where: { id } }),
  ]);

  return NextResponse.json({ success: true });
}
