import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type MenuItemInput = {
  name: string;
  description?: string | null;
  price?: string | null;
  weight?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  hidden?: boolean;
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();
  const { title, description, items, establishmentId } = body;

  if (establishmentId) {
    const est = await prisma.establishment.findFirst({
      where: { id: establishmentId, userId },
    });
    if (!est) {
      return NextResponse.json({ error: "Establishment not found" }, { status: 404 });
    }
  }

  const menu = await prisma.qRMenu.create({
    data: {
      title: title?.trim() || null,
      description: description?.trim() || null,
      items: {
        create: (items || []).map((item: MenuItemInput, index: number) => ({
          name: item.name.trim(),
          description: item.description?.trim() || null,
          price: item.price?.trim() || null,
          weight: item.weight?.trim() || null,
          category: item.category?.trim() || null,
          imageUrl: item.imageUrl?.trim() || null,
          order: index,
          hidden: item.hidden || false,
        })),
      },
    },
    include: { items: true },
  });

  if (establishmentId) {
    await prisma.establishment.update({
      where: { id: establishmentId },
      data: { menu: { connect: { id: menu.id } } },
    });
  }

  return NextResponse.json({ menu });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();
  const { id, title, description, items } = body;

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const existing = await prisma.qRMenu.findFirst({
    where: {
      id,
      OR: [
        { qrcodes: { some: { establishment: { userId } } } },
        { establishment: { userId } },
      ],
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // To update items, we'll delete the existing ones and recreate them to simplify reordering and updates
  await prisma.qRMenuItem.deleteMany({
    where: { menuId: id },
  });

  const menu = await prisma.qRMenu.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title?.trim() || null }),
      ...(description !== undefined && { description: description?.trim() || null }),
      items: {
        create: (items || []).map((item: MenuItemInput, index: number) => ({
          name: item.name.trim(),
          description: item.description?.trim() || null,
          price: item.price?.trim() || null,
          weight: item.weight?.trim() || null,
          category: item.category?.trim() || null,
          imageUrl: item.imageUrl?.trim() || null,
          order: index,
          hidden: item.hidden || false,
        })),
      },
    },
    include: { items: true },
  });

  return NextResponse.json({ menu });
}
