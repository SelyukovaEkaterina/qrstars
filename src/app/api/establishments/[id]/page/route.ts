import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { pageModulesToJson, parsePageModules, parseModuleOrder, parseModuleLabels, moduleLabelsToJson } from "@/lib/page-modules";
import { parseReviewRouting } from "@/lib/review-routing";

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
      landingTheme: establishment.landingTheme,
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
    data.menuId = body.menuId || null;
  }
  if (body.businessCardId !== undefined) {
    data.businessCardId = body.businessCardId || null;
  }
  if (body.wifiConfigId !== undefined) {
    data.wifiConfigId = body.wifiConfigId || null;
  }
  if (body.moduleOrder !== undefined) {
    data.moduleOrder = Array.isArray(body.moduleOrder) ? body.moduleOrder : null;
  }
  if (body.moduleLabels !== undefined) {
    data.moduleLabels = moduleLabelsToJson(parseModuleLabels(body.moduleLabels));
  }
  if (body.landingTheme !== undefined) {
    data.landingTheme = body.landingTheme || null;
  }

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

  return NextResponse.json({
    establishment: {
      id: updated.id,
      name: updated.name,
      pageModules: parsePageModules(updated.pageModules),
      moduleOrder: parseModuleOrder(updated.moduleOrder),
      moduleLabels: parseModuleLabels(updated.moduleLabels),
      landingTheme: updated.landingTheme,
      menu: updated.menu,
      businessCard: updated.businessCard,
      wifiConfig: updated.wifiConfig,
      customPages: updated.customPages,
    },
  });
}
