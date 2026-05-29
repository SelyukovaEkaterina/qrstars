import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { invalidateScanCache } from "@/lib/cache";
import { sendWelcomeEmail } from "@/lib/mailer";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: code } = await params;

  const session = await getServerSession(authOptions);

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
    // Обязательно требуем авторизацию при привязке к существующему заведению
    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо войти в аккаунт" },
        { status: 401 }
      );
    }

    const currentUserId = (session.user as Record<string, unknown>).id as string;

    // Проверяем что заведение принадлежит текущему пользователю
    const existingEst = await prisma.establishment.findFirst({
      where: { id: establishmentId, userId: currentUserId },
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
        establishment: { connect: { id: existingEst.id } },
        user: { connect: { id: existingEst.userId } },
      },
    });

    invalidateScanCache(code).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "QR-код привязан к заведению!",
      establishmentId: existingEst.id,
    });
  }

  if (!establishmentName) {
    return NextResponse.json(
      { error: "Заполните все обязательные поля" },
      { status: 400 }
    );
  }

  let user;
  let isNewUser = false;

  if (session?.user?.email) {
    user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }
  } else {
    if (!email) {
      return NextResponse.json(
        { error: "Заполните все обязательные поля" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

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
      isNewUser = true;
    }
  }

  const establishment = await prisma.establishment.create({
    data: {
      name: establishmentName,
      yandexMapsUrl: yandexMapsUrl || null,
      twoGisUrl: twoGisUrl || null,
      phone: phone || null,
      user: { connect: { id: user.id } },
    },
  });

  await prisma.qRCode.update({
    where: { id: qrCodeId || qrCode.id },
    data: {
      isActive: true,
      establishment: { connect: { id: establishment.id } },
      user: { connect: { id: user.id } },
    },
  });

  if (isNewUser) {
    await sendWelcomeEmail(email, password, establishmentName);
  }

  invalidateScanCache(code).catch(() => {});

  return NextResponse.json({
    success: true,
    message: "Табличка активирована!",
    establishmentId: establishment.id,
  });
}
