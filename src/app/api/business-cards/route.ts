import { logUserEvent } from "@/lib/user-events-server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { establishmentAccessWhere } from "@/lib/establishment-access";
import {
  cardTextFieldsFromBody,
  normalizeCardServices,
  sanitizeSocialLinksInput,
} from "@/lib/business-card";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { searchParams } = new URL(request.url);
  const cardId = searchParams.get("id");

  if (cardId) {
    const businessCard = await prisma.businessCard.findFirst({
      where: { id: cardId, userId },
      include: { contactMessenger: true },
    });

    if (!businessCard) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ businessCard });
  }

  const businessCards = await prisma.businessCard.findMany({
    where: { userId },
    include: { contactMessenger: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ businessCards });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = (await request.json()) as Record<string, unknown>;
  const { fullName, theme, accentColor, contactEnabled, contactMessengerId, establishmentId, linkAsPrimary } =
    body as {
      fullName?: string;
      theme?: string;
      accentColor?: string;
      contactEnabled?: boolean;
      contactMessengerId?: string | null;
      establishmentId?: string | null;
      linkAsPrimary?: boolean;
    };

  if (contactMessengerId) {
    const messenger = await prisma.messengerContact.findFirst({
      where: { id: contactMessengerId, userId },
    });
    if (!messenger) {
      return NextResponse.json({ error: "Контакт не найден" }, { status: 400 });
    }
  }

  if (typeof fullName !== "string" || !fullName.trim()) {
    return NextResponse.json({ error: "Имя обязательно" }, { status: 400 });
  }

  const businessCard = await prisma.businessCard.create({
    data: {
      user: { connect: { id: userId } },
      fullName: fullName.trim().slice(0, 200),
      ...cardTextFieldsFromBody(body),
      socialLinks: sanitizeSocialLinksInput(body.socialLinks),
      services: normalizeCardServices(body.services),
      theme: theme || "minimal",
      accentColor: accentColor || "#4f46e5",
      contactEnabled: contactEnabled ?? false,
      ...(contactMessengerId ? { contactMessenger: { connect: { id: contactMessengerId } } } : {}),
      estId: establishmentId || null,
    },
    include: { contactMessenger: true },
  });

  if (establishmentId && linkAsPrimary !== false) {
    const est = await prisma.establishment.findFirst({
      where: { id: establishmentId, ...establishmentAccessWhere(userId) },
    });
    if (est) {
      await prisma.establishment.update({
        where: { id: establishmentId },
        data: { businessCard: { connect: { id: businessCard.id } } },
      });
    }
  }

  return NextResponse.json({ businessCard });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = (await request.json()) as Record<string, unknown>;
  const { id, fullName, theme, accentColor, contactEnabled, contactMessengerId } = body as {
    id?: string;
    fullName?: string;
    theme?: string;
    accentColor?: string;
    contactEnabled?: boolean;
    contactMessengerId?: string | null;
  };

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }
  if (fullName !== undefined && (typeof fullName !== "string" || !fullName.trim())) {
    return NextResponse.json({ error: "Имя обязательно" }, { status: 400 });
  }

  const existing = await prisma.businessCard.findFirst({
    where: {
      id,
      OR: [
        { userId },
        { establishment: establishmentAccessWhere(userId) },
        { estId: { not: null } },
      ],
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.estId && existing.userId !== userId) {
    const est = await prisma.establishment.findFirst({
      where: { id: existing.estId, ...establishmentAccessWhere(userId) },
    });
    if (!est) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  if (contactMessengerId) {
    const messenger = await prisma.messengerContact.findFirst({
      where: { id: contactMessengerId, userId },
    });
    if (!messenger) {
      return NextResponse.json({ error: "Контакт не найден" }, { status: 400 });
    }
  }

  const businessCard = await prisma.businessCard.update({
    where: { id },
    data: {
      ...(fullName !== undefined && { fullName: fullName.trim().slice(0, 200) }),
      ...cardTextFieldsFromBody(body),
      ...(body.socialLinks !== undefined && { socialLinks: sanitizeSocialLinksInput(body.socialLinks) }),
      ...(body.services !== undefined && { services: normalizeCardServices(body.services) }),
      ...(theme !== undefined && { theme }),
      ...(accentColor !== undefined && { accentColor }),
      ...(contactEnabled !== undefined && { contactEnabled }),
      ...(contactMessengerId !== undefined && {
        contactMessenger: contactMessengerId
          ? { connect: { id: contactMessengerId } }
          : { disconnect: true },
      }),
    },
    include: { contactMessenger: true },
  });

  logUserEvent(userId, "dash.card_saved", {
    cardId: businessCard.id,
    services: Array.isArray(businessCard.services) ? businessCard.services.length : 0,
    avatar: Boolean(businessCard.avatarUrl),
    telegram: Boolean(businessCard.telegram),
    whatsapp: Boolean(businessCard.whatsapp),
    contactForm: businessCard.contactEnabled,
  });

  return NextResponse.json({ businessCard });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const card = await prisma.businessCard.findFirst({
    where: { id, userId },
  });

  if (!card) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.businessCard.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
