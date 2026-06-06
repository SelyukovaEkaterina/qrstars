import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isBuiltInQrStyleTemplateId } from "@/lib/qr-code-templates";
import {
  isBuiltInStickerTemplateId,
  resolveStickerTemplate,
} from "@/lib/builtin-sticker-templates";
import { ensureStickerPresets } from "@/lib/ensure-sticker-presets";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (isBuiltInStickerTemplateId(id)) {
    await ensureStickerPresets();
    const resolved = resolveStickerTemplate(id);
    if (!resolved) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      template: {
        id: resolved.id,
        name: resolved.name,
        description: null,
        width: resolved.layout.width,
        height: resolved.layout.height,
        layout: resolved.layout,
        isPublic: true,
        readOnly: true,
      },
    });
  }

  const template = await prisma.template.findFirst({
    where: {
      id,
      OR: [
        { userId: (session.user as Record<string, unknown>).id as string },
        { isPublic: true },
      ],
    },
  });

  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ template });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { id } = await params;

  if (isBuiltInStickerTemplateId(id) || isBuiltInQrStyleTemplateId(id)) {
    return NextResponse.json({ error: "Built-in template cannot be modified" }, { status: 403 });
  }

  const body = await request.json();

  const existing = await prisma.template.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.width !== undefined) data.width = body.width;
  if (body.height !== undefined) data.height = body.height;
  if (body.layout !== undefined) data.layout = body.layout;
  if (body.isPublic !== undefined) data.isPublic = body.isPublic;

  const template = await prisma.template.update({
    where: { id },
    data,
  });

  return NextResponse.json({ template });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { id } = await params;

  if (isBuiltInStickerTemplateId(id) || isBuiltInQrStyleTemplateId(id)) {
    return NextResponse.json({ error: "Built-in template cannot be deleted" }, { status: 403 });
  }

  const existing = await prisma.template.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.template.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
