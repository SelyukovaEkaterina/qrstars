import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { invalidateScanCache } from "@/lib/cache";
import { sendWelcomeEmail } from "@/lib/mailer";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureDefaultEmailContact } from "@/lib/owner-messenger-notify";
import { isPlatformUrlError, parsePlatformUrlField } from "@/lib/platform-url-input";
import { parseYandexMapsUrlField } from "@/lib/yandex-maps-url";
import {
  canAddEstablishment,
  countUserEstablishments,
  effectivePlan,
  findActiveSubscription,
  getUpgradeHint,
} from "@/lib/subscription-utils";

/**
 * Привязать именно этот неактивированный QR. `qrCodeId` из тела запроса не
 * используем: по нему можно было перепривязать любой чужой QR (id виден в
 * HTML публичной страницы скана). `isActive: false` в условии — защита от гонки.
 */
async function claimQrCode(qrCodeId: string, establishmentId: string, userId: string) {
  const { count } = await prisma.qRCode.updateMany({
    where: { id: qrCodeId, isActive: false },
    data: { isActive: true, establishmentId, userId },
  });
  return count === 1;
}

const ALREADY_ACTIVATED = { error: "QR-код не найден или уже активирован" };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: code } = await params;

  const session = await getServerSession(authOptions);

  const body = await request.json();
  const {
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
      ALREADY_ACTIVATED,
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

    if (!(await claimQrCode(qrCode.id, existingEst.id, existingEst.userId))) {
      return NextResponse.json(ALREADY_ACTIVATED, { status: 404 });
    }

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

  const yandex = parseYandexMapsUrlField(yandexMapsUrl);
  const twoGis = parsePlatformUrlField(twoGisUrl);
  for (const parsed of [yandex, twoGis]) {
    if (isPlatformUrlError(parsed)) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
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
      // Без сессии на существующий email — только с верным паролем, иначе
      // любой мог завести проект в чужом аккаунте (как в activate-batch).
      const passwordOk =
        typeof password === "string" &&
        !!password &&
        !!existingUser.hashedPassword &&
        (await bcrypt.compare(password, existingUser.hashedPassword));
      if (!passwordOk) {
        return NextResponse.json(
          {
            error:
              "Аккаунт с этим email уже есть. Войдите в кабинет и отсканируйте QR ещё раз, чтобы привязать табличку.",
          },
          { status: 401 }
        );
      }
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

  if (!isNewUser) {
    const plan = effectivePlan(await findActiveSubscription(user.id));
    const count = await countUserEstablishments(user.id);
    if (!canAddEstablishment(plan, count)) {
      return NextResponse.json(
        {
          error: getUpgradeHint(plan, count)?.message || "Достигнут лимит проектов на вашем тарифе",
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }
  }

  const establishment = await prisma.establishment.create({
    data: {
      name: establishmentName,
      yandexMapsUrl: (yandex as string | null | undefined) ?? null,
      twoGisUrl: (twoGis as string | null | undefined) ?? null,
      phone: phone || null,
      user: { connect: { id: user.id } },
    },
  });

  if (!(await claimQrCode(qrCode.id, establishment.id, user.id))) {
    // Параллельная активация успела раньше — не оставляем пустой проект.
    await prisma.establishment.delete({ where: { id: establishment.id } }).catch(() => {});
    return NextResponse.json(ALREADY_ACTIVATED, { status: 404 });
  }

  await ensureDefaultEmailContact(user.id, user.email);

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
