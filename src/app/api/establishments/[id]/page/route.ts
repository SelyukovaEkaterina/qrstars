import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { invalidateEstablishmentCache } from "@/lib/cache";
import { pageModulesToJson, parsePageModules, parseModuleOrder, parseModuleLabels, moduleLabelsToJson, parseModuleIcons, moduleIconsToJson, parseModuleTypes, moduleTypesToJson } from "@/lib/page-modules";
import { parseReviewRouting } from "@/lib/review-routing";
import {
  DEFAULT_LANDING_SUBTITLE,
  DEFAULT_BRAND_COLOR,
  DEFAULT_PAGE_APPEARANCE,
  normalizeBrandColor,
  ensureReadableBrandColor,
  parsePageAppearance,
  resolveBrandSettings,
} from "@/lib/brand-theme";
import {
  establishmentAccessWhere,
  establishmentHasPaidFeatures,
} from "@/lib/establishment-access";
import { sanitizeMenuForClient } from "@/lib/iiko/sanitize-menu";

type RouteContext = { params: Promise<{ id: string }> };

async function getAccessibleEstablishment(userId: string, establishmentId: string) {
  return prisma.establishment.findFirst({
    where: { id: establishmentId, ...establishmentAccessWhere(userId) },
    include: {
      menu: {
        include: {
          items: { orderBy: { order: "asc" } },
        },
      },
      businessCard: { include: { contactMessenger: true } },
      wifiConfig: true,
      customPages: { orderBy: { createdAt: "asc" }, include: { fileAsset: true } },
      forms: { include: { fields: { orderBy: { order: "asc" } } }, orderBy: { createdAt: "asc" } },
      tipsEmployees: { orderBy: { order: "asc" } },
    },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { id } = await context.params;

  const establishment = await getAccessibleEstablishment(userId, id);
  if (!establishment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isPro = await establishmentHasPaidFeatures(id);

  const brand = resolveBrandSettings(establishment);
  const moduleTypes = parseModuleTypes(establishment.moduleTypes);

  const extraMenuIds: string[] = [];
  const extraBcIds: string[] = [];
  const extraWifiIds: string[] = [];
  const extraFormIds: string[] = [];
  for (const info of Object.values(moduleTypes)) {
    if (info.type === "menu") extraMenuIds.push(info.instanceId);
    else if (info.type === "businessCard") extraBcIds.push(info.instanceId);
    else if (info.type === "wifi") extraWifiIds.push(info.instanceId);
    else if (info.type === "form") extraFormIds.push(info.instanceId);
  }

  const [extraMenus, extraBusinessCards, extraWifiConfigs] = await Promise.all([
    extraMenuIds.length > 0
      ? prisma.qRMenu.findMany({
          where: { id: { in: extraMenuIds } },
          include: { items: { orderBy: { order: "asc" } } },
        })
      : [],
    extraBcIds.length > 0
      ? prisma.businessCard.findMany({
          where: { id: { in: extraBcIds } },
          include: { contactMessenger: true },
        })
      : [],
    extraWifiIds.length > 0
      ? prisma.wifiConfig.findMany({
          where: { id: { in: extraWifiIds } },
        })
      : [],
  ]);

  return NextResponse.json({
    establishment: {
      id: establishment.id,
      name: establishment.name,
      yandexMapsUrl: establishment.yandexMapsUrl,
      twoGisUrl: establishment.twoGisUrl,
      avitoUrl: establishment.avitoUrl,
      reviewRouting: parseReviewRouting(establishment.reviewRouting),
      pageModules: parsePageModules(establishment.pageModules),
      moduleOrder: parseModuleOrder(establishment.moduleOrder),
      moduleLabels: parseModuleLabels(establishment.moduleLabels),
      moduleIcons: parseModuleIcons(establishment.moduleIcons),
      moduleTypes,
      brandColor: brand.brandColor,
      pageAppearance: brand.pageAppearance,
      logoUrl: establishment.logoUrl,
      coverUrl: establishment.coverUrl,
      landingSubtitle: establishment.landingSubtitle,
      shortSlug: establishment.shortSlug,
      menu: establishment.menu ? sanitizeMenuForClient(establishment.menu) : null,
      businessCard: establishment.businessCard,
      wifiConfig: establishment.wifiConfig,
      customPages: establishment.customPages,
      landingTipsType: establishment.landingTipsType,
      landingTipsPhone: establishment.landingTipsPhone,
      landingTipsBankName: establishment.landingTipsBankName,
      landingTipsUrl: establishment.landingTipsUrl,
      tipsEmployees: establishment.tipsEmployees,
      extraMenus: extraMenus.map((m) => sanitizeMenuForClient(m)),
      extraBusinessCards,
      extraWifiConfigs,
      forms: establishment.forms,
    },
    isPro,
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { id } = await context.params;
  const body = await request.json();

  const establishment = await getAccessibleEstablishment(userId, id);
  if (!establishment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if (body.pageModules !== undefined) {
    data.pageModules = pageModulesToJson(parsePageModules(body.pageModules));
  }
  if (body.menuId !== undefined) {
    data.menu = body.menuId ? { connect: { id: body.menuId } } : { disconnect: true };
  }
  if (body.businessCardId !== undefined) {
    data.businessCard = body.businessCardId ? { connect: { id: body.businessCardId } } : { disconnect: true };
  }
  if (body.wifiConfigId !== undefined) {
    data.wifiConfig = body.wifiConfigId ? { connect: { id: body.wifiConfigId } } : { disconnect: true };
  }
  if (body.moduleOrder !== undefined) {
    data.moduleOrder = Array.isArray(body.moduleOrder) ? body.moduleOrder : null;
  }
  if (body.moduleLabels !== undefined) {
    data.moduleLabels = moduleLabelsToJson(parseModuleLabels(body.moduleLabels));
  }
  if (body.moduleIcons !== undefined) {
    data.moduleIcons = moduleIconsToJson(parseModuleIcons(body.moduleIcons));
  }
  if (body.moduleTypes !== undefined) {
    data.moduleTypes = moduleTypesToJson(parseModuleTypes(body.moduleTypes));
  }
  if (body.brandColor !== undefined) {
    const raw =
      typeof body.brandColor === "string" ? body.brandColor.trim() : "";
    data.brandColor = raw
      ? ensureReadableBrandColor(normalizeBrandColor(raw) ?? DEFAULT_BRAND_COLOR)
      : DEFAULT_BRAND_COLOR;
  }
  if (body.pageAppearance !== undefined) {
    data.pageAppearance = parsePageAppearance(
      typeof body.pageAppearance === "string" ? body.pageAppearance : null
    );
  }
  if (body.landingTheme !== undefined && body.brandColor === undefined) {
    const legacy = resolveBrandSettings({
      landingTheme: body.landingTheme || null,
    });
    data.brandColor = legacy.brandColor;
    data.pageAppearance = legacy.pageAppearance;
  }
  if (body.logoUrl !== undefined) {
    data.logoUrl = body.logoUrl || null;
  }
  if (body.coverUrl !== undefined) {
    data.coverUrl = body.coverUrl || null;
  }
  if (body.landingSubtitle !== undefined) {
    const raw = typeof body.landingSubtitle === "string" ? body.landingSubtitle.trim() : "";
    data.landingSubtitle =
      raw && raw !== DEFAULT_LANDING_SUBTITLE ? raw.slice(0, 120) : null;
  }
  if (body.shortSlug !== undefined) {
    const raw = typeof body.shortSlug === "string" ? body.shortSlug.trim().toLowerCase() : "";
    if (raw === "") {
      data.shortSlug = null;
    } else if (/^[a-z0-9][a-z0-9_-]{0,31}$/.test(raw)) {
      const conflict = await prisma.establishment.findFirst({
        where: { shortSlug: raw, NOT: { id } },
      });
      if (conflict) {
        return NextResponse.json({ error: "Этот короткий адрес уже занят" }, { status: 409 });
      }
      data.shortSlug = raw;
    } else {
      return NextResponse.json({ error: "Короткий адрес: только строчные латинские буквы, цифры, дефис и подчёркивание, от 2 до 32 символов" }, { status: 400 });
    }
  }
  if (body.landingTipsType !== undefined) data.landingTipsType = body.landingTipsType || null;
  if (body.landingTipsPhone !== undefined) data.landingTipsPhone = body.landingTipsPhone || null;
  if (body.landingTipsBankName !== undefined) data.landingTipsBankName = body.landingTipsBankName || null;
  if (body.landingTipsUrl !== undefined) data.landingTipsUrl = body.landingTipsUrl || null;

  const accentToSync =
    typeof data.brandColor === "string" ? data.brandColor : undefined;

  invalidateEstablishmentCache(id).catch(() => {});

  const updated = await prisma.establishment.update({
    where: { id },
    data,
    include: {
      menu: {
        include: {
          items: { orderBy: { order: "asc" } },
        },
      },
      businessCard: { include: { contactMessenger: true } },
      wifiConfig: true,
      customPages: { orderBy: { createdAt: "asc" }, include: { fileAsset: true } },
      forms: { include: { fields: { orderBy: { order: "asc" } } }, orderBy: { createdAt: "asc" } },
      tipsEmployees: { orderBy: { order: "asc" } },
    },
  });

  if (accentToSync && updated.businessCardId) {
    await prisma.businessCard.update({
      where: { id: updated.businessCardId },
      data: { accentColor: accentToSync },
    });
    if (updated.businessCard) {
      updated.businessCard.accentColor = accentToSync;
    }
  }

  const brandUpdated = resolveBrandSettings(updated);
  const moduleTypes = parseModuleTypes(updated.moduleTypes);
  const extraMenuIds = Object.values(moduleTypes).filter(m => m.type === "menu").map(m => m.instanceId);
  const extraBcIds = Object.values(moduleTypes).filter(m => m.type === "businessCard").map(m => m.instanceId);
  const extraWifiIds = Object.values(moduleTypes).filter(m => m.type === "wifi").map(m => m.instanceId);

  const [extraMenus, extraBusinessCards, extraWifiConfigs] = await Promise.all([
    extraMenuIds.length > 0
      ? prisma.qRMenu.findMany({ where: { id: { in: extraMenuIds } }, include: { items: { orderBy: { order: "asc" } } } })
      : [],
    extraBcIds.length > 0
      ? prisma.businessCard.findMany({ where: { id: { in: extraBcIds } }, include: { contactMessenger: true } })
      : [],
    extraWifiIds.length > 0
      ? prisma.wifiConfig.findMany({ where: { id: { in: extraWifiIds } } })
      : [],
  ]);

  return NextResponse.json({
    establishment: {
      id: updated.id,
      name: updated.name,
      pageModules: parsePageModules(updated.pageModules),
      moduleOrder: parseModuleOrder(updated.moduleOrder),
      moduleLabels: parseModuleLabels(updated.moduleLabels),
      moduleIcons: parseModuleIcons(updated.moduleIcons),
      moduleTypes,
      brandColor: brandUpdated.brandColor,
      pageAppearance: brandUpdated.pageAppearance,
      logoUrl: updated.logoUrl,
      coverUrl: updated.coverUrl,
      landingSubtitle: updated.landingSubtitle,
      shortSlug: updated.shortSlug,
      menu: updated.menu,
      businessCard: updated.businessCard,
      wifiConfig: updated.wifiConfig,
      customPages: updated.customPages,
      landingTipsType: updated.landingTipsType,
      landingTipsPhone: updated.landingTipsPhone,
      landingTipsBankName: updated.landingTipsBankName,
      landingTipsUrl: updated.landingTipsUrl,
      tipsEmployees: updated.tipsEmployees,
      extraMenus: extraMenus.map((m) => sanitizeMenuForClient(m)),
      extraBusinessCards,
      extraWifiConfigs,
      forms: updated.forms,
    },
  });
}
