/**
 * @deprecated Используйте `@/lib/brand-theme` (brandColor + pageAppearance).
 * Файл оставлен для обратной совместимости импортов.
 */
export {
  DEFAULT_LANDING_SUBTITLE,
  resolveLandingSubtitle,
  getBrandThemeFromLegacy as getLandingTheme,
  type BrandTheme as LandingTheme,
} from "@/lib/brand-theme";

import { getBrandThemeFromLegacy } from "@/lib/brand-theme";

/** @deprecated */
export function isDarkLandingTheme(landingTheme?: string | null): boolean {
  if (landingTheme === "dark") return true;
  return false;
}

/** @deprecated */
export type LandingThemeId = string;

/** @deprecated */
export const DEFAULT_LANDING_THEME = "default";

/** @deprecated */
export const LANDING_THEME_LIST: { id: string; label: string; accentHex: string }[] = [];
