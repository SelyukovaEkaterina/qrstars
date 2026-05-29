import type { CSSProperties } from "react";
import type { BrandTheme } from "@/lib/brand-theme";

export interface ScanLayoutOptions {
  isBg?: boolean;
  embedded?: boolean;
}

/** Корневой контейнер страницы скана: фон + CSS-переменные бренда. */
export function scanRootStyle(
  theme: BrandTheme,
  { isBg, embedded }: ScanLayoutOptions = {}
): CSSProperties {
  if (isBg) {
    return { ...theme.cssVars, background: "transparent" };
  }
  return {
    ...theme.cssVars,
    ...(embedded
      ? theme.embeddedBackgroundStyle
      : theme.pageBackgroundStyle),
  };
}

export function panelStyle(isBg = false): CSSProperties {
  if (isBg) {
    return {
      backgroundColor: "rgba(15, 23, 42, 0.88)",
      borderColor: "var(--brand-cover-module-border)",
    };
  }
  return {
    backgroundColor: "var(--brand-surface)",
    borderColor: "var(--brand-border)",
  };
}

export function moduleButtonStyle(isBg = false): CSSProperties {
  if (isBg) {
    return {
      backgroundColor: "var(--brand-cover-module-bg)",
      borderColor: "var(--brand-cover-module-border)",
    };
  }
  return {
    backgroundColor: "var(--brand-module-bg)",
    borderColor: "var(--brand-module-border)",
  };
}

export function iconBoxStyle(isBg = false): CSSProperties {
  if (isBg) {
    return {
      backgroundColor: "var(--brand-cover-icon-bg)",
      color: "#ffffff",
    };
  }
  return {
    backgroundColor: "var(--brand-icon-bg)",
    color: "var(--brand-icon-fg)",
  };
}

export function headingColor(isBg = false): string {
  return isBg ? "#ffffff" : "var(--brand-heading)";
}

export function mutedColor(isBg = false): string {
  return isBg ? "rgba(255,255,255,0.75)" : "var(--brand-muted)";
}

export function submutedColor(isBg = false): string {
  return isBg ? "rgba(255,255,255,0.55)" : "var(--brand-submuted)";
}

export function rowSurfaceStyle(isBg = false): CSSProperties {
  if (isBg) {
    return {
      backgroundColor: "var(--brand-cover-module-bg)",
      borderColor: "var(--brand-cover-module-border)",
    };
  }
  return {
    backgroundColor: "var(--brand-row-bg)",
    borderColor: "var(--brand-border)",
  };
}

export function infoBoxStyle(isBg = false): CSSProperties {
  if (isBg) {
    return {
      backgroundColor: "var(--brand-cover-module-bg)",
      borderColor: "var(--brand-cover-module-border)",
      color: "#ffffff",
    };
  }
  return {
    backgroundColor: "var(--brand-info-bg)",
    borderColor: "var(--brand-info-border)",
    color: "var(--brand-info-text)",
  };
}

export function primaryButtonStyle(isBg = false): CSSProperties {
  if (isBg) {
    return { backgroundColor: "#ffffff", color: "#111827" };
  }
  return {
    backgroundColor: "var(--brand-700)",
    color: "#ffffff",
  };
}

export function accentTextStyle(): CSSProperties {
  return { color: "var(--brand-600)" };
}

export function accentBorderButtonStyle(): CSSProperties {
  return {
    borderColor: "var(--brand-600)",
    color: "var(--brand-600)",
  };
}

export function headerBarStyle(isBg = false, dark = false): CSSProperties {
  if (isBg) {
    return {
      backgroundColor: "rgba(15, 23, 42, 0.65)",
      borderColor: "var(--brand-cover-module-border)",
    };
  }
  if (dark) {
    return {
      backgroundColor: "var(--brand-header-bg)",
      borderColor: "var(--brand-border)",
    };
  }
  return {
    backgroundColor: "var(--brand-header-bg)",
    borderColor: "var(--brand-border)",
  };
}

export function sectionAccentStyle(): CSSProperties {
  return { backgroundColor: "var(--brand-500)" };
}

export function activePillStyle(): CSSProperties {
  return {
    backgroundColor: "var(--brand-600)",
    color: "#ffffff",
  };
}

export function priceTagStyle(isBg = false): CSSProperties {
  if (isBg) {
    return { backgroundColor: "var(--brand-cover-icon-bg)", color: "#fff" };
  }
  return {
    backgroundColor: "var(--brand-50)",
    color: "var(--brand-600)",
  };
}

export function coverOverlayStyle(): CSSProperties {
  return {
    background: "var(--brand-cover-overlay)",
  };
}
