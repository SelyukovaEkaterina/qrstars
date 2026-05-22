import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { pageModulesToJson, parsePageModules, parseModuleOrder, parseModuleLabels, moduleLabelsToJson, parseModuleIcons, moduleIconsToJson } from "@/lib/page-modules";
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

type RouteContext = { params: Promise<{ id: string }> };

async function getOwnedEstablishment(userId: string, establishmentId: string) {
  return prisma.establishment.findFirst({
    where: { id: establishmentId, userId },
    include: {
      menu: {
        include: {
          items: { orderBy: { order: "asc" } },
        },
      },
      businessCard: { include: { contactMessenger: true } },
      wifiConfig: true,
      customPages: { orderBy: { createdAt: "asc" } },
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

  const establishment = await getOwnedEstablishment(userId, id);
  if (!establishment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE", plan: "PRO" },
  });

  const brand = resolveBrandSettings(establishment);

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
      brandColor: brand.brandColor,
      pageAppearance: brand.pageAppearance,
      logoUrl: establishment.logoUrl,
      coverUrl: establishment.coverUrl,
      landingSubtitle: establishment.landingSubtitle,
      menu: establishment.menu,
      businessCard: establishment.businessCard,
      wifiConfig: establishment.wifiConfig,
      customPages: establishment.customPages,
    },
    isPro: !!subscription,
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

  const establishment = await prisma.establishment.findFirst({
    where: { id, userId },
  });
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
  /** @deprecated — конвертируем в brandColor + pageAppearance */
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

  const accentToSync =
    typeof data.brandColor === "string" ? data.brandColor : undefined;

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
      customPages: { orderBy: { createdAt: "asc" } },
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

  return NextResponse.json({
    establishment: {
      id: updated.id,
      name: updated.name,
      pageModules: parsePageModules(updated.pageModules),
      moduleOrder: parseModuleOrder(updated.moduleOrder),
      moduleLabels: parseModuleLabels(updated.moduleLabels),
      moduleIcons: parseModuleIcons(updated.moduleIcons),
      brandColor: brandUpdated.brandColor,
      pageAppearance: brandUpdated.pageAppearance,
      logoUrl: updated.logoUrl,
      coverUrl: updated.coverUrl,
      landingSubtitle: updated.landingSubtitle,
      menu: updated.menu,
      businessCard: updated.businessCard,
      wifiConfig: updated.wifiConfig,
      customPages: updated.customPages,
    },
  });
}
