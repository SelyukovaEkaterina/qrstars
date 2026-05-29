import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { establishmentAccessWhere, establishmentHasPaidFeatures } from "@/lib/establishment-access";
import { encryptApiLogin } from "@/lib/iiko/encrypt";
import { parseIikoHiddenCategoryIds } from "@/lib/iiko/category-filter";
import { sanitizeMenuForClient } from "@/lib/iiko/sanitize-menu";
import { invalidateIikoMenuCache } from "@/lib/cache";
import type { MenuSource } from "@/generated/prisma/client";

type MenuItemInput = {
  name: string;
  description?: string | null;
  price?: string | null;
  weight?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  hidden?: boolean;
};

type IikoBodyFields = {
  source?: MenuSource;
  iikoApiLogin?: string;
  iikoOrganizationId?: string | null;
  iikoExternalMenuId?: string | null;
  iikoPriceCategoryId?: string | null;
  iikoTerminalGroupId?: string | null;
  iikoPaymentTypeId?: string | null;
  iikoOrderTypePickupId?: string | null;
  iikoOrderTypeDeliveryId?: string | null;
  iikoHiddenCategoryIds?: string[] | null;
};

async function assertProForIiko(establishmentId: string | undefined, source: MenuSource | undefined) {
  if (source !== "IIKO" || !establishmentId) return null;
  const isPro = await establishmentHasPaidFeatures(establishmentId);
  if (!isPro) {
    return NextResponse.json(
      { error: "Интеграция iiko доступна на тарифе PRO и Сеть" },
      { status: 403 }
    );
  }
  return null;
}

function buildIikoFields(
  body: IikoBodyFields,
  existingLogin: string | null | undefined
): Record<string, unknown> {
  const source = body.source === "IIKO" ? "IIKO" : "MANUAL";
  if (source === "MANUAL") {
    return {
      source: "MANUAL" as const,
      iikoApiLogin: null,
      iikoOrganizationId: null,
      iikoExternalMenuId: null,
      iikoPriceCategoryId: null,
      iikoTerminalGroupId: null,
      iikoPaymentTypeId: null,
      iikoOrderTypePickupId: null,
      iikoOrderTypeDeliveryId: null,
      iikoHiddenCategoryIds: null,
    };
  }

  const loginRaw = body.iikoApiLogin?.trim();
  const encryptedLogin =
    loginRaw && loginRaw.length > 0
      ? encryptApiLogin(loginRaw)
      : existingLogin ?? null;

  return {
    source: "IIKO" as const,
    ...(loginRaw && loginRaw.length > 0 ? { iikoApiLogin: encryptedLogin } : {}),
    iikoOrganizationId: body.iikoOrganizationId?.trim() || null,
    iikoExternalMenuId: body.iikoExternalMenuId?.trim() || null,
    iikoPriceCategoryId: body.iikoPriceCategoryId?.trim() || null,
    iikoTerminalGroupId: body.iikoTerminalGroupId?.trim() || null,
    iikoPaymentTypeId: body.iikoPaymentTypeId?.trim() || null,
    iikoOrderTypePickupId: body.iikoOrderTypePickupId?.trim() || null,
    iikoOrderTypeDeliveryId: body.iikoOrderTypeDeliveryId?.trim() || null,
    ...(body.iikoHiddenCategoryIds !== undefined
      ? {
          iikoHiddenCategoryIds:
            body.iikoHiddenCategoryIds === null
              ? null
              : parseIikoHiddenCategoryIds(body.iikoHiddenCategoryIds),
        }
      : {}),
  };
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();
  const {
    title,
    description,
    cartEnabled,
    askPhone,
    askEmail,
    askAddress,
    items,
    establishmentId,
    linkAsPrimary,
    source,
    ...iikoFields
  } = body;

  const menuSource: MenuSource = source === "IIKO" ? "IIKO" : "MANUAL";

  if (establishmentId) {
    const est = await prisma.establishment.findFirst({
      where: { id: establishmentId, ...establishmentAccessWhere(userId) },
    });
    if (!est) {
      return NextResponse.json({ error: "Establishment not found" }, { status: 404 });
    }
  }

  const proErr = await assertProForIiko(establishmentId, menuSource);
  if (proErr) return proErr;

  const iikoData = buildIikoFields({ source: menuSource, ...iikoFields }, null);

  const menu = await prisma.qRMenu.create({
    data: {
      title: title?.trim() || null,
      description: description?.trim() || null,
      cartEnabled: !!cartEnabled,
      askPhone: !!askPhone,
      askEmail: !!askEmail,
      askAddress: !!askAddress,
      estId: establishmentId || null,
      ...iikoData,
      ...(menuSource === "MANUAL"
        ? {
            items: {
              create: (items || []).map((item: MenuItemInput, index: number) => ({
                name: item.name.trim(),
                description: item.description?.trim() || null,
                price: item.price?.trim() || null,
                weight: item.weight?.trim() || null,
                category: item.category?.trim() || null,
                imageUrl: item.imageUrl?.trim() || null,
                order: index,
                hidden: item.hidden || false,
              })),
            },
          }
        : {}),
    },
    include: { items: true },
  });

  if (establishmentId && linkAsPrimary !== false) {
    await prisma.establishment.update({
      where: { id: establishmentId },
      data: { menu: { connect: { id: menu.id } } },
    });
  }

  return NextResponse.json({ menu: sanitizeMenuForClient(menu) });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();
  const {
    id,
    title,
    description,
    cartEnabled,
    askPhone,
    askEmail,
    askAddress,
    items,
    source,
    establishmentId,
    ...iikoFields
  } = body;

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const existing = await prisma.qRMenu.findFirst({
    where: {
      id,
      OR: [
        { qrcodes: { some: { establishment: establishmentAccessWhere(userId) } } },
        { establishment: establishmentAccessWhere(userId) },
        { estId: { not: null }, qrcodes: { none: {} } },
      ],
    },
  });

  if (!existing) {
    const byEstId = await prisma.qRMenu.findFirst({ where: { id } });
    if (byEstId?.estId) {
      const est = await prisma.establishment.findFirst({
        where: { id: byEstId.estId, ...establishmentAccessWhere(userId) },
      });
      if (!est) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    } else {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const resolvedExisting = existing ?? (await prisma.qRMenu.findUnique({ where: { id } }))!;
  const nextSource: MenuSource =
    source === "IIKO" ? "IIKO" : source === "MANUAL" ? "MANUAL" : resolvedExisting.source;

  let estIdForPro = establishmentId ?? resolvedExisting.estId ?? undefined;
  if (!estIdForPro) {
    const linked = await prisma.establishment.findFirst({
      where: { menuId: id, ...establishmentAccessWhere(userId) },
      select: { id: true },
    });
    estIdForPro = linked?.id;
  }

  const proErr = await assertProForIiko(estIdForPro, nextSource);
  if (proErr) return proErr;

  const iikoData = buildIikoFields(
    { source: nextSource, ...iikoFields },
    resolvedExisting.iikoApiLogin
  );

  if (nextSource === "MANUAL") {
    await prisma.qRMenuItem.deleteMany({ where: { menuId: id } });
  }

  const menu = await prisma.qRMenu.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title?.trim() || null }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(cartEnabled !== undefined && { cartEnabled: !!cartEnabled }),
      ...(askPhone !== undefined && { askPhone: !!askPhone }),
      ...(askEmail !== undefined && { askEmail: !!askEmail }),
      ...(askAddress !== undefined && { askAddress: !!askAddress }),
      ...iikoData,
      ...(nextSource === "MANUAL" && items !== undefined
        ? {
            items: {
              create: (items || []).map((item: MenuItemInput, index: number) => ({
                name: item.name.trim(),
                description: item.description?.trim() || null,
                price: item.price?.trim() || null,
                weight: item.weight?.trim() || null,
                category: item.category?.trim() || null,
                imageUrl: item.imageUrl?.trim() || null,
                order: index,
                hidden: item.hidden || false,
              })),
            },
          }
        : {}),
    },
    include: { items: true },
  });

  if (nextSource === "IIKO") {
    await invalidateIikoMenuCache(id);
  }

  return NextResponse.json({ menu: sanitizeMenuForClient(menu) });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const menu = await prisma.qRMenu.findFirst({
    where: { id },
  });

  if (!menu) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (menu.estId) {
    const est = await prisma.establishment.findFirst({
      where: { id: menu.estId, ...establishmentAccessWhere(userId) },
    });
    if (!est) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } else {
    const est = await prisma.establishment.findFirst({
      where: { menuId: id, ...establishmentAccessWhere(userId) },
    });
    if (!est) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  await prisma.qRMenu.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
