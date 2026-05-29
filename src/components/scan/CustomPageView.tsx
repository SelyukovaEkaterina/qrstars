"use client";

import {
  headingColor,
  mutedColor,
  panelStyle,
  scanRootStyle,
} from "@/lib/brand-theme-ui";
import { useBrandThemeScan, type BrandThemeScanProps } from "@/components/scan/brand-theme-props";

interface CustomPageViewProps extends BrandThemeScanProps {
  title: string;
  content: string;
  embedded?: boolean;
  isBg?: boolean;
}

export default function CustomPageView({
  title,
  content,
  embedded,
  brandColor,
  pageAppearance,
  isBg,
}: CustomPageViewProps) {
  const { theme } = useBrandThemeScan({ brandColor, pageAppearance });

  return (
    <div
      className={embedded ? "flex-1 p-4 relative z-10 min-h-[inherit]" : "flex-1 px-4 pt-6 pb-10 max-w-2xl mx-auto relative z-10 min-h-[inherit]"}
      style={scanRootStyle(theme, { isBg, embedded })}
    >
      <div
        className="backdrop-blur-md rounded-2xl shadow-sm p-6 border"
        style={panelStyle(isBg)}
      >
        <h1
          className={`font-bold mb-6 ${embedded ? "text-lg" : "text-2xl"}`}
          style={{ color: headingColor(isBg) }}
        >
          {title}
        </h1>
        <div
          className={`prose prose-sm max-w-none ${embedded ? "prose-sm" : ""}`}
          style={{ color: mutedColor(isBg) }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </div>
  );
}
