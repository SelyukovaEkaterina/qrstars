import type { MenuData } from "@/components/dashboard/MenuEditor";
import { menuHasLandingContent } from "@/lib/menu-content";

/** Меню iiko (и очень большие ручные) подгружаются отдельно, не блокируя лендинг. */
export function menuNeedsDeferredLoad(
  menu: Pick<MenuData, "id" | "source" | "items"> | null | undefined
): boolean {
  if (!menu?.id) return false;
  if (menu.source === "IIKO") return menuHasLandingContent(menu);
  return (menu.items?.length ?? 0) > 100;
}
