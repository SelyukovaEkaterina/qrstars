import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { establishmentAccessWhere, establishmentHasPaidFeatures } from "@/lib/establishment-access";
import {
  configFromQrMenu,
  fetchIikoMenuData,
  IikoApiError,
  serializeIikoMenuForClient,
} from "@/lib/iiko";
import { pruneIikoHiddenCategoryIds, parseIikoHiddenCategoryIds } from "@/lib/iiko/category-filter";
import { sanitizeMenuForClient } from "@/lib/iiko/sanitize-menu";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();
  const {
    menuId,
    establishmentId,
    iikoOrganizationId,
    iikoExternalMenuId,
    iikoHiddenCategoryIds: hiddenFromClient,
  } = body as {
    menuId?: string;
    establishmentId?: string;
    iikoOrganizationId?: string;
    iikoExternalMenuId?: string;
    iikoHiddenCategoryIds?: string[] | null;
  };

  if (!menuId) {
    return NextResponse.json({ error: "menuId обязателен" }, { status: 400 });
  }

  const menu = await prisma.qRMenu.findFirst({
    where: {
      id: menuId,
      source: "IIKO",
      OR: [
        { establishment: establishmentAccessWhere(userId) },
        { estId: establishmentId ?? undefined },
      ],
    },
  });

  if (!menu) {
    return NextResponse.json({ error: "Меню не найдено" }, { status: 404 });
  }

  const estId =
    establishmentId ??
    (
      await prisma.establishment.findFirst({
        where: { menuId: menu.id, ...establishmentAccessWhere(userId) },
        select: { id: true },
      })
    )?.id ??
    menu.estId;

  if (estId) {
    const isPro = await establishmentHasPaidFeatures(estId);
    if (!isPro) {
      return NextResponse.json({ error: "Требуется PRO" }, { status: 403 });
    }
  }

  const config = configFromQrMenu(menu);
  if (!config) {
    return NextResponse.json({ error: "iiko не настроен" }, { status: 400 });
  }

  if (iikoOrganizationId?.trim()) {
    config.organizationId = iikoOrganizationId.trim();
  }
  if (iikoExternalMenuId?.trim()) {
    config.externalMenuId = iikoExternalMenuId.trim();
  }

  try {
    const hiddenCategoryIds =
      hiddenFromClient !== undefined
        ? parseIikoHiddenCategoryIds(hiddenFromClient)
        : parseIikoHiddenCategoryIds(menu.iikoHiddenCategoryIds);
    const { menu: resolved, categories } = await fetchIikoMenuData(config, {
      id: menu.id,
      title: menu.title,
      description: menu.description,
      cartEnabled: menu.cartEnabled,
      askPhone: menu.askPhone,
      askEmail: menu.askEmail,
      askAddress: menu.askAddress,
      hiddenCategoryIds,
    });

    const categoryIds = categories.map((c) => c.id);
    const prunedHidden = pruneIikoHiddenCategoryIds(hiddenCategoryIds, categoryIds);

    return NextResponse.json({
      menu: serializeIikoMenuForClient(resolved),
      categories: categories.map((c) => ({
        ...c,
        visible: !prunedHidden.includes(c.id),
      })),
      config: {
        ...sanitizeMenuForClient(menu),
        iikoHiddenCategoryIds: prunedHidden,
      },
    });
  } catch (e) {
    const message =
      e instanceof IikoApiError ? e.message : "Не удалось загрузить меню iiko";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
