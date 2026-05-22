import { useMemo } from "react";
import {
  getBrandTheme,
  parsePageAppearance,
  type BrandTheme,
  type PageAppearance,
} from "@/lib/brand-theme";

export interface BrandThemeScanProps {
  brandColor?: string | null;
  pageAppearance?: string | null;
}

export function useBrandThemeScan({
  brandColor,
  pageAppearance,
}: BrandThemeScanProps): { theme: BrandTheme; dark: boolean; appearance: PageAppearance } {
  return useMemo(() => {
    const appearance = parsePageAppearance(pageAppearance);
    const theme = getBrandTheme(brandColor, appearance);
    return { theme, dark: theme.dark, appearance };
  }, [brandColor, pageAppearance]);
}
