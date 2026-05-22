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
  const establishmentId = searchParams.get("establishmentId");

  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId is required" }, { status: 400 });
  }

  const est = await prisma.establishment.findFirst({
    where: { id: establishmentId, userId },
  });
  if (!est) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pages = await prisma.customPage.findMany({
    where: { establishmentId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ customPages: pages });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();
  const { establishmentId, menuItemLabel, title, content, type, url, icon } = body;

  if (!establishmentId || !menuItemLabel || !title) {
    return NextResponse.json(
      { error: "establishmentId, menuItemLabel, title are required" },
      { status: 400 }
    );
  }

  const pageType = type === "LINK" ? "LINK" : "HTML";

  if (pageType === "LINK" && !url) {
    return NextResponse.json(
      { error: "url is required for LINK type" },
      { status: 400 }
    );
  }

  const est = await prisma.establishment.findFirst({
    where: { id: establishmentId, userId },
  });
  if (!est) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const page = await prisma.customPage.create({
    data: {
      establishment: { connect: { id: establishmentId } },
      menuItemLabel: String(menuItemLabel).slice(0, 100),
      title: String(title).slice(0, 200),
      content: typeof content === "string" ? content : "",
      type: pageType,
      url: pageType === "LINK" ? String(url) : null,
      icon: typeof icon === "string" ? icon : null,
    },
  });

  return NextResponse.json({ customPage: page }, { status: 201 });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();
  const { id, menuItemLabel, title, content, enabled, type, url, icon } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const existing = await prisma.customPage.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const est = await prisma.establishment.findFirst({
    where: { id: existing.establishmentId, userId },
  });
  if (!est) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (menuItemLabel !== undefined) data.menuItemLabel = String(menuItemLabel).slice(0, 100);
  if (title !== undefined) data.title = String(title).slice(0, 200);
  if (content !== undefined) data.content = typeof content === "string" ? content : "";
  if (enabled !== undefined) data.enabled = !!enabled;
  if (type !== undefined) {
    const pageType = type === "LINK" ? "LINK" : "HTML";
    data.type = pageType;
    if (pageType === "LINK" && url !== undefined) {
      data.url = String(url);
    } else if (pageType === "HTML") {
      data.url = null;
    }
  }
  if (type === undefined && url !== undefined) {
    data.url = url ? String(url) : null;
  }
  if (icon !== undefined) {
    data.icon = typeof icon === "string" && icon.length > 0 ? icon : null;
  }

  const updated = await prisma.customPage.update({
    where: { id },
    data,
  });

  return NextResponse.json({ customPage: updated });
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
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const existing = await prisma.customPage.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const est = await prisma.establishment.findFirst({
    where: { id: existing.establishmentId, userId },
  });
  if (!est) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.customPage.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
