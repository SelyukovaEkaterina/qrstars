import type { MenuItemData } from "@/components/dashboard/MenuEditor";
import type { IikoMenuProductIndex } from "@/lib/iiko/types";
import { iikoCategoryKey } from "@/lib/iiko/category-filter";

type IikoPrice = { organizationId?: string; price?: number };
type IikoSize = {
  sizeId?: string | null;
  sizeName?: string | null;
  isDefault?: boolean;
  isHidden?: boolean;
  portionWeightGrams?: number;
  buttonImageUrl?: string | null;
  prices?: IikoPrice[];
};
type IikoItem = {
  itemId?: string;
  sku?: string;
  name?: string;
  description?: string;
  itemSizes?: IikoSize[];
};

export type IikoCategory = {
  id?: string;
  name?: string;
  isHidden?: boolean;
  items?: IikoItem[];
  headerImageUrl?: string | null;
};

export type IikoMenuByIdResponse = {
  name?: string;
  description?: string;
  itemCategories?: IikoCategory[];
};

export type IikoCategorySummary = {
  id: string;
  name: string;
  itemCount: number;
};

function formatPrice(amount: number): string {
  if (Number.isInteger(amount)) {
    return `${amount.toLocaleString("ru-RU")} ₽`;
  }
  return `${amount.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₽`;
}

function formatWeight(grams: number | undefined): string | null {
  if (!grams || grams <= 0) return null;
  if (grams >= 1000) {
    const kg = grams / 1000;
    return kg % 1 === 0 ? `${kg} кг` : `${kg.toFixed(1)} кг`;
  }
  return `${Math.round(grams)} г`;
}

function pickSize(sizes: IikoSize[]): IikoSize | null {
  const visible = sizes.filter((s) => !s.isHidden);
  if (visible.length === 0) return null;
  return visible.find((s) => s.isDefault) ?? visible[0];
}

function priceForOrg(size: IikoSize, organizationId: string): number | null {
  const prices = size.prices ?? [];
  const match = prices.find((p) => p.organizationId === organizationId);
  const p = match?.price ?? prices[0]?.price;
  return typeof p === "number" && !Number.isNaN(p) ? p : null;
}

function countVisibleItems(cat: IikoCategory): number {
  let count = 0;
  for (const item of cat.items ?? []) {
    const productId = item.itemId?.trim();
    const name = item.name?.trim();
    if (!productId || !name) continue;
    if (!pickSize(item.itemSizes ?? [])) continue;
    count++;
  }
  return count;
}

/** Список категорий из ответа iiko (для настроек видимости в QR). */
export function listIikoCategories(data: IikoMenuByIdResponse): IikoCategorySummary[] {
  const result: IikoCategorySummary[] = [];
  for (const cat of data.itemCategories ?? []) {
    if (cat.isHidden) continue;
    const itemCount = countVisibleItems(cat);
    if (itemCount === 0) continue;
    result.push({
      id: iikoCategoryKey(cat),
      name: cat.name?.trim() || "Прочее",
      itemCount,
    });
  }
  return result;
}

export function mapIikoMenuResponse(
  data: IikoMenuByIdResponse,
  organizationId: string,
  options?: {
    title?: string | null;
    description?: string | null;
    hiddenCategoryIds?: string[];
  }
): { items: MenuItemData[]; productIndex: IikoMenuProductIndex } {
  const items: MenuItemData[] = [];
  const productIndex: IikoMenuProductIndex = new Map();
  const hiddenSet = new Set(options?.hiddenCategoryIds ?? []);
  let order = 0;

  for (const cat of data.itemCategories ?? []) {
    if (cat.isHidden) continue;
    if (hiddenSet.has(iikoCategoryKey(cat))) continue;
    const categoryName = cat.name?.trim() || "Прочее";

    for (const item of cat.items ?? []) {
      const productId = item.itemId?.trim();
      const name = item.name?.trim();
      if (!productId || !name) continue;

      const size = pickSize(item.itemSizes ?? []);
      if (!size) continue;

      const amount = priceForOrg(size, organizationId);
      const priceStr = amount !== null ? formatPrice(amount) : null;
      const imageUrl =
        size.buttonImageUrl?.trim() ||
        cat.headerImageUrl?.trim() ||
        null;

      const cartKey = `${productId}:${size.sizeId ?? ""}`;
      const menuItem: MenuItemData = {
        name,
        description: item.description?.trim() || null,
        price: priceStr,
        weight: formatWeight(size.portionWeightGrams),
        category: categoryName,
        imageUrl,
        order: order++,
        hidden: false,
        iikoProductId: productId,
        iikoSizeId: size.sizeId ?? null,
      };
      items.push(menuItem);
      productIndex.set(cartKey, {
        name,
        price: amount,
        iikoProductId: productId,
        iikoSizeId: size.sizeId ?? null,
      });
      productIndex.set(productId, {
        name,
        price: amount,
        iikoProductId: productId,
        iikoSizeId: size.sizeId ?? null,
      });
    }
  }

  return {
    items,
    productIndex,
  };
}

export function menuTitleFromIiko(
  data: IikoMenuByIdResponse,
  fallback?: string | null
): string | null {
  return data.name?.trim() || fallback?.trim() || null;
}

export function menuDescriptionFromIiko(
  data: IikoMenuByIdResponse,
  fallback?: string | null
): string | null {
  return data.description?.trim() || fallback?.trim() || null;
}
