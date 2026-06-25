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
import { requireEstablishmentAccess } from "@/lib/establishment-access";
import {
  DEFAULT_PAGE_MODULES,
  GUEST_PAGE_MODULES,
  pageModulesToJson,
} from "@/lib/page-modules";
import { starterMenuCreateInput } from "@/lib/setup-starter-menu";
import {
  YANDEX_MAPS_INVALID_ERROR,
  normalizeYandexMapsUrl,
  yandexMapsUrlError,
} from "@/lib/yandex-maps-url";

function resolveYandexMapsUrl(raw: string | undefined): {
  normalized: string | null;
  error: string | null;
} {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return { normalized: null, error: null };
  }
  const error = yandexMapsUrlError(trimmed);
  if (error) {
    return { normalized: null, error };
  }
  return { normalized: normalizeYandexMapsUrl(trimmed)!, error: null };
}

export type SetupIntent = "reviews" | "landing" | "redirect" | "menu";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();
  const {
    name,
    yandexMapsUrl,
    twoGisUrl,
    phone,
    legalName,
    inn,
    redirectUrl,
    intent: rawIntent,
    establishmentId: rawEstablishmentId,
  } = body as {
    name?: string;
    yandexMapsUrl?: string;
    twoGisUrl?: string;
    phone?: string;
    legalName?: string;
    inn?: string;
    redirectUrl?: string;
    intent?: string;
    establishmentId?: string;
  };

  const establishmentId = rawEstablishmentId?.trim() || undefined;

  const intent: SetupIntent =
    rawIntent === "redirect"
      ? "redirect"
      : rawIntent === "landing"
        ? "landing"
        : rawIntent === "menu"
          ? "menu"
          : "reviews";
  const trimmedName = name?.trim();
  const yandexResolved = resolveYandexMapsUrl(yandexMapsUrl);
  const trimmedYandex = yandexResolved.normalized;
  const trimmedRedirect = redirectUrl?.trim();
  const trimmedLegalName = legalName?.trim() || null;
  const trimmedInn = inn?.trim() || null;
  const qualifiedOnboarding = intent === "reviews" || intent === "landing" || intent === "menu";

  if (intent === "redirect") {
    if (!trimmedRedirect) {
      return NextResponse.json({ error: "Укажите ссылку для перенаправления" }, { status: 400 });
    }
    try {
      new URL(trimmedRedirect);
    } catch {
      return NextResponse.json({ error: "Некорректная ссылка для перенаправления" }, { status: 400 });
    }
  } else if (!establishmentId) {
    if (!trimmedName) {
      return NextResponse.json({ error: "Укажите название заведения" }, { status: 400 });
    }
  }

  if (intent === "reviews" && !establishmentId) {
    if (!trimmedYandex) {
      const error =
        yandexResolved.error ||
        "Укажите ссылку на Яндекс.Карты — по ней гости с оценкой 5★ перейдут оставить отзыв";
      return NextResponse.json({ error }, { status: 400 });
    }

    if (twoGisUrl?.trim()) {
      try {
        new URL(twoGisUrl.trim());
      } catch {
        return NextResponse.json({ error: "Некорректная ссылка на 2GIS" }, { status: 400 });
      }
    }
  } else if (yandexMapsUrl?.trim()) {
    if (!trimmedYandex) {
      return NextResponse.json(
        { error: yandexResolved.error || YANDEX_MAPS_INVALID_ERROR },
        { status: 400 }
      );
    }
  }

  if (intent === "landing" && twoGisUrl?.trim()) {
    try {
      new URL(twoGisUrl.trim());
    } catch {
      return NextResponse.json({ error: "Некорректная ссылка на 2GIS" }, { status: 400 });
    }
  }

  const qrMode =
    intent === "reviews"
      ? "REVIEW"
      : intent === "redirect"
        ? "REDIRECT"
        : intent === "menu"
          ? "MENU"
          : "LANDING";
  const qrLabel =
    intent === "reviews"
      ? "Отзывы"
      : intent === "redirect"
        ? "Редирект"
        : intent === "menu"
          ? "Меню"
          : "Основной";

  const ownedCount = await prisma.establishment.count({ where: { userId } });
  const subscription = await findActiveSubscription(userId);
  const plan = effectivePlan(subscription);

  if (establishmentId) {
    const access = await requireEstablishmentAccess(userId, establishmentId);
    if (!access.ok) {
      return NextResponse.json({ error: "Заведение не найдено" }, { status: 404 });
    }
  } else if (intent !== "redirect" && !canAddEstablishment(plan, ownedCount)) {
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

  if (intent === "redirect") {
    const qrcode = await prisma.$transaction(async (tx) => {
      const qr = await tx.qRCode.create({
        data: {
          code,
          mode: qrMode,
          label: qrLabel,
          redirectUrl: trimmedRedirect,
          isActive: true,
          source: "DASHBOARD",
          user: { connect: { id: userId } },
          ...(establishmentId
            ? { establishment: { connect: { id: establishmentId } } }
            : {}),
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { onboardingCompleted: false },
      });

      return qr;
    });

    const establishment =
      establishmentId
        ? await prisma.establishment.findUnique({
            where: { id: establishmentId },
            select: { id: true, name: true },
          })
        : null;

    return NextResponse.json({
      intent,
      ...(establishment ? { establishment } : {}),
      qrcode: {
        id: qrcode.id,
        code: qrcode.code,
        mode: qrcode.mode,
      },
    });
  }

  if (establishmentId) {
    const establishment = await prisma.establishment.findUnique({
      where: { id: establishmentId },
      select: {
        id: true,
        name: true,
        yandexMapsUrl: true,
      },
    });
    if (!establishment) {
      return NextResponse.json({ error: "Заведение не найдено" }, { status: 404 });
    }

    const effectiveYandex =
      trimmedYandex ||
      normalizeYandexMapsUrl(establishment.yandexMapsUrl?.trim() || "") ||
      null;
    if (intent === "reviews") {
      if (!effectiveYandex) {
        const error =
          yandexResolved.error ||
          "Укажите ссылку на Яндекс.Карты — по ней гости с оценкой 5★ перейдут оставить отзыв";
        return NextResponse.json({ error }, { status: 400 });
      }
    }

    const qrcode = await prisma.$transaction(async (tx) => {
      const establishmentUpdate: { yandexMapsUrl?: string; legalName?: string; inn?: string } = {};
      if (trimmedYandex && trimmedYandex !== establishment.yandexMapsUrl) {
        establishmentUpdate.yandexMapsUrl = trimmedYandex;
      }
      if (trimmedLegalName) establishmentUpdate.legalName = trimmedLegalName;
      if (trimmedInn) establishmentUpdate.inn = trimmedInn;
      if (Object.keys(establishmentUpdate).length > 0) {
        await tx.establishment.update({
          where: { id: establishmentId },
          data: establishmentUpdate,
        });
      }

      let menuId: string | undefined;
      if (intent === "menu") {
        const menu = await tx.qRMenu.create({
          data: starterMenuCreateInput(establishmentId, establishment.name),
        });
        menuId = menu.id;
        await tx.establishment.update({
          where: { id: establishmentId },
          data: { menu: { connect: { id: menu.id } } },
        });
      }

      const qr = await tx.qRCode.create({
        data: {
          code,
          mode: qrMode,
          label: qrLabel,
          isActive: true,
          source: "DASHBOARD",
          user: { connect: { id: userId } },
          establishment: { connect: { id: establishmentId } },
          ...(menuId ? { menu: { connect: { id: menuId } } } : {}),
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { onboardingCompleted: qualifiedOnboarding },
      });

      return qr;
    });

    return NextResponse.json({
      intent,
      establishment: {
        id: establishment.id,
        name: establishment.name,
      },
      qrcode: {
        id: qrcode.id,
        code: qrcode.code,
        mode: qrcode.mode,
      },
    });
  }

  const pageModules =
    intent === "landing" && !trimmedYandex ? GUEST_PAGE_MODULES : DEFAULT_PAGE_MODULES;

  const { establishment, qrcode } = await prisma.$transaction(async (tx) => {
    const establishment = await tx.establishment.create({
      data: {
        name: trimmedName!,
        phone: phone?.trim() || null,
        yandexMapsUrl: trimmedYandex || null,
        twoGisUrl: twoGisUrl?.trim() || null,
        legalName: trimmedLegalName,
        inn: trimmedInn,
        pageModules: pageModulesToJson(pageModules),
        user: { connect: { id: userId } },
      },
    });

    let menuId: string | undefined;
    if (intent === "menu") {
      const menu = await tx.qRMenu.create({
        data: starterMenuCreateInput(establishment.id, establishment.name),
      });
      menuId = menu.id;
      await tx.establishment.update({
        where: { id: establishment.id },
        data: { menu: { connect: { id: menu.id } } },
      });
    }

    const qrcode = await tx.qRCode.create({
      data: {
        code,
        mode: qrMode,
        label: qrLabel,
        isActive: true,
        source: "DASHBOARD",
        user: { connect: { id: userId } },
        establishment: { connect: { id: establishment.id } },
        ...(menuId ? { menu: { connect: { id: menuId } } } : {}),
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { onboardingCompleted: qualifiedOnboarding },
    });

    return { establishment, qrcode };
  });

  return NextResponse.json({
    intent,
    establishment: {
      id: establishment.id,
      name: establishment.name,
    },
    qrcode: {
      id: qrcode.id,
      code: qrcode.code,
      mode: qrcode.mode,
    },
  });
}
