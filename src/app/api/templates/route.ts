import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const templates = await prisma.template.findMany({
    where: {
      OR: [{ userId }, { isPublic: true }],
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();
  const { name, description, width, height, layout, isPublic } = body;

  if (!name || !layout) {
    return NextResponse.json({ error: "Name and layout required" }, { status: 400 });
  }

  const template = await prisma.template.create({
    data: {
      name,
      description: description || null,
      width: width || 210,
      height: height || 148,
      layout,
      isPublic: isPublic || false,
      userId,
    },
  });

  return NextResponse.json({ template });
}
