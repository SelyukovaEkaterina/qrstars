import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadLogo } from "@/lib/s3";
import prisma from "@/lib/prisma";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_SIZE = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE", plan: "PRO" },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    return NextResponse.json(
      { error: "Загрузка логотипа доступна только на PRO-тарифе" },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const qrId = formData.get("qrId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Допустимы форматы PNG, JPEG, WebP, SVG" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Максимальный размер файла — 2 МБ" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop() || "png";
  const key = `logos/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const logoUrl = await uploadLogo(key, buffer, file.type);

  if (qrId) {
    const qr = await prisma.qRCode.findFirst({
      where: {
        id: qrId,
        userId,
      },
    });

    if (qr) {
      await prisma.qRCode.update({
        where: { id: qrId },
        data: { centerLogoUrl: logoUrl, centerText: null },
      });
    }
  }

  return NextResponse.json({ logoUrl });
}
