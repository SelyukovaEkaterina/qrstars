import type { MenuData } from "@/components/dashboard/MenuEditor";

/** Есть ли у меню контент для кнопки на микро-лендинге (ручные позиции или настроенный iiko). */
export function menuHasLandingContent(
  menu: Pick<
    MenuData,
    | "items"
    | "source"
    | "iikoOrganizationId"
    | "iikoExternalMenuId"
    | "iikoApiLoginSaved"
  > | null
  | undefined
): boolean {
  if (!menu) return false;
  if ((menu.items?.length ?? 0) > 0) return true;
  if (menu.source === "IIKO") {
    return !!(
      menu.iikoOrganizationId &&
      menu.iikoExternalMenuId &&
      menu.iikoApiLoginSaved
    );
  }
  return false;
}
