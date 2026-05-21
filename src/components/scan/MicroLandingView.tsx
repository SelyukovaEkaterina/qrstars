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
import type { PageModules, ModuleKey, BuiltinModuleKey, ModuleLabels } from "@/lib/page-modules";
import { isBuiltinModuleKey, customModuleKeyToId, getModuleLabel } from "@/lib/page-modules";
import MenuView from "@/components/scan/MenuView";
import BusinessCardView from "@/components/scan/BusinessCardView";
import WifiConnect from "@/components/scan/WifiConnect";
import ScanFlow from "@/components/scan/ScanFlow";
import CustomPageView from "@/components/scan/CustomPageView";
import type { MenuData } from "@/components/dashboard/MenuEditor";
import type { ReviewRoutingConfig } from "@/lib/review-routing";
import { getLandingTheme, isDarkLandingTheme, type LandingThemeId } from "@/lib/landing-themes";
import type { LandingTheme } from "@/lib/landing-themes";

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
  landingTheme?: LandingThemeId | string | null;
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
  landingTheme: landingThemeId,
}: MicroLandingViewProps) {
  const [section, setSection] = useState<string>(
    initialSection ?? "home"
  );

  const theme = getLandingTheme(landingThemeId);
  const dark = isDarkLandingTheme(landingThemeId);

  const showBackToHome = section !== "home" && !initialSection;
  const goHome = () => setSection("home");

  const customPageMap = new Map(customPages.map((p) => [p.id, p]));

  if (section === "menu" && menu) {
    return (
      <LandingSectionShell showBack={showBackToHome} onBack={goHome} embedded={embedded} theme={theme} dark={dark}>
        <MenuView
          menu={menu}
          establishmentName={establishmentName}
          embedded={embedded}
          landingTheme={landingThemeId}
        />
      </LandingSectionShell>
    );
  }

  if (section === "businessCard" && businessCard) {
    return (
      <LandingSectionShell showBack={showBackToHome} onBack={goHome} embedded={embedded} theme={theme} dark={dark}>
        <BusinessCardView card={businessCard} qrCode="" showContactForm={false} landingTheme={landingThemeId} />
      </LandingSectionShell>
    );
  }

  if (section === "wifi" && wifiConfig) {
    return (
      <LandingSectionShell showBack={showBackToHome} onBack={goHome} embedded={embedded} theme={theme} dark={dark}>
        <WifiConnect wifiConfig={wifiConfig} landingTheme={landingThemeId} />
      </LandingSectionShell>
    );
  }

  if (section === "review") {
    return (
      <LandingSectionShell showBack={showBackToHome} onBack={goHome} embedded={embedded} theme={theme} dark={dark}>
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
          landingTheme={landingThemeId}
        />
      </LandingSectionShell>
    );
  }

  const customId = customModuleKeyToId(section);
  if (customId) {
    const page = customPageMap.get(customId);
    if (page) {
      return (
        <LandingSectionShell showBack={showBackToHome} onBack={goHome} embedded={embedded} theme={theme} dark={dark}>
          <CustomPageView
            title={page.title}
            content={page.content}
            embedded={embedded}
            landingTheme={landingThemeId}
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
    if (isBuiltinModuleKey(key)) return BUILTIN_ICONS[key];
    const cId = customModuleKeyToId(key);
    if (cId) {
      const p = customPageMap.get(cId);
      if (p?.icon) return null;
      if (p?.type === "LINK") return ExternalLink;
    }
    return getCustomIcon(idx);
  };

  const getEmoji = (key: string): string | null => {
    if (isBuiltinModuleKey(key)) return null;
    const cId = customModuleKeyToId(key);
    if (!cId) return null;
    return customPageMap.get(cId)?.icon ?? null;
  };

  const wrapperClass = embedded
    ? `${theme.bgEmbedded} rounded-2xl overflow-hidden`
    : `min-h-screen ${theme.bg}`;

  return (
    <div className={wrapperClass}>
      <div className={embedded ? "p-4" : "px-4 pt-10 pb-8 max-w-md mx-auto"}>
        <h1
          className={`font-bold text-center ${
            embedded ? "text-lg" : "text-2xl"
          } ${dark ? "text-white" : "text-gray-900"}`}
        >
          {establishmentName}
        </h1>
        <p
          className={`text-center mt-1 ${
            embedded ? "text-xs" : "text-sm"
          } ${dark ? "text-slate-400" : "text-gray-500"}`}
        >
          Выберите, что вам нужно
        </p>

        <div className={`space-y-3 ${embedded ? "mt-4" : "mt-8"}`}>
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
                className={`w-full flex items-center gap-4 rounded-2xl border text-left transition-all ${
                  embedded ? "p-3" : "p-4"
                } ${
                  dark
                    ? "bg-slate-800 border-slate-700"
                    : "bg-white border-gray-200"
                } ${
                  ready
                    ? `${theme.hoverBorder} hover:shadow-sm`
                    : `${dark ? "border-slate-700 opacity-50" : "border-gray-100 opacity-50"} cursor-not-allowed`
                }`}
              >
                <div
                  className={`rounded-xl ${theme.iconBg} ${theme.iconText} flex items-center justify-center shrink-0 ${
                    embedded ? "w-9 h-9" : "w-12 h-12"
                  }`}
                >
                  {emoji ? (
                    <span className={embedded ? "text-base" : "text-xl"}>{emoji}</span>
                  ) : Icon ? (
                    <Icon className={embedded ? "w-4 h-4" : "w-6 h-6"} />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-semibold ${
                      embedded ? "text-sm" : ""
                    } ${dark ? "text-white" : "text-gray-900"}`}
                  >
                    {getLabel(key)}
                  </p>
                  {!ready && (
                    <p className={`text-xs mt-0.5 ${dark ? "text-slate-500" : "text-gray-400"}`}>
                      Раздел ещё не заполнен
                    </p>
                  )}
                </div>
                {ready && (
                  <ChevronRight className={`w-5 h-5 shrink-0 ${dark ? "text-slate-500" : "text-gray-400"}`} />
                )}
              </button>
            );
          })}
        </div>

        {!embedded && (
          <p className={`text-center text-xs mt-8 ${dark ? "text-slate-500" : "text-gray-400"}`}>
            Сделано в QrStars.ru
          </p>
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
  children,
}: {
  showBack: boolean;
  onBack: () => void;
  embedded?: boolean;
  theme: LandingTheme;
  dark: boolean;
  children: React.ReactNode;
}) {
  if (!showBack) {
    return <>{children}</>;
  }

  return (
    <div className={embedded ? "flex flex-col" : "min-h-screen flex flex-col"}>
      <div
        className={`sticky top-0 z-30 shrink-0 backdrop-blur-sm border-b ${
          dark
            ? "bg-slate-900/95 border-slate-700"
            : "bg-white/95 border-gray-100"
        } ${embedded ? "px-2 py-2" : "px-4 py-3"}`}
      >
        <button
          type="button"
          onClick={onBack}
          className={`inline-flex items-center gap-1.5 font-medium active:opacity-70 transition-colors ${
            embedded ? "text-xs" : "text-sm"
          } ${theme.backText}`}
        >
          <ArrowLeft className={embedded ? "w-3.5 h-3.5" : "w-4 h-4"} />
          На главную
        </button>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
