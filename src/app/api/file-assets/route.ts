import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { deleteObject } from "@/lib/s3";

async function getOwnedFileAsset(id: string, userId: string) {
  return prisma.fileAsset.findFirst({
    where: {
      id,
      OR: [
        { userId },
        { qrcodes: { some: { establishment: { userId } } } },
      ],
    },
    include: { qrcodes: { select: { id: true } } },
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const fileAssets = await prisma.fileAsset.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ fileAssets });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();
  const { id, title } = body;

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const existing = await getOwnedFileAsset(id, userId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fileAsset = await prisma.fileAsset.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title?.trim() || null }),
    },
  });

  return NextResponse.json({ fileAsset });
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

  const existing = await getOwnedFileAsset(id, userId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.qRCode.updateMany({
    where: { fileAssetId: id },
    data: { fileAssetId: null },
  });

  try {
    await deleteObject(existing.fileKey);
  } catch (e) {
    console.error("S3 delete error:", e);
  }

  await prisma.fileAsset.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
