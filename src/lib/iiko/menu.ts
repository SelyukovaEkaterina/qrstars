import { getCached, setCached } from "@/lib/cache";
import { getAccessToken, iikoPost } from "@/lib/iiko/client";
import {
  hashHiddenCategoryIds,
  parseIikoHiddenCategoryIds,
} from "@/lib/iiko/category-filter";
import { decryptApiLogin } from "@/lib/iiko/encrypt";
import {
  listIikoCategories,
  mapIikoMenuResponse,
  menuDescriptionFromIiko,
  menuTitleFromIiko,
  type IikoCategorySummary,
  type IikoMenuByIdResponse,
} from "@/lib/iiko/map-menu";
import type { IikoMenuConfig, ResolvedIikoMenu } from "@/lib/iiko/types";
import type { QRMenu } from "@/generated/prisma/client";
import { createHash } from "crypto";

const MENU_CACHE_TTL = 300;
const TOKEN_CACHE_TTL = 3000;

type MenuByIdResponse = IikoMenuByIdResponse;

type CachedIikoMenu = {
  menu: ResolvedIikoMenu;
  productIndexEntries: [string, { name: string; price: number | null; iikoProductId: string; iikoSizeId: string | null }][];
  categories: IikoCategorySummary[];
};

export function configFromQrMenu(
  menu: Pick<
    QRMenu,
    | "iikoApiLogin"
    | "iikoOrganizationId"
    | "iikoExternalMenuId"
    | "iikoPriceCategoryId"
    | "iikoTerminalGroupId"
    | "iikoPaymentTypeId"
    | "iikoOrderTypePickupId"
    | "iikoOrderTypeDeliveryId"
    | "iikoHiddenCategoryIds"
  >
): IikoMenuConfig | null {
  if (!menu.iikoApiLogin || !menu.iikoOrganizationId || !menu.iikoExternalMenuId) {
    return null;
  }
  return {
    apiLogin: decryptApiLogin(menu.iikoApiLogin),
    organizationId: menu.iikoOrganizationId,
    externalMenuId: String(menu.iikoExternalMenuId),
    priceCategoryId: menu.iikoPriceCategoryId,
    terminalGroupId: menu.iikoTerminalGroupId,
    paymentTypeId: menu.iikoPaymentTypeId,
    orderTypePickupId: menu.iikoOrderTypePickupId,
    orderTypeDeliveryId: menu.iikoOrderTypeDeliveryId,
    hiddenCategoryIds: parseIikoHiddenCategoryIds(menu.iikoHiddenCategoryIds),
  };
}

async function getCachedToken(apiLogin: string): Promise<string> {
  const key = `iiko:token:${createHash("sha256").update(apiLogin).digest("hex").slice(0, 16)}`;
  const cached = await getCached<string>(key);
  if (cached) return cached;
  const token = await getAccessToken(apiLogin);
  await setCached(key, token, TOKEN_CACHE_TTL);
  return token;
}

export type FetchIikoMenuResult = {
  menu: ResolvedIikoMenu;
  categories: IikoCategorySummary[];
};

export async function fetchIikoMenuData(
  config: IikoMenuConfig,
  menuMeta?: {
    id?: string;
    title?: string | null;
    description?: string | null;
    cartEnabled?: boolean;
    askPhone?: boolean;
    askEmail?: boolean;
    askAddress?: boolean;
    hiddenCategoryIds?: string[];
  }
): Promise<FetchIikoMenuResult> {
  const hiddenCategoryIds =
    menuMeta?.hiddenCategoryIds ?? config.hiddenCategoryIds ?? [];
  const cacheSuffix = hashHiddenCategoryIds(hiddenCategoryIds);
  const cacheKey = menuMeta?.id ? `iiko:menu:${menuMeta.id}:${cacheSuffix}` : null;

  if (cacheKey) {
    const cached = await getCached<CachedIikoMenu>(cacheKey);
    if (cached) {
      const productIndex = new Map(cached.productIndexEntries);
      return {
        menu: { ...cached.menu, _iikoProductIndex: productIndex },
        categories: cached.categories,
      };
    }
  }

  const token = await getCachedToken(config.apiLogin);
  const raw = await iikoPost<MenuByIdResponse>(
    "/api/2/menu/by_id",
    {
      externalMenuId: config.externalMenuId,
      organizationIds: [config.organizationId],
      priceCategoryId: config.priceCategoryId ?? null,
      version: 2,
    },
    token
  );

  const categories = listIikoCategories(raw);
  const { items, productIndex } = mapIikoMenuResponse(raw, config.organizationId, {
    hiddenCategoryIds,
  });

  const resolved: ResolvedIikoMenu = {
    id: menuMeta?.id,
    title: menuTitleFromIiko(raw, menuMeta?.title),
    description: menuDescriptionFromIiko(raw, menuMeta?.description),
    source: "IIKO" as const,
    cartEnabled: menuMeta?.cartEnabled ?? false,
    askPhone: menuMeta?.askPhone ?? false,
    askEmail: menuMeta?.askEmail ?? false,
    askAddress: menuMeta?.askAddress ?? false,
    items,
    _iikoProductIndex: productIndex,
  };

  if (cacheKey) {
    await setCached(
      cacheKey,
      {
        menu: { ...resolved, _iikoProductIndex: undefined },
        productIndexEntries: Array.from(productIndex.entries()),
        categories,
      },
      MENU_CACHE_TTL
    );
  }

  return { menu: resolved, categories };
}

export async function resolveIikoMenuForScan(
  menu: QRMenu & { items?: unknown[] }
): Promise<ResolvedIikoMenu | null> {
  const config = configFromQrMenu(menu);
  if (!config) return null;
  const { menu: resolved } = await fetchIikoMenuData(config, {
    id: menu.id,
    title: menu.title,
    description: menu.description,
    cartEnabled: menu.cartEnabled,
    askPhone: menu.askPhone,
    askEmail: menu.askEmail,
    askAddress: menu.askAddress,
    hiddenCategoryIds: config.hiddenCategoryIds,
  });
  return resolved;
}

/** Strip server-only index before sending to client */
export function serializeIikoMenuForClient(menu: ResolvedIikoMenu): ResolvedIikoMenu {
  const { _iikoProductIndex: _, ...rest } = menu;
  return rest;
}

export async function resolveMenuForScan(
  menu:
    | (QRMenu & { items?: { order: number }[] | unknown[] })
    | null
    | undefined
): Promise<{ menu: ResolvedIikoMenu | null; error: string | null }> {
  if (!menu) return { menu: null, error: null };
  if (menu.source !== "IIKO") {
    return {
      menu: {
        id: menu.id,
        title: menu.title,
        description: menu.description,
        source: "MANUAL",
        cartEnabled: menu.cartEnabled,
        askPhone: menu.askPhone,
        askEmail: menu.askEmail,
        askAddress: menu.askAddress,
        items: (menu as QRMenu & { items: import("@/components/dashboard/MenuEditor").MenuItemData[] }).items ?? [],
      },
      error: null,
    };
  }
  try {
    const resolved = await resolveIikoMenuForScan(menu);
    if (!resolved || resolved.items.length === 0) {
      return { menu: null, error: "Меню iiko пусто или недоступно" };
    }
    return { menu: serializeIikoMenuForClient(resolved), error: null };
  } catch {
    return { menu: null, error: "Меню временно недоступно. Попробуйте позже." };
  }
}
