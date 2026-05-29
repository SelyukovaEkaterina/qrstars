"use client";

import { useState, useEffect, useCallback } from "react";
import NextImage from "next/image";
import {
  Coffee,
  Star,
  CreditCard,
  Wifi,
  FileText,
  ChevronRight,
  ArrowLeft,
  ExternalLink,
  ClipboardList,
  Banknote,
  Download,
  MapPin,
  Phone,
} from "lucide-react";
import FileDownloadView from "@/components/scan/FileDownloadView";
import type { PageModules, ModuleKey, BuiltinModuleKey, ModuleLabels, ModuleIcons, ModuleTypes } from "@/lib/page-modules";
import {
  isBuiltinModuleKey,
  customModuleKeyToId,
  getModuleLabel,
  isTypedModuleKey,
  getModuleType,
  typedModuleKeyToInstanceId,
  resolveEnabledModuleOrder,
} from "@/lib/page-modules";
import MenuView from "@/components/scan/MenuView";
import LazyMenuView, { prefetchPublicMenu } from "@/components/scan/LazyMenuView";
import type { MenuData } from "@/components/dashboard/MenuEditor";
import { menuNeedsDeferredLoad } from "@/lib/menu-deferred";
import BusinessCardView from "@/components/scan/BusinessCardView";
import WifiConnect from "@/components/scan/WifiConnect";
import ScanFlow from "@/components/scan/ScanFlow";
import CustomPageView from "@/components/scan/CustomPageView";
import FormView, { type FormViewData } from "@/components/scan/FormView";
import TipsView from "@/components/scan/TipsView";
import TipsEmployeesView from "@/components/scan/TipsEmployeesView";
import type { PdConsent } from "@/components/scan/ScanFlow";
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
import OpenStatusIndicator from "@/components/scan/OpenStatusIndicator";
import { parseWorkingHours } from "@/lib/working-hours";
import { menuHasLandingContent } from "@/lib/menu-content";

export interface CustomPageFileAsset {
  id: string;
  title: string | null;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
}

export interface CustomPageItem {
  id: string;
  menuItemLabel: string;
  title: string;
  content: string;
  type: string;
  url?: string | null;
  icon?: string | null;
  enabled: boolean;
  fileAsset?: CustomPageFileAsset | null;
}

interface MicroLandingViewProps {
  establishmentName: string;
  establishmentId: string;
  qrCodeId: string;
  pageModules: PageModules;
  moduleOrder: ModuleKey[] | null;
  moduleLabels?: ModuleLabels;
  moduleIcons?: ModuleIcons;
  moduleTypes?: ModuleTypes;
  menu: MenuData | null;
  businessCard: Parameters<typeof BusinessCardView>[0]["card"] | null;
  wifiConfig: Parameters<typeof WifiConnect>[0]["wifiConfig"] | null;
  reviewRouting: ReviewRoutingConfig;
  customPages?: CustomPageItem[];
  extraMenus?: MenuData[];
  extraBusinessCards?: Parameters<typeof BusinessCardView>[0]["card"][];
  extraWifiConfigs?: Parameters<typeof WifiConnect>[0]["wifiConfig"][];
  forms?: FormViewData[];
  platformUrls: {
    yandexMapsUrl: string | null;
    twoGisUrl: string | null;
    avitoUrl: string | null;
  };
  watermarkEnabled: boolean;
  tipsConfig?: {
    tipsType: string | null;
    tipsPhone?: string | null;
    tipsBankName?: string | null;
    tipsUrl?: string | null;
    employees?: {
      id: string;
      name: string;
      photoUrl?: string | null;
      paymentType: string;
      paymentUrl?: string | null;
      phone?: string | null;
      bankName?: string | null;
    }[];
  };
  showPromo?: boolean;
  promoCode?: string;
  pdConsent?: PdConsent;
  initialSection?: string;
  /** When set (e.g. dashboard preview), section follows the active editor tab. */
  syncSection?: string;
  embedded?: boolean;
  isDemo?: boolean;
  brandColor?: string | null;
  pageAppearance?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  landingSubtitle?: string | null;
  address?: string | null;
  phone?: string | null;
  yandexMapsUrl?: string | null;
  workingHours?: unknown;
}

const BUILTIN_ICONS: Record<BuiltinModuleKey, typeof Coffee> = {
  menu: Coffee,
  review: Star,
  businessCard: CreditCard,
  wifi: Wifi,
  tips: Banknote,
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
  moduleTypes = {},
  menu,
  businessCard,
  wifiConfig,
  reviewRouting,
  customPages = [],
  extraMenus = [],
  extraBusinessCards = [],
  extraWifiConfigs = [],
  forms = [],
  platformUrls,
  watermarkEnabled,
  tipsConfig,
  showPromo,
  promoCode,
  pdConsent,
  initialSection,
  syncSection,
  embedded,
  isDemo = false,
  brandColor,
  pageAppearance,
  logoUrl,
  coverUrl,
  landingSubtitle,
  address,
  phone,
  yandexMapsUrl,
  workingHours,
}: MicroLandingViewProps) {
  const parsedHours = parseWorkingHours(workingHours);
  const [section, setSectionState] = useState<string>(
    syncSection ?? initialSection ?? "home"
  );

  useEffect(() => {
    if (syncSection !== undefined) {
      setSectionState(syncSection);
    }
  }, [syncSection]);

  useEffect(() => {
    if (!establishmentId) return;
    if (menu?.id && menuNeedsDeferredLoad(menu)) {
      prefetchPublicMenu(establishmentId, menu.id);
    }
    for (const m of extraMenus) {
      if (m.id && menuNeedsDeferredLoad(m)) {
        prefetchPublicMenu(establishmentId, m.id);
      }
    }
  }, [establishmentId, menu, extraMenus]);

  const renderMenuSection = (
    menuData: MenuData,
    sectionActive: boolean
  ) => {
    const common = {
      establishmentName,
      embedded,
      establishmentId,
      qrCodeId,
      isDemo,
      pdConsent,
      isBg: !!coverUrl,
      brandColor,
      pageAppearance,
    };
    if (menuNeedsDeferredLoad(menuData) && menuData.id) {
      return (
        <LazyMenuView
          menuStub={menuData}
          active={sectionActive}
          prefetch
          {...common}
        />
      );
    }
    return <MenuView menu={menuData} {...common} />;
  };

  // Sync section with URL ?s= param (skip when embedded or initialSection is pinned)
  useEffect(() => {
    if (embedded || initialSection) return;
    const params = new URLSearchParams(window.location.search);
    const s = params.get("s");
    if (s && s !== "home") setSectionState(s);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setSection = useCallback((key: string) => {
    setSectionState(key);
    if (!embedded && !initialSection) {
      const url = new URL(window.location.href);
      if (key === "home") {
        url.searchParams.delete("s");
      } else {
        url.searchParams.set("s", key);
      }
      history.replaceState(null, "", url.toString());
    }
  }, [embedded, initialSection]);

  const { theme, dark } = useBrandThemeScan({ brandColor, pageAppearance });
  const themeProps = { brandColor, pageAppearance };
  const subtitleText = resolveLandingSubtitle(landingSubtitle);

  const showBackToHome = section !== "home" && !initialSection;
  const goHome = () => setSection("home");

  const customPageMap = new Map(customPages.map((p) => [p.id, p]));
  const extraMenuMap = new Map(extraMenus.map((m) => [m.id, m]));
  const extraBcMap = new Map(extraBusinessCards.map((bc) => [bc.id, bc]));
  const extraWifiMap = new Map(extraWifiConfigs.map((wc) => [wc.id, wc]));
  const formsMap = new Map(forms.map((f) => [f.id, f]));

  const hasContent: Record<string, boolean> = {
    menu: menuHasLandingContent(menu),
    review: true,
    businessCard: !!businessCard,
    wifi: !!wifiConfig,
    tips: !!tipsConfig?.tipsType,
  };
  customPages.forEach((p) => {
    hasContent[`custom-${p.id}`] =
      p.type === "LINK" ? !!p.url : p.type === "FILE" ? !!p.fileAsset : !!p.content;
  });
  for (const [key, info] of Object.entries(moduleTypes)) {
    if (info.type === "menu") {
      hasContent[key] = menuHasLandingContent(extraMenuMap.get(info.instanceId) ?? null);
    } else if (info.type === "businessCard") hasContent[key] = !!extraBcMap.get(info.instanceId);
    else if (info.type === "wifi") hasContent[key] = !!extraWifiMap.get(info.instanceId);
    else if (info.type === "form") hasContent[key] = !!formsMap.get(info.instanceId);
  }

  const sectionContent: React.ReactNode = (() => {
    if (section !== "home" && !hasContent[section]) return null;

    if (section === "menu" && menuHasLandingContent(menu)) {
      return renderMenuSection(menu!, true);
    }

    if (section === "businessCard" && businessCard) {
      return (
        <BusinessCardView card={businessCard} qrCode="" showContactForm={false} pdConsent={pdConsent} brandColor={brandColor} pageAppearance={pageAppearance} isBg={!!coverUrl} />
      );
    }

    if (section === "wifi" && wifiConfig) {
      return <WifiConnect wifiConfig={wifiConfig} {...themeProps} isBg={!!coverUrl} />;
    }

    if (section === "review") {
      return (
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
          pdConsent={pdConsent}
          {...themeProps}
          isBg={!!coverUrl}
        />
      );
    }

    if (section === "tips" && tipsConfig?.tipsType) {
      if (tipsConfig.tipsType === "EMPLOYEES" && tipsConfig.employees?.length) {
        return (
          <TipsEmployeesView
            employees={tipsConfig.employees.map((e) => ({
              ...e,
              paymentType: (e.paymentType === "LINK" ? "LINK" : "PHONE") as "LINK" | "PHONE",
            }))}
            establishmentName={establishmentName}
            brandColor={brandColor ?? undefined}
            pageAppearance={
              pageAppearance === "dark" ? "dark" : pageAppearance === "light" ? "light" : undefined
            }
          />
        );
      }
      return (
        <TipsView
          tipsType={(tipsConfig.tipsType as "REDIRECT" | "PHONE") || "PHONE"}
          tipsPhone={tipsConfig.tipsPhone}
          tipsBankName={tipsConfig.tipsBankName}
          redirectUrl={tipsConfig.tipsUrl}
          establishmentName={establishmentName}
          brandColor={brandColor ?? undefined}
          pageAppearance={
            pageAppearance === "dark" ? "dark" : pageAppearance === "light" ? "light" : undefined
          }
        />
      );
    }

    const customId = customModuleKeyToId(section);
    if (customId && hasContent[section]) {
      const page = customPageMap.get(customId);
      if (page) {
        if (page.type === "FILE" && page.fileAsset) {
          return (
            <FileDownloadView
              file={page.fileAsset}
              establishmentName={establishmentName}
              {...themeProps}
            />
          );
        }
        return (
          <CustomPageView
            title={page.title}
            content={page.content}
            embedded={embedded}
            {...themeProps}
            isBg={!!coverUrl}
          />
        );
      }
    }

    if (isTypedModuleKey(section, moduleTypes)) {
      const info = moduleTypes[section];
      if (info) {
        if (info.type === "menu") {
          const extraMenu = extraMenuMap.get(info.instanceId);
          if (extraMenu && menuHasLandingContent(extraMenu)) {
            return renderMenuSection(extraMenu, true);
          }
        }
        if (info.type === "businessCard") {
          const extraBc = extraBcMap.get(info.instanceId);
          if (extraBc) {
            return (
              <BusinessCardView card={extraBc} qrCode="" showContactForm={false} pdConsent={pdConsent} brandColor={brandColor} pageAppearance={pageAppearance} isBg={!!coverUrl} />
            );
          }
        }
        if (info.type === "wifi") {
          const extraWc = extraWifiMap.get(info.instanceId);
          if (extraWc) {
            return <WifiConnect wifiConfig={extraWc} {...themeProps} isBg={!!coverUrl} />;
          }
        }
        if (info.type === "form") {
          const form = formsMap.get(info.instanceId);
          if (form) {
            return (
              <FormView
                form={form}
                qrCodeId={qrCodeId}
                isDemo={isDemo}
                embedded={embedded}
                isBg={!!coverUrl}
                pdConsent={pdConsent}
                {...themeProps}
              />
            );
          }
        }
      }
    }

    return null;
  })();

  if (sectionContent) {
    return (
      <LandingSectionShell showBack={showBackToHome} onBack={goHome} embedded={embedded} theme={theme} dark={dark} coverUrl={coverUrl}>
        {sectionContent}
      </LandingSectionShell>
    );
  }

  const enabledModules = resolveEnabledModuleOrder(
    pageModules,
    customPages,
    moduleOrder,
    moduleTypes
  );

  const visibleModules = enabledModules.filter((key) => hasContent[key]);

  const getLabel = (key: string): string => {
    if (isBuiltinModuleKey(key)) return getModuleLabel(key, moduleLabels);
    const cId = customModuleKeyToId(key);
    if (cId) return customPageMap.get(cId)?.menuItemLabel ?? "Страница";
    if (isTypedModuleKey(key, moduleTypes)) {
      const info = moduleTypes[key];
      if (info.type === "menu") return extraMenuMap.get(info.instanceId)?.title || "Меню";
      if (info.type === "businessCard") return extraBcMap.get(info.instanceId)?.fullName || "Визитка";
      if (info.type === "wifi") return extraWifiMap.get(info.instanceId)?.ssid || "Wi-Fi";
      if (info.type === "form") return formsMap.get(info.instanceId)?.title || "Форма";
    }
    return key;
  };

  const getIcon = (key: string, idx: number) => {
    if (isBuiltinModuleKey(key)) {
      if (moduleIcons[key]) return null;
      return BUILTIN_ICONS[key];
    }
    if (isTypedModuleKey(key, moduleTypes)) {
      const info = moduleTypes[key];
      if (info.type === "menu") return Coffee;
      if (info.type === "businessCard") return CreditCard;
      if (info.type === "wifi") return Wifi;
      if (info.type === "form") return ClipboardList;
    }
    const cId = customModuleKeyToId(key);
    if (cId) {
      const p = customPageMap.get(cId);
      if (p?.icon) return null;
      if (p?.type === "LINK") return ExternalLink;
      if (p?.type === "FILE") return Download;
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

      {isDemo && !embedded && (
        <div
          className="fixed top-3 right-3 z-30 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase shadow-md backdrop-blur"
          style={{ backgroundColor: "rgba(17,24,39,0.85)", color: "#fff" }}
        >
          Demo
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
              <NextImage
                src={logoUrl}
                alt="Logo"
                width={96}
                height={96}
                className="w-full h-full object-cover"
                priority
                unoptimized={!logoUrl.startsWith("https://app.qrstars.ru/storage") && !logoUrl.startsWith("https://s3.qrstars.ru")}
              />
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
          {(address || phone || parsedHours) && (
            <div
              className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 ${embedded ? "mt-2 text-[11px]" : "mt-3 text-xs"}`}
              style={{ color: mutedColor(isBg) }}
            >
              {parsedHours && (
                <OpenStatusIndicator
                  workingHours={parsedHours}
                  color={mutedColor(isBg)}
                  embedded={embedded}
                />
              )}
              {address && (
                <a
                  href={yandexMapsUrl || `https://yandex.ru/maps/?text=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:opacity-80 active:opacity-70 transition-opacity max-w-full"
                  style={{ color: mutedColor(isBg) }}
                >
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{address}</span>
                </a>
              )}
              {phone && (
                <a
                  href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                  className="inline-flex items-center gap-1 hover:opacity-80 active:opacity-70 transition-opacity"
                  style={{ color: mutedColor(isBg) }}
                >
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>{phone}</span>
                </a>
              )}
            </div>
          )}
        </div>

        <div className={`space-y-3 w-full ${embedded ? "mt-5" : "mt-8"}`}>
          {visibleModules.map((key, idx) => {
            const Icon = getIcon(key, idx);
            const emoji = getEmoji(key);
            const isHero = idx === 0;
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
              if (isLink && linkUrl) {
                window.open(linkUrl, "_blank");
                return;
              }
              setSection(key);
            };

            const heroStyle: React.CSSProperties = isHero
              ? {
                  backgroundColor: "var(--brand-600)",
                  borderColor: "var(--brand-700)",
                  color: "#ffffff",
                }
              : moduleButtonStyle(isBg);
            const heroIconStyle: React.CSSProperties = isHero
              ? { backgroundColor: "rgba(255,255,255,0.18)", color: "#ffffff" }
              : iconBoxStyle(isBg);
            const labelColor = isHero ? "#ffffff" : headingColor(isBg);
            const chevronColor = isHero ? "rgba(255,255,255,0.85)" : submutedColor(isBg);

            return (
              <button
                key={key}
                type="button"
                onClick={handleClick}
                className={`w-full flex items-center gap-4 rounded-2xl border text-left transition-all backdrop-blur-md hover:shadow-md hover:opacity-95 ${
                  isHero ? "shadow-lg" : "shadow-sm"
                } ${embedded ? (isHero ? "p-3.5" : "p-3") : isHero ? "p-5" : "p-4"}`}
                style={heroStyle}
              >
                <div
                  className={`rounded-xl flex items-center justify-center shrink-0 ${
                    embedded
                      ? isHero ? "w-10 h-10" : "w-9 h-9"
                      : isHero ? "w-14 h-14" : "w-12 h-12"
                  }`}
                  style={heroIconStyle}
                >
                  {emoji ? (
                    <span className={embedded ? "text-base" : isHero ? "text-2xl" : "text-xl"}>{emoji}</span>
                  ) : Icon ? (
                    <Icon className={embedded ? "w-4 h-4" : isHero ? "w-7 h-7" : "w-6 h-6"} />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-semibold ${embedded ? "text-sm" : isHero ? "text-lg" : ""}`}
                    style={{ color: labelColor }}
                  >
                    {getLabel(key)}
                  </p>
                </div>
                <ChevronRight
                  className="w-5 h-5 shrink-0"
                  style={{ color: chevronColor }}
                />
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
    <div
      className={embedded ? "flex flex-col relative min-h-[inherit]" : "min-h-screen flex flex-col relative"}
      style={scanRootStyle(theme, { isBg, embedded })}
    >
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
          style={isBg || dark ? { color: "var(--brand-300)" } : accentTextStyle()}
        >
          <ArrowLeft className={embedded ? "w-3.5 h-3.5" : "w-4 h-4"} />
          На главную
        </button>
      </div>
      <div className="flex-1 min-h-0 relative z-10 flex flex-col">{children}</div>
    </div>
  );
}
