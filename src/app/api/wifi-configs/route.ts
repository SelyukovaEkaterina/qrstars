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
  const { ssid, password, encryption, hidden } = body;

  if (!ssid?.trim()) {
    return NextResponse.json({ error: "Название сети обязательно" }, { status: 400 });
  }

  const wifiConfig = await prisma.wifiConfig.create({
    data: {
      userId,
      ssid: ssid.trim(),
      password: password?.trim() || null,
      encryption: encryption || "WPA",
      hidden: !!hidden,
    },
  });

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
    where: { id, userId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
