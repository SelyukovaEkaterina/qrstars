import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  establishmentAccessWhere,
  getEstablishmentAccess,
} from "@/lib/establishment-access";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const wifiConfigs = await prisma.wifiConfig.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ wifiConfigs });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();
  const { ssid, password, encryption, hidden, establishmentId, linkAsPrimary } = body;

  if (!ssid?.trim()) {
    return NextResponse.json({ error: "Название сети обязательно" }, { status: 400 });
  }

  const wifiConfig = await prisma.wifiConfig.create({
    data: {
      user: { connect: { id: userId } },
      ssid: ssid.trim(),
      password: password?.trim() || null,
      encryption: encryption || "WPA",
      hidden: !!hidden,
      estId: establishmentId || null,
    },
  });

  if (establishmentId && linkAsPrimary !== false) {
    const est = await prisma.establishment.findFirst({
      where: { id: establishmentId, ...establishmentAccessWhere(userId) },
    });
    if (est) {
      await prisma.establishment.update({
        where: { id: establishmentId },
        data: { wifiConfig: { connect: { id: wifiConfig.id } } },
      });
    }
  }

  return NextResponse.json({ wifiConfig });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();
  const { id, ssid, password, encryption, hidden } = body;

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const existing = await prisma.wifiConfig.findFirst({
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

  const wifiConfig = await prisma.wifiConfig.update({
    where: { id },
    data: {
      ...(ssid !== undefined && { ssid: ssid.trim() }),
      ...(password !== undefined && { password: password?.trim() || null }),
      ...(encryption !== undefined && { encryption }),
      ...(hidden !== undefined && { hidden }),
    },
  });

  return NextResponse.json({ wifiConfig });
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

  const config = await prisma.wifiConfig.findFirst({ where: { id } });
  if (!config) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const canDelete =
    config.userId === userId ||
    (config.estId && (await getEstablishmentAccess(userId, config.estId))) ||
    !!(await prisma.establishment.findFirst({
      where: { wifiConfigId: id, ...establishmentAccessWhere(userId) },
    }));

  if (!canDelete) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.wifiConfig.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
