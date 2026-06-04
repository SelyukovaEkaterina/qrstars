import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { establishmentAccessWhere } from "@/lib/establishment-access";

function parsePageType(type: unknown): "HTML" | "LINK" | "FILE" {
  if (type === "LINK") return "LINK";
  if (type === "FILE") return "FILE";
  return "HTML";
}

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
    where: { id: establishmentId, ...establishmentAccessWhere(userId) },
  });
  if (!est) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pages = await prisma.customPage.findMany({
    where: { establishmentId },
    orderBy: { createdAt: "asc" },
    include: { fileAsset: true },
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
  const { establishmentId, menuItemLabel, title, content, type, url, icon, fileAssetId } = body;

  if (!establishmentId || !menuItemLabel) {
    return NextResponse.json(
      { error: "establishmentId and menuItemLabel are required" },
      { status: 400 }
    );
  }

  const pageType = parsePageType(type);

  if (pageType === "LINK" && !url) {
    return NextResponse.json(
      { error: "url is required for LINK type" },
      { status: 400 }
    );
  }

  if (pageType === "FILE" && !fileAssetId) {
    return NextResponse.json(
      { error: "fileAssetId is required for FILE type" },
      { status: 400 }
    );
  }

  if (pageType === "HTML" && !title) {
    return NextResponse.json(
      { error: "title is required for HTML type" },
      { status: 400 }
    );
  }

  const est = await prisma.establishment.findFirst({
    where: { id: establishmentId, ...establishmentAccessWhere(userId) },
  });
  if (!est) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (pageType === "FILE" && fileAssetId) {
    const asset = await prisma.fileAsset.findFirst({
      where: { id: fileAssetId, userId },
    });
    if (!asset) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
  }

  const page = await prisma.customPage.create({
    data: {
      establishment: { connect: { id: establishmentId } },
      menuItemLabel: String(menuItemLabel).slice(0, 100),
      title: String(title || menuItemLabel).slice(0, 200),
      content: pageType === "HTML" && typeof content === "string" ? content : "",
      type: pageType,
      url: pageType === "LINK" ? String(url) : null,
      icon: typeof icon === "string" ? icon : null,
      enabled: false,
      ...(pageType === "FILE" && fileAssetId
        ? { fileAsset: { connect: { id: fileAssetId } } }
        : {}),
    },
    include: { fileAsset: true },
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
  const { id, menuItemLabel, title, content, enabled, type, url, icon, fileAssetId } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const existing = await prisma.customPage.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const est = await prisma.establishment.findFirst({
    where: { id: existing.establishmentId, ...establishmentAccessWhere(userId) },
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
    const pageType = parsePageType(type);
    data.type = pageType;
    if (pageType === "LINK" && url !== undefined) {
      data.url = String(url);
      data.fileAsset = { disconnect: true };
    } else if (pageType === "HTML") {
      data.url = null;
      data.fileAsset = { disconnect: true };
    } else if (pageType === "FILE") {
      data.url = null;
      data.content = "";
    }
  }
  if (type === undefined && url !== undefined) {
    data.url = url ? String(url) : null;
  }
  if (fileAssetId !== undefined) {
    if (fileAssetId) {
      const asset = await prisma.fileAsset.findFirst({
        where: { id: fileAssetId, userId },
      });
      if (!asset) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      data.fileAsset = { connect: { id: fileAssetId } };
    } else {
      data.fileAsset = { disconnect: true };
    }
  }
  if (icon !== undefined) {
    data.icon = typeof icon === "string" && icon.length > 0 ? icon : null;
  }

  const updated = await prisma.customPage.update({
    where: { id },
    data,
    include: { fileAsset: true },
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
    where: { id: existing.establishmentId, ...establishmentAccessWhere(userId) },
  });
  if (!est) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.customPage.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
