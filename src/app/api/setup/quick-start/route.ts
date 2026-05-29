import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateQRCode } from "@/lib/utils";
import { DEMO_QR_PREFIX } from "@/lib/demo-qrcodes";
import {
  canAddEstablishment,
  effectivePlan,
  findActiveSubscription,
  getUpgradeHint,
} from "@/lib/subscription-utils";
import { userNeedsSetupGuide } from "@/lib/setup-guide";
import { DEFAULT_PAGE_MODULES, pageModulesToJson } from "@/lib/page-modules";

export type SetupIntent = "reviews" | "landing";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();
  const { name, yandexMapsUrl, twoGisUrl, phone, intent: rawIntent } = body as {
    name?: string;
    yandexMapsUrl?: string;
    twoGisUrl?: string;
    phone?: string;
    intent?: string;
  };

  const intent: SetupIntent = rawIntent === "landing" ? "landing" : "reviews";
  const trimmedName = name?.trim();
  const trimmedYandex = yandexMapsUrl?.trim();

  if (!trimmedName) {
    return NextResponse.json({ error: "Укажите название заведения" }, { status: 400 });
  }

  if (intent === "reviews") {
    if (!trimmedYandex) {
      return NextResponse.json(
        { error: "Укажите ссылку на Яндекс.Карты — по ней гости с оценкой 5★ перейдут оставить отзыв" },
        { status: 400 }
      );
    }

    try {
      new URL(trimmedYandex);
    } catch {
      return NextResponse.json({ error: "Некорректная ссылка на Яндекс.Карты" }, { status: 400 });
    }

    if (twoGisUrl?.trim()) {
      try {
        new URL(twoGisUrl.trim());
      } catch {
        return NextResponse.json({ error: "Некорректная ссылка на 2GIS" }, { status: 400 });
      }
    }
  } else if (trimmedYandex) {
    try {
      new URL(trimmedYandex);
    } catch {
      return NextResponse.json({ error: "Некорректная ссылка на Яндекс.Карты" }, { status: 400 });
    }
  }

  if (intent === "landing" && twoGisUrl?.trim()) {
    try {
      new URL(twoGisUrl.trim());
    } catch {
      return NextResponse.json({ error: "Некорректная ссылка на 2GIS" }, { status: 400 });
    }
  }

  const qrMode = intent === "reviews" ? "REVIEW" : "LANDING";
  const qrLabel = intent === "reviews" ? "Отзывы" : "Основной";

  const needsGuide = await userNeedsSetupGuide(userId);
  const ownedCount = await prisma.establishment.count({ where: { userId } });

  if (!needsGuide && ownedCount > 0) {
    return NextResponse.json(
      { error: "У вас уже есть заведение. Создайте QR в разделе «QR-коды»." },
      { status: 400 }
    );
  }

  const subscription = await findActiveSubscription(userId);
  const plan = effectivePlan(subscription);

  if (!canAddEstablishment(plan, ownedCount)) {
    const hint = getUpgradeHint(plan, ownedCount);
    return NextResponse.json(
      {
        error: hint?.message || "Достигнут лимит заведений на текущем тарифе",
        upgradeRequired: hint?.requiredPlan,
      },
      { status: 403 }
    );
  }

  let code: string | undefined;
  for (let i = 0; i < 10; i++) {
    const candidate = generateQRCode();
    if (candidate.startsWith(DEMO_QR_PREFIX)) continue;
    const exists = await prisma.qRCode.findUnique({ where: { code: candidate } });
    if (!exists) {
      code = candidate;
      break;
    }
  }

  if (!code) {
    return NextResponse.json({ error: "Не удалось сгенерировать QR-код" }, { status: 500 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const establishment = await tx.establishment.create({
      data: {
        name: trimmedName,
        phone: phone?.trim() || null,
        yandexMapsUrl: trimmedYandex || null,
        twoGisUrl: twoGisUrl?.trim() || null,
        pageModules: pageModulesToJson(DEFAULT_PAGE_MODULES),
        user: { connect: { id: userId } },
      },
    });

    const qrcode = await tx.qRCode.create({
      data: {
        code,
        mode: qrMode,
        label: qrLabel,
        isActive: true,
        source: "DASHBOARD",
        user: { connect: { id: userId } },
        establishment: { connect: { id: establishment.id } },
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { onboardingCompleted: false },
    });

    return { establishment, qrcode };
  });

  return NextResponse.json({
    intent,
    establishment: {
      id: result.establishment.id,
      name: result.establishment.name,
    },
    qrcode: {
      id: result.qrcode.id,
      code: result.qrcode.code,
      mode: result.qrcode.mode,
    },
  });
}
