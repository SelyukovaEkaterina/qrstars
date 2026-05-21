import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail } from "@/lib/mailer";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: code } = await params;

  const body = await request.json();
  const {
    qrCodeId,
    establishmentName,
    establishmentId,
    email,
    password,
    ownerName,
    phone,
    yandexMapsUrl,
    twoGisUrl,
  } = body;

  const qrCode = await prisma.qRCode.findFirst({
    where: { code, isActive: false },
  });

  if (!qrCode) {
    return NextResponse.json(
      { error: "QR-код не найден или уже активирован" },
      { status: 404 }
    );
  }

  if (establishmentId) {
    const existingEst = await prisma.establishment.findUnique({
      where: { id: establishmentId },
    });

    if (!existingEst) {
      return NextResponse.json(
        { error: "Заведение не найдено" },
        { status: 404 }
      );
    }

    await prisma.qRCode.update({
      where: { id: qrCodeId || qrCode.id },
      data: {
        isActive: true,
        establishmentId: existingEst.id,
        userId: existingEst.userId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "QR-код привязан к заведению!",
      establishmentId: existingEst.id,
    });
  }

  if (!establishmentName || !email || !yandexMapsUrl) {
    return NextResponse.json(
      { error: "Заполните все обязательные поля" },
      { status: 400 }
    );
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });

  let user;
  if (existingUser) {
    user = existingUser;
  } else {
    if (!password) {
      return NextResponse.json(
        { error: "Пароль обязателен для нового аккаунта" },
        { status: 400 }
      );
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    user = await prisma.user.create({
      data: {
        email,
        name: ownerName,
        phone: phone || null,
        hashedPassword,
      },
    });
  }

  const establishment = await prisma.establishment.create({
    data: {
      name: establishmentName,
      yandexMapsUrl,
      twoGisUrl: twoGisUrl || null,
      phone: phone || null,
      userId: user.id,
    },
  });

  await prisma.qRCode.update({
    where: { id: qrCodeId || qrCode.id },
    data: {
      isActive: true,
      establishmentId: establishment.id,
      userId: user.id,
    },
  });

  if (!existingUser) {
    await sendWelcomeEmail(email, password, establishmentName);
  }

  return NextResponse.json({
    success: true,
    message: "Табличка активирована!",
    establishmentId: establishment.id,
  });
}
