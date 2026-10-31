import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateQRCode, parseHttpUrl } from "@/lib/utils";
import { requireDbUserId } from "@/lib/session-user";
import { DEMO_QR_PREFIX } from "@/lib/demo-qrcodes";
import {
  canAddEstablishment,
  effectivePlan,
  findActiveSubscription,
  getUpgradeHint,
  hasPaidFeatures,
} from "@/lib/subscription-utils";
import { LANDING_UPGRADE_ERROR } from "@/lib/qr-mode-access";
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
import {
  industryQrStylePreset,
  parseEstablishmentIndustry,
} from "@/lib/establishment-industry";
import { ensureQrStylePresets } from "@/lib/ensure-qr-style-presets";
import { isGeneratorStyleLayout } from "@/lib/generator-style";
import { qrStylePresetTemplateId } from "@/lib/qr-code-templates";
import { findRedirectUrlProblem } from "@/lib/redirect-url";
import { cardTextFieldsFromBody, phoneDigits } from "@/lib/business-card";
import { ensureDefaultEmailContact } from "@/lib/owner-messenger-notify";
import { normalizeTwoGisUrl, twoGisUrlError } from "@/lib/two-gis-url";

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

export type SetupIntent = "reviews" | "landing" | "redirect" | "menu" | "card";

const CONTACT_PROVIDER_PRIORITY = ["TELEGRAM", "MAX", "EMAIL"] as const;

/**
 * Канал для формы «Оставить заявку» на новой визитке: мессенджер, если подключён,
 * иначе email регистрации — чтобы форма работала сразу, без похода в настройки.
 */
async function pickCardContactMessengerId(userId: string): Promise<string | null> {
  const findBest = async () => {
    const contacts = await prisma.messengerContact.findMany({
      where: { userId },
      select: { id: true, provider: true },
      orderBy: { createdAt: "asc" },
    });
    for (const provider of CONTACT_PROVIDER_PRIORITY) {
      const match = contacts.find((c) => c.provider === provider);
      if (match) return match.id;
    }
    return null;
  };
  const existing = await findBest();
  if (existing) return existing;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user?.email) return null;
  await ensureDefaultEmailContact(userId, user.email);
  return findBest();
}

/**
 * Дизайн, перенесённый из генератора на лендинге, применяется к первому QR пользователя
 * вместо отраслевого пресета. Дальше — обычные пресеты, чтобы не навязывать стиль.
 */
async function findFirstQrGeneratorStyleId(userId: string): Promise<string | null> {
  const hasQr = await prisma.qRCode.findFirst({ where: { userId }, select: { id: true } });
  if (hasQr) return null;
  const templates = await prisma.template.findMany({
    where: { userId },
    select: { id: true, layout: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return templates.find((t) => isGeneratorStyleLayout(t.layout))?.id ?? null;
}

export async function POST(request: Request) {
  const auth = await requireDbUserId();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const userId = auth.userId;
  const body = await request.json();
  const {
    name,
    yandexMapsUrl,
    twoGisUrl,
    phone,
    legalName,
    inn,
    redirectUrl,
    qrLabel: rawQrLabel,
    industry: rawIndustry,
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
    qrLabel?: string;
    industry?: string;
    intent?: string;
    establishmentId?: string;
    profession?: string;
    whatsapp?: string;
    telegram?: string;
    serviceArea?: string;
  };

  const establishmentId = rawEstablishmentId?.trim() || undefined;

  const intent: SetupIntent =
    rawIntent === "redirect"
      ? "redirect"
      : rawIntent === "landing"
        ? "landing"
        : rawIntent === "menu"
          ? "menu"
          : rawIntent === "card"
            ? "card"
            : "reviews";
  const trimmedName = name?.trim();
  const yandexResolved = resolveYandexMapsUrl(yandexMapsUrl);
  const trimmedYandex = yandexResolved.normalized;
  // Для отзывов на FREE достаточно одной площадки: Яндекс.Карты или 2GIS.
  const rawTwoGis = twoGisUrl?.trim() || "";
  const normalizedTwoGis = rawTwoGis ? normalizeTwoGisUrl(rawTwoGis) : null;
  const trimmedRedirect = redirectUrl?.trim();
  const trimmedQrLabel = rawQrLabel?.trim();
  const trimmedLegalName = legalName?.trim() || null;
  const trimmedInn = inn?.trim() || null;
  const industry = parseEstablishmentIndustry(rawIndustry);
  if (rawIndustry !== undefined && !industry) {
    return NextResponse.json({ error: "Некорректная отрасль" }, { status: 400 });
  }
  const qrStyleTemplateId =
    (await findFirstQrGeneratorStyleId(userId)) ??
    qrStylePresetTemplateId(industryQrStylePreset(industry));
  const qualifiedOnboarding = true;

  if (intent === "redirect") {
    if (!trimmedRedirect) {
      return NextResponse.json({ error: "Укажите ссылку для перенаправления" }, { status: 400 });
    }
    if (!parseHttpUrl(trimmedRedirect)) {
      return NextResponse.json({ error: "Некорректная ссылка для перенаправления" }, { status: 400 });
    }
    const redirectProblem = findRedirectUrlProblem(trimmedRedirect);
    if (redirectProblem) {
      return NextResponse.json({ error: redirectProblem }, { status: 400 });
    }
  }

  if (!establishmentId && !trimmedName) {
    return NextResponse.json(
      { error: intent === "card" ? "Укажите имя" : "Укажите название проекта" },
      { status: 400 }
    );
  }

  // Поля визитки (intent=card): имя → fullName, профессия → title.
  const cardFields = cardTextFieldsFromBody({
    title: body.profession,
    phone,
    whatsapp: body.whatsapp,
    telegram: body.telegram,
    serviceArea: body.serviceArea,
  });
  if (intent === "card" && phoneDigits(cardFields.phone).length < 10) {
    return NextResponse.json(
      { error: "Укажите телефон — по нему клиенты будут звонить" },
      { status: 400 }
    );
  }

  if (rawTwoGis && !normalizedTwoGis && intent !== "landing") {
    return NextResponse.json({ error: twoGisUrlError(rawTwoGis) }, { status: 400 });
  }

  if (intent === "reviews" && !establishmentId) {
    if (!trimmedYandex && !normalizedTwoGis) {
      const error =
        yandexResolved.error ||
        "Укажите ссылку на Яндекс.Карты или 2GIS — по ней гости с оценкой 4–5★ перейдут оставить отзыв";
      return NextResponse.json({ error }, { status: 400 });
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
          : intent === "card"
            ? "BUSINESS_CARD"
            : "LANDING";
  const qrLabel =
    trimmedQrLabel ||
    (intent === "reviews"
      ? "Отзывы"
      : intent === "redirect"
        ? "Редирект"
        : intent === "menu"
          ? "Меню"
          : intent === "card"
            ? "Визитка"
            : "Основной");

  const ownedCount = await prisma.establishment.count({ where: { userId } });
  const subscription = await findActiveSubscription(userId);
  const plan = effectivePlan(subscription);

  if (intent === "landing" && !hasPaidFeatures(plan)) {
    return NextResponse.json(
      {
        error: LANDING_UPGRADE_ERROR,
        upgradeRequired: "PRO",
      },
      { status: 403 }
    );
  }

  if (establishmentId) {
    const access = await requireEstablishmentAccess(userId, establishmentId);
    if (!access.ok) {
      return NextResponse.json({ error: "Заведение не найдено" }, { status: 404 });
    }
  } else if (!canAddEstablishment(plan, ownedCount)) {
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

  await ensureQrStylePresets();

  const cardContactMessengerId =
    intent === "card" ? await pickCardContactMessengerId(userId) : null;
  const cardCreateData = (fullName: string) => ({
    user: { connect: { id: userId } },
    fullName: fullName.slice(0, 200),
    ...cardFields,
    contactEnabled: !!cardContactMessengerId,
    ...(cardContactMessengerId
      ? { contactMessenger: { connect: { id: cardContactMessengerId } } }
      : {}),
  });

  if (establishmentId) {
    const establishment = await prisma.establishment.findUnique({
      where: { id: establishmentId },
      select: {
        id: true,
        name: true,
        yandexMapsUrl: true,
        twoGisUrl: true,
        businessCardId: true,
      },
    });
    if (!establishment) {
      return NextResponse.json({ error: "Заведение не найдено" }, { status: 404 });
    }

    const effectiveYandex =
      trimmedYandex ||
      normalizeYandexMapsUrl(establishment.yandexMapsUrl?.trim() || "") ||
      null;
    const effectiveTwoGis = normalizedTwoGis || establishment.twoGisUrl?.trim() || null;
    if (intent === "reviews") {
      if (!effectiveYandex && !effectiveTwoGis) {
        const error =
          yandexResolved.error ||
          "Укажите ссылку на Яндекс.Карты или 2GIS — по ней гости с оценкой 4–5★ перейдут оставить отзыв";
        return NextResponse.json({ error }, { status: 400 });
      }
    }

    const qrcode = await prisma.$transaction(async (tx) => {
      const establishmentUpdate: {
        yandexMapsUrl?: string;
        twoGisUrl?: string;
        legalName?: string;
        inn?: string;
        industry?: string;
      } = {};
      if (trimmedYandex && trimmedYandex !== establishment.yandexMapsUrl) {
        establishmentUpdate.yandexMapsUrl = trimmedYandex;
      }
      if (normalizedTwoGis && normalizedTwoGis !== establishment.twoGisUrl) {
        establishmentUpdate.twoGisUrl = normalizedTwoGis;
      }
      if (trimmedLegalName) establishmentUpdate.legalName = trimmedLegalName;
      if (trimmedInn) establishmentUpdate.inn = trimmedInn;
      if (industry) establishmentUpdate.industry = industry;
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

      // У проекта уже есть визитка — новый QR ведёт на неё, данные из формы не трогаем.
      let businessCardId: string | undefined;
      if (intent === "card") {
        businessCardId = establishment.businessCardId ?? undefined;
        if (!businessCardId) {
          const card = await tx.businessCard.create({
            data: { ...cardCreateData(trimmedName || establishment.name), estId: establishmentId },
          });
          businessCardId = card.id;
          await tx.establishment.update({
            where: { id: establishmentId },
            data: { businessCard: { connect: { id: card.id } } },
          });
        }
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
          qrStyleTemplate: { connect: { id: qrStyleTemplateId } },
          ...(intent === "redirect" ? { redirectUrl: trimmedRedirect } : {}),
          ...(menuId ? { menu: { connect: { id: menuId } } } : {}),
          ...(businessCardId ? { businessCard: { connect: { id: businessCardId } } } : {}),
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
        label: qrcode.label,
        qrStyleTemplateId,
      },
    });
  }

  const pageModules =
    intent === "landing" && !trimmedYandex ? GUEST_PAGE_MODULES : DEFAULT_PAGE_MODULES;

  const { establishment, qrcode } = await prisma.$transaction(async (tx) => {
    const establishment = await tx.establishment.create({
      data: {
        name: trimmedName!,
        industry,
        phone: phone?.trim() || null,
        yandexMapsUrl: trimmedYandex || null,
        twoGisUrl: normalizedTwoGis || (intent === "landing" ? rawTwoGis || null : null),
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

    let businessCardId: string | undefined;
    if (intent === "card") {
      const card = await tx.businessCard.create({
        data: { ...cardCreateData(trimmedName!), estId: establishment.id },
      });
      businessCardId = card.id;
      await tx.establishment.update({
        where: { id: establishment.id },
        data: { businessCard: { connect: { id: card.id } } },
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
        qrStyleTemplate: { connect: { id: qrStyleTemplateId } },
        ...(intent === "redirect" ? { redirectUrl: trimmedRedirect } : {}),
        ...(menuId ? { menu: { connect: { id: menuId } } } : {}),
        ...(businessCardId ? { businessCard: { connect: { id: businessCardId } } } : {}),
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
        label: qrcode.label,
        qrStyleTemplateId,
      },
    });
  }
