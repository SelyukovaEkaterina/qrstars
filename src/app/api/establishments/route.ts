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

  const establishments = await prisma.establishment.findMany({
    where: { userId },
    include: {
      _count: { select: { qrcodes: true, reviews: true } },
      qrcodes: { select: { scansCount: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = establishments.map((e) => ({
    id: e.id,
    name: e.name,
    address: e.address,
    phone: e.phone,
    yandexMapsUrl: e.yandexMapsUrl,
    twoGisUrl: e.twoGisUrl,
    avitoUrl: e.avitoUrl,
    qrcodesCount: e._count.qrcodes,
    reviewsCount: e._count.reviews,
    totalScans: e.qrcodes.reduce((a, q) => a + q.scansCount, 0),
    createdAt: e.createdAt.toISOString(),
  }));

  return NextResponse.json({ establishments: result });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();
  const { name, address, phone, yandexMapsUrl, twoGisUrl, avitoUrl, qrCodeId } = body;

  if (!name || !yandexMapsUrl) {
    return NextResponse.json(
      { error: "Название и ссылка на Яндекс.Карты обязательны" },
      { status: 400 }
    );
  }

  const existingCount = await prisma.establishment.count({ where: { userId } });

  const establishment = await prisma.establishment.create({
    data: {
      name,
      address: address || null,
      phone: phone || null,
      yandexMapsUrl,
      twoGisUrl: twoGisUrl || null,
      avitoUrl: avitoUrl || null,
      userId,
    },
  });

  let linkedQrId: string | null = null;

  if (qrCodeId && existingCount === 0) {
    const qr = await prisma.qRCode.findFirst({
      where: { id: qrCodeId, establishmentId: null, isActive: false, userId },
    });
    if (qr) {
      await prisma.qRCode.update({
        where: { id: qr.id },
        data: {
          establishmentId: establishment.id,
          isActive: true,
        },
      });
      linkedQrId = qr.id;
    }
  }

  return NextResponse.json({ establishment, linkedQrId });
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

  const establishment = await prisma.establishment.findFirst({
    where: { id, userId },
  });

  if (!establishment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.establishment.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
