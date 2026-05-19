import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

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
  const body = await request.json();
  const {
    fullName,
    title,
    company,
    phone,
    email,
    website,
    address,
    about,
    avatarUrl,
    socialLinks,
    theme,
    accentColor,
    contactEnabled,
    contactMessengerId,
  } = body;

  if (contactMessengerId) {
    const messenger = await prisma.messengerContact.findFirst({
      where: { id: contactMessengerId, userId },
    });
    if (!messenger) {
      return NextResponse.json({ error: "Контакт не найден" }, { status: 400 });
    }
  }

  if (!fullName?.trim()) {
    return NextResponse.json({ error: "Имя обязательно" }, { status: 400 });
  }

  const businessCard = await prisma.businessCard.create({
    data: {
      userId,
      fullName: fullName.trim(),
      title: title?.trim() || null,
      company: company?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      website: website?.trim() || null,
      address: address?.trim() || null,
      about: about?.trim() || null,
      avatarUrl: avatarUrl?.trim() || null,
      socialLinks: socialLinks || [],
      theme: theme || "minimal",
      accentColor: accentColor || "#4f46e5",
      contactEnabled: contactEnabled ?? false,
      contactMessengerId: contactMessengerId || null,
    },
    include: { contactMessenger: true },
  });

  return NextResponse.json({ businessCard });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();
  const {
    id,
    fullName,
    title,
    company,
    phone,
    email,
    website,
    address,
    about,
    avatarUrl,
    socialLinks,
    theme,
    accentColor,
    contactEnabled,
    contactMessengerId,
  } = body;

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const existing = await prisma.businessCard.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
      ...(fullName !== undefined && { fullName: fullName.trim() }),
      ...(title !== undefined && { title: title?.trim() || null }),
      ...(company !== undefined && { company: company?.trim() || null }),
      ...(phone !== undefined && { phone: phone?.trim() || null }),
      ...(email !== undefined && { email: email?.trim() || null }),
      ...(website !== undefined && { website: website?.trim() || null }),
      ...(address !== undefined && { address: address?.trim() || null }),
      ...(about !== undefined && { about: about?.trim() || null }),
      ...(avatarUrl !== undefined && { avatarUrl: avatarUrl?.trim() || null }),
      ...(socialLinks !== undefined && { socialLinks }),
      ...(theme !== undefined && { theme }),
      ...(accentColor !== undefined && { accentColor }),
      ...(contactEnabled !== undefined && { contactEnabled }),
      ...(contactMessengerId !== undefined && {
        contactMessengerId: contactMessengerId || null,
      }),
    },
    include: { contactMessenger: true },
  });

  return NextResponse.json({ businessCard });
}
