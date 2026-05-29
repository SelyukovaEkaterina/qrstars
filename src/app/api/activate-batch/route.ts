import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail } from "@/lib/mailer";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const masterCode = searchParams.get("masterCode");

  if (!masterCode) {
    return NextResponse.json({ error: "masterCode is required" }, { status: 400 });
  }

  const batch = await prisma.activationBatch.findUnique({
    where: { masterCode },
    include: {
      qrcodes: {
        select: { id: true, code: true, serialCode: true, label: true },
        orderBy: { serialCode: "asc" },
      },
    },
  });

  if (!batch) {
    return NextResponse.json({ error: "Набор не найден" }, { status: 404 });
  }

  return NextResponse.json({
    id: batch.id,
    masterCode: batch.masterCode,
    status: batch.status,
    label: batch.label,
    qty: batch.qty,
    activatedAt: batch.activatedAt,
    tablets: batch.qrcodes,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const body = await request.json();
  const {
    masterCode,
    establishmentId,
    establishmentName,
    email,
    password,
    ownerName,
    phone,
    yandexMapsUrl,
    twoGisUrl,
  } = body;

  if (!masterCode) {
    return NextResponse.json({ error: "Укажите мастер-код" }, { status: 400 });
  }

  const batch = await prisma.activationBatch.findUnique({
    where: { masterCode },
    include: { qrcodes: true },
  });

  if (!batch) {
    return NextResponse.json({ error: "Набор не найден. Проверьте мастер-код." }, { status: 404 });
  }

  if (batch.status === "ACTIVATED") {
    return NextResponse.json({ error: "Этот набор уже активирован" }, { status: 400 });
  }

  if (establishmentId) {
    const existingEst = await prisma.establishment.findUnique({
      where: { id: establishmentId },
    });
    if (!existingEst) {
      return NextResponse.json({ error: "Заведение не найдено" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.qRCode.updateMany({
        where: { batchId: batch.id },
        data: {
          isActive: true,
          establishmentId: existingEst.id,
          userId: existingEst.userId,
        },
      });

      await tx.activationBatch.update({
        where: { id: batch.id },
        data: {
          status: "ACTIVATED",
          activatedAt: new Date(),
          userId: existingEst.userId,
          establishmentId: existingEst.id,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Набор активирован!",
      establishmentId: existingEst.id,
      tabletCount: batch.qrcodes.length,
    });
  }

  if (!establishmentName) {
    return NextResponse.json({ error: "Заполните все обязательные поля" }, { status: 400 });
  }

  let user;
  let isNewUser = false;

  if (session?.user?.email) {
    user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }
  } else {
    if (!email) {
      return NextResponse.json({ error: "Заполните все обязательные поля" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      user = existingUser;
    } else {
      if (!password) {
        return NextResponse.json({ error: "Пароль обязателен для нового аккаунта" }, { status: 400 });
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

  await prisma.$transaction(async (tx) => {
    await tx.qRCode.updateMany({
      where: { batchId: batch.id },
      data: {
        isActive: true,
        establishmentId: establishment.id,
        userId: user!.id,
      },
    });

    await tx.activationBatch.update({
      where: { id: batch.id },
      data: {
        status: "ACTIVATED",
        activatedAt: new Date(),
        userId: user!.id,
        establishmentId: establishment.id,
      },
    });
  });

  if (isNewUser) {
    await sendWelcomeEmail(email, password, establishmentName);
  }

  return NextResponse.json({
    success: true,
    message: "Набор активирован!",
    establishmentId: establishment.id,
    tabletCount: batch.qrcodes.length,
  });
}
