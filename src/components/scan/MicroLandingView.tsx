"use client";

import { useState } from "react";
import {
  Coffee,
  Star,
  CreditCard,
  Wifi,
  FileText,
  ChevronRight,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import type { PageModules, ModuleKey, BuiltinModuleKey, ModuleLabels, ModuleIcons } from "@/lib/page-modules";
import { isBuiltinModuleKey, customModuleKeyToId, getModuleLabel } from "@/lib/page-modules";
import MenuView from "@/components/scan/MenuView";
import BusinessCardView from "@/components/scan/BusinessCardView";
import WifiConnect from "@/components/scan/WifiConnect";
import ScanFlow from "@/components/scan/ScanFlow";
import CustomPageView from "@/components/scan/CustomPageView";
import type { MenuData } from "@/components/dashboard/MenuEditor";
import type { ReviewRoutingConfig } from "@/lib/review-routing";
import { resolveLandingSubtitle } from "@/lib/brand-theme";
import type { BrandTheme } from "@/lib/brand-theme";
import {
  accentTextStyle,
  coverOverlayStyle,
  headerBarStyle,
  headingColor,
  iconBoxStyle,
  moduleButtonStyle,
  mutedColor,
  scanRootStyle,
  submutedColor,
} from "@/lib/brand-theme-ui";
import { useBrandThemeScan, type BrandThemeScanProps } from "@/components/scan/brand-theme-props";

export interface CustomPageItem {
  id: string;
  menuItemLabel: string;
  title: string;
  content: string;
  type: string;
  url?: string | null;
  icon?: string | null;
  enabled: boolean;
}

interface MicroLandingViewProps {
  establishmentName: string;
  establishmentId: string;
  qrCodeId: string;
  pageModules: PageModules;
  moduleOrder: ModuleKey[] | null;
  moduleLabels?: ModuleLabels;
  moduleIcons?: ModuleIcons;
  menu: MenuData | null;
  businessCard: Parameters<typeof BusinessCardView>[0]["card"] | null;
  wifiConfig: Parameters<typeof WifiConnect>[0]["wifiConfig"] | null;
  reviewRouting: ReviewRoutingConfig;
  customPages?: CustomPageItem[];
  platformUrls: {
    yandexMapsUrl: string | null;
    twoGisUrl: string | null;
    avitoUrl: string | null;
  };
  watermarkEnabled: boolean;
  showPromo?: boolean;
  promoCode?: string;
  initialSection?: string;
  embedded?: boolean;
  isDemo?: boolean;
  brandColor?: string | null;
  pageAppearance?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  landingSubtitle?: string | null;
}

const BUILTIN_ICONS: Record<BuiltinModuleKey, typeof Coffee> = {
  menu: Coffee,
  review: Star,
  businessCard: CreditCard,
  wifi: Wifi,
};

const CUSTOM_ICONS = [FileText, CreditCard, Star, Wifi, Coffee];

function getCustomIcon(index: number) {
  return CUSTOM_ICONS[index % CUSTOM_ICONS.length];
}

export default function MicroLandingView({
  establishmentName,
  establishmentId,
  qrCodeId,
  pageModules,
  moduleOrder,
  moduleLabels = {},
  moduleIcons = {},
  menu,
  businessCard,
  wifiConfig,
  reviewRouting,
  customPages = [],
  platformUrls,
  watermarkEnabled,
  showPromo,
  promoCode,
  initialSection,
  embedded,
  isDemo = false,
  brandColor,
  pageAppearance,
  logoUrl,
  coverUrl,
  landingSubtitle,
}: MicroLandingViewProps) {
  const [section, setSection] = useState<string>(
    initialSection ?? "home"
  );

  const { theme, dark } = useBrandThemeScan({ brandColor, pageAppearance });
  const themeProps = { brandColor, pageAppearance };
  const subtitleText = resolveLandingSubtitle(landingSubtitle);

  const showBackToHome = section !== "home" && !initialSection;
  const goHome = () => setSection("home");

  const customPageMap = new Map(customPages.map((p) => [p.id, p]));

  if (section === "menu" && menu) {
    return (
      <LandingSectionShell showBack={showBackToHome} onBack={goHome} embedded={embedded} theme={theme} dark={dark} coverUrl={coverUrl}>
        <MenuView
          menu={menu}
          establishmentName={establishmentName}
          embedded={embedded}
          {...themeProps}
          isBg={!!coverUrl}
        />
      </LandingSectionShell>
    );
  }

  if (section === "businessCard" && businessCard) {
    return (
      <LandingSectionShell showBack={showBackToHome} onBack={goHome} embedded={embedded} theme={theme} dark={dark} coverUrl={coverUrl}>
        <BusinessCardView card={businessCard} qrCode="" showContactForm={false} brandColor={brandColor} pageAppearance={pageAppearance} isBg={!!coverUrl} />
      </LandingSectionShell>
    );
  }

  if (section === "wifi" && wifiConfig) {
    return (
      <LandingSectionShell showBack={showBackToHome} onBack={goHome} embedded={embedded} theme={theme} dark={dark} coverUrl={coverUrl}>
        <WifiConnect wifiConfig={wifiConfig} {...themeProps} isBg={!!coverUrl} />
      </LandingSectionShell>
    );
  }

  if (section === "review") {
    return (
      <LandingSectionShell showBack={showBackToHome} onBack={goHome} embedded={embedded} theme={theme} dark={dark} coverUrl={coverUrl}>
        <ScanFlow
          establishmentName={establishmentName}
          establishmentId={establishmentId}
          qrCodeId={qrCodeId}
          reviewRouting={reviewRouting}
          platformUrls={platformUrls}
          watermarkEnabled={watermarkEnabled}
          showPromo={!!showPromo}
          promoCode={promoCode}
          isDemo={isDemo}
          {...themeProps}
          isBg={!!coverUrl}
        />
      </LandingSectionShell>
    );
  }

  const customId = customModuleKeyToId(section);
  if (customId) {
    const page = customPageMap.get(customId);
    if (page) {
      return (
        <LandingSectionShell showBack={showBackToHome} onBack={goHome} embedded={embedded} theme={theme} dark={dark} coverUrl={coverUrl}>
          <CustomPageView
            title={page.title}
            content={page.content}
            embedded={embedded}
            {...themeProps}
            isBg={!!coverUrl}
          />
        </LandingSectionShell>
      );
    }
  }

  const enabledModules = resolveModuleOrder(pageModules, customPages, moduleOrder);

  const hasContent: Record<string, boolean> = {
    menu: !!menu?.items?.length,
    review: true,
    businessCard: !!businessCard,
    wifi: !!wifiConfig,
  };
  customPages.forEach((p) => {
    hasContent[`custom-${p.id}`] = p.type === "LINK" ? !!p.url : !!p.content;
  });

  const getLabel = (key: string): string => {
    if (isBuiltinModuleKey(key)) return getModuleLabel(key, moduleLabels);
    const cId = customModuleKeyToId(key);
    if (cId) return customPageMap.get(cId)?.menuItemLabel ?? "Страница";
    return key;
  };

  const getIcon = (key: string, idx: number) => {
    if (isBuiltinModuleKey(key)) {
      if (moduleIcons[key]) return null;
      return BUILTIN_ICONS[key];
    }
    const cId = customModuleKeyToId(key);
    if (cId) {
      const p = customPageMap.get(cId);
      if (p?.icon) return null;
      if (p?.type === "LINK") return ExternalLink;
    }
    return getCustomIcon(idx);
  };

  const getEmoji = (key: string): string | null => {
    if (isBuiltinModuleKey(key)) return moduleIcons[key] ?? null;
    const cId = customModuleKeyToId(key);
    if (!cId) return null;
    return customPageMap.get(cId)?.icon ?? null;
  };

  const wrapperClass = embedded
    ? "rounded-2xl overflow-hidden relative"
    : "min-h-screen relative";

  const isBg = !!coverUrl;

  return (
    <div
      className={wrapperClass}
      style={scanRootStyle(theme, { isBg, embedded })}
    >
      {coverUrl && (
        <div className="absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt="Background" className={`w-full h-full object-cover ${embedded ? "absolute" : "fixed"} inset-0`} />
          <div className={`${embedded ? "absolute" : "fixed"} inset-0`} style={coverOverlayStyle()} />
        </div>
      )}

      <div className={`relative z-10 ${embedded ? "p-4" : "px-4 pt-10 pb-8 max-w-md mx-auto min-h-[inherit] flex flex-col"}`}>
        <div className="flex flex-col items-center">
          {logoUrl && (
            <div
              className={`rounded-full overflow-hidden border-2 shadow-lg flex items-center justify-center ${embedded ? "w-16 h-16 mb-3" : "w-24 h-24 mb-5"}`}
              style={
                isBg
                  ? { borderColor: "rgba(255,255,255,0.25)", backgroundColor: "#fff" }
                  : { borderColor: "var(--brand-border)", backgroundColor: "var(--brand-surface)" }
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
            </div>
          )}
          <h1
            className={`font-bold text-center ${embedded ? "text-lg" : "text-2xl"}`}
            style={{ color: headingColor(isBg) }}
          >
            {establishmentName}
          </h1>
          <p
            className={`text-center mt-1 ${embedded ? "text-xs" : "text-sm"}`}
            style={{ color: mutedColor(isBg) }}
          >
            {subtitleText}
          </p>
        </div>

        <div className={`space-y-3 w-full ${embedded ? "mt-5" : "mt-8"}`}>
          {enabledModules.map((key, idx) => {
            const Icon = getIcon(key, idx);
            const emoji = getEmoji(key);
            const ready = hasContent[key] !== false;
            const isLink = (() => {
              const cId = customModuleKeyToId(key);
              if (!cId) return false;
              return customPageMap.get(cId)?.type === "LINK";
            })();
            const linkUrl = (() => {
              const cId = customModuleKeyToId(key);
              if (!cId) return null;
              const p = customPageMap.get(cId);
              return p?.type === "LINK" ? p.url : null;
            })();
            const handleClick = () => {
              if (!ready) return;
              if (isLink && linkUrl) {
                window.open(linkUrl, "_blank");
                return;
              }
              setSection(key);
            };

            return (
              <button
                key={key}
                type="button"
                onClick={handleClick}
                disabled={!ready}
                className={`w-full flex items-center gap-4 rounded-2xl border text-left transition-all backdrop-blur-md shadow-sm ${
                  embedded ? "p-3" : "p-4"
                } ${ready ? "hover:shadow-md hover:opacity-95" : "opacity-50 cursor-not-allowed"}`}
                style={moduleButtonStyle(isBg)}
              >
                <div
                  className={`rounded-xl flex items-center justify-center shrink-0 ${
                    embedded ? "w-9 h-9" : "w-12 h-12"
                  }`}
                  style={iconBoxStyle(isBg)}
                >
                  {emoji ? (
                    <span className={embedded ? "text-base" : "text-xl"}>{emoji}</span>
                  ) : Icon ? (
                    <Icon className={embedded ? "w-4 h-4" : "w-6 h-6"} />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-semibold ${embedded ? "text-sm" : ""}`}
                    style={{ color: headingColor(isBg) }}
                  >
                    {getLabel(key)}
                  </p>
                  {!ready && (
                    <p className="text-xs mt-0.5" style={{ color: submutedColor(isBg) }}>
                      Раздел ещё не заполнен
                    </p>
                  )}
                </div>
                {ready && (
                  <ChevronRight
                    className="w-5 h-5 shrink-0"
                    style={{ color: submutedColor(isBg) }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {!embedded && (
          <div className="mt-auto pt-8 pb-2 w-full">
            <p className="text-center text-xs" style={{ color: submutedColor(isBg) }}>
              Сделано в QrStars.ru
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function resolveModuleOrder(
  pageModules: PageModules,
  customPages: CustomPageItem[],
  moduleOrder: ModuleKey[] | null
): ModuleKey[] {
  if (moduleOrder && moduleOrder.length > 0) {
    const valid = new Set<string>();
    (Object.keys(pageModules) as BuiltinModuleKey[]).forEach((k) => {
      if (pageModules[k]) valid.add(k);
    });
    customPages.forEach((p) => {
      if (p.enabled) valid.add(`custom-${p.id}`);
    });
    return moduleOrder.filter((k) => valid.has(k));
  }

  const builtin: ModuleKey[] = (
    Object.keys(pageModules) as BuiltinModuleKey[]
  ).filter((k) => pageModules[k]);
  const custom: ModuleKey[] = customPages
    .filter((p) => p.enabled)
    .map((p) => `custom-${p.id}` as ModuleKey);
  return [...builtin, ...custom];
}

function LandingSectionShell({
  showBack,
  onBack,
  embedded,
  theme,
  dark,
  coverUrl,
  children,
}: {
  showBack: boolean;
  onBack: () => void;
  embedded?: boolean;
  theme: BrandTheme;
  dark: boolean;
  coverUrl?: string | null;
  children: React.ReactNode;
}) {
  if (!showBack) {
    return <>{children}</>;
  }

  const isBg = !!coverUrl;

  return (
    <div className={embedded ? "flex flex-col relative min-h-[inherit]" : "min-h-screen flex flex-col relative"} style={theme.cssVars}>
      {coverUrl && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-[inherit]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt="Background" className={`w-full h-full object-cover ${embedded ? "absolute" : "fixed"} inset-0`} />
          <div className={`${embedded ? "absolute" : "fixed"} inset-0`} style={coverOverlayStyle()} />
        </div>
      )}

      <div
        className={`shrink-0 backdrop-blur-md border-b relative z-20 ${embedded ? "px-2 py-2" : "px-4 py-3"}`}
        style={headerBarStyle(isBg, dark)}
      >
        <button
          type="button"
          onClick={onBack}
          className={`inline-flex items-center gap-1.5 font-medium active:opacity-70 transition-colors hover:opacity-80 ${
            embedded ? "text-xs" : "text-sm"
          }`}
          style={isBg ? { color: "var(--brand-300)" } : accentTextStyle()}
        >
          <ArrowLeft className={embedded ? "w-3.5 h-3.5" : "w-4 h-4"} />
          На главную
        </button>
      </div>
      <div className="flex-1 min-h-0 relative z-10">{children}</div>
    </div>
  );
}
