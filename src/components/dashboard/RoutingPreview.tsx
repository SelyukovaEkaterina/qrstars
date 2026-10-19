"use client";

import { Smartphone } from "lucide-react";
import MicroLandingView, {
  type CustomPageItem,
} from "@/components/scan/MicroLandingView";
import MenuView from "@/components/scan/MenuView";
import type { MenuData } from "@/components/dashboard/MenuEditor";
import type {
  PageModules,
  ModuleKey,
  ModuleLabels,
  ModuleIcons,
  ModuleTypes,
} from "@/lib/page-modules";
import type { ReviewRoutingConfig } from "@/lib/review-routing";
import { DEFAULT_REVIEW_ROUTING } from "@/lib/review-routing";
import type { RoutingGroup, SectionTarget } from "@/lib/qr-routing";
import { isBuiltinSection } from "@/lib/qr-routing";
import { REDIRECT_INTERSTITIAL_SECONDS } from "@/lib/redirect-interstitial";

export interface LandingPreviewPayload {
  pageModules: PageModules;
  moduleOrder: ModuleKey[] | null;
  moduleLabels?: ModuleLabels;
  moduleIcons?: ModuleIcons;
  moduleTypes?: ModuleTypes;
  menu?: MenuData | null;
  businessCard?: {
    id: string;
    fullName: string;
    title?: string | null;
    company?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    address?: string | null;
    about?: string | null;
    avatarUrl?: string | null;
    socialLinks?: { type: string; url: string }[];
    accentColor?: string | null;
    tipsUrl?: string | null;
    tipsLabel?: string | null;
  } | null;
  wifiConfig?: {
    id: string;
    ssid: string;
    password: string;
    encryption: string;
    hidden?: boolean;
  } | null;
  customPages?: CustomPageItem[];
  reviewRouting?: ReviewRoutingConfig;
  brandColor?: string | null;
  pageAppearance?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  landingSubtitle?: string | null;
  yandexMapsUrl?: string | null;
  twoGisUrl?: string | null;
  avitoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  workingHours?: unknown;
  landingTipsType?: string | null;
  landingTipsPhone?: string | null;
  landingTipsBankName?: string | null;
  landingTipsUrl?: string | null;
  tipsEmployees?: {
    id: string;
    name: string;
    photoUrl?: string | null;
    paymentType: string;
    paymentUrl?: string | null;
    phone?: string | null;
    bankName?: string | null;
  }[];
  extraMenus?: MenuData[];
  extraBusinessCards?: NonNullable<LandingPreviewPayload["businessCard"]>[];
  extraWifiConfigs?: NonNullable<LandingPreviewPayload["wifiConfig"]>[];
}

interface RoutingPreviewProps {
  routingGroup: RoutingGroup;
  section?: SectionTarget;
  establishmentName: string;
  establishmentId?: string;
  /** Полный контент микро-лендинга с `/api/establishments/[id]/page` */
  landing?: LandingPreviewPayload | null;
  /** @deprecated используйте landing */
  pageModules?: PageModules;
  /** @deprecated используйте landing */
  menu?: MenuData | null;
  redirectUrl?: string;
  /** FREE: гость сначала видит экран QrStars с отсчётом (REDIRECT) */
  showRedirectInterstitial?: boolean;
  hasFile?: boolean;
  customPageLabel?: string | null;
}

export default function RoutingPreview({
  routingGroup,
  section,
  establishmentName,
  establishmentId,
  landing,
  pageModules: pageModulesProp,
  menu: menuProp,
  redirectUrl,
  showRedirectInterstitial,
  customPageLabel,
}: RoutingPreviewProps) {
  const pageModules = landing?.pageModules ?? pageModulesProp;
  const menu = landing?.menu ?? menuProp ?? null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Smartphone className="w-4 h-4" />
        <span>Предпросмотр для гостя</span>
      </div>
      <div className="mx-auto w-[280px] rounded-[2rem] border-[6px] border-gray-800 bg-gray-800 p-1 shadow-xl">
        <div className="rounded-t-[1.4rem] overflow-hidden min-h-[480px] max-h-[560px] overflow-y-auto flex flex-col bg-white">
          {routingGroup === "LANDING" && pageModules && establishmentId && (
            <MicroLandingView
              establishmentName={establishmentName}
              establishmentId={establishmentId}
              qrCodeId="preview"
              pageModules={pageModules}
              moduleOrder={landing?.moduleOrder ?? null}
              moduleLabels={landing?.moduleLabels}
              moduleIcons={landing?.moduleIcons}
              moduleTypes={landing?.moduleTypes}
              menu={menu}
              businessCard={
                landing?.businessCard?.id
                  ? {
                      id: landing.businessCard.id,
                      fullName: landing.businessCard.fullName,
                      title: landing.businessCard.title ?? null,
                      company: landing.businessCard.company ?? null,
                      phone: landing.businessCard.phone ?? null,
                      email: landing.businessCard.email ?? null,
                      website: landing.businessCard.website ?? null,
                      address: landing.businessCard.address ?? null,
                      about: landing.businessCard.about ?? null,
                      avatarUrl: landing.businessCard.avatarUrl ?? null,
                      socialLinks: landing.businessCard.socialLinks ?? [],
                      accentColor: landing.businessCard.accentColor || "#4f46e5",
                      tipsUrl: landing.businessCard.tipsUrl,
                      tipsLabel: landing.businessCard.tipsLabel,
                    }
                  : null
              }
              wifiConfig={
                landing?.wifiConfig?.id
                  ? {
                      id: landing.wifiConfig.id,
                      ssid: landing.wifiConfig.ssid,
                      password: landing.wifiConfig.password,
                      encryption: landing.wifiConfig.encryption,
                      hidden: !!landing.wifiConfig.hidden,
                    }
                  : null
              }
              reviewRouting={landing?.reviewRouting ?? DEFAULT_REVIEW_ROUTING}
              customPages={(landing?.customPages ?? []).filter((p) => p.enabled)}
              extraMenus={landing?.extraMenus}
              extraBusinessCards={landing?.extraBusinessCards
                ?.filter((bc): bc is NonNullable<typeof bc> & { id: string } => !!bc?.id)
                .map((bc) => ({
                  id: bc.id,
                  fullName: bc.fullName,
                  title: bc.title ?? null,
                  company: bc.company ?? null,
                  phone: bc.phone ?? null,
                  email: bc.email ?? null,
                  website: bc.website ?? null,
                  address: bc.address ?? null,
                  about: bc.about ?? null,
                  avatarUrl: bc.avatarUrl ?? null,
                  socialLinks: bc.socialLinks ?? [],
                  accentColor: bc.accentColor || "#4f46e5",
                  tipsUrl: bc.tipsUrl,
                  tipsLabel: bc.tipsLabel,
                }))}
              extraWifiConfigs={landing?.extraWifiConfigs
                ?.filter((wc): wc is NonNullable<typeof wc> & { id: string } => !!wc?.id)
                .map((wc) => ({
                  id: wc.id,
                  ssid: wc.ssid,
                  password: wc.password,
                  encryption: wc.encryption,
                  hidden: !!wc.hidden,
                }))}
              tipsConfig={
                landing
                  ? {
                      tipsType: landing.landingTipsType ?? null,
                      tipsPhone: landing.landingTipsPhone,
                      tipsBankName: landing.landingTipsBankName,
                      tipsUrl: landing.landingTipsUrl,
                      employees: landing.tipsEmployees,
                    }
                  : undefined
              }
              platformUrls={{
                yandexMapsUrl: landing?.yandexMapsUrl ?? null,
                twoGisUrl: landing?.twoGisUrl ?? null,
                avitoUrl: landing?.avitoUrl ?? null,
              }}
              brandColor={landing?.brandColor}
              pageAppearance={landing?.pageAppearance}
              logoUrl={landing?.logoUrl}
              coverUrl={landing?.coverUrl}
              landingSubtitle={landing?.landingSubtitle}
              address={landing?.address}
              phone={landing?.phone}
              yandexMapsUrl={landing?.yandexMapsUrl}
              workingHours={landing?.workingHours}
              watermarkEnabled
              embedded
            />
          )}
          {routingGroup === "SECTION" && section === "MENU" && menu && (
            <MenuView menu={menu} establishmentName={establishmentName} embedded />
          )}
          {routingGroup === "SECTION" && section === "REVIEW" && (
            <div className="p-6 text-center space-y-3">
              <p className="font-semibold text-gray-900">{establishmentName || "Заведение"}</p>
              <p className="text-sm text-gray-500">Гость сразу ставит оценку 1–5★</p>
              <div className="flex justify-center gap-1 text-2xl text-gray-300" aria-hidden>
                ★★★★★
              </div>
            </div>
          )}
          {routingGroup === "SECTION" &&
            (section === "BUSINESS_CARD" || section === "WIFI" || section === "TIPS") && (
              <SectionPlaceholder section={section} />
            )}
          {routingGroup === "SECTION" && section && !isBuiltinSection(section) && (
            <div className="p-6 text-center space-y-2">
              <p className="text-4xl">📄</p>
              <p className="font-medium text-gray-900">
                {customPageLabel || "Кастомная страница"}
              </p>
              <p className="text-xs text-gray-400">Контент из «Страниц заведений»</p>
            </div>
          )}
          {routingGroup === "REDIRECT" && showRedirectInterstitial && (
            <div className="p-5 text-center space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                FREE · экран QrStars
              </p>
              <p className="text-2xl font-bold text-gray-900">
                Qr<span className="text-indigo-600">Stars</span>
              </p>
              <p className="text-sm text-gray-600">Переходим на</p>
              <p className="text-xs font-mono text-indigo-600 break-all">
                {redirectUrl || "https://..."}
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {REDIRECT_INTERSTITIAL_SECONDS}
              </p>
              <p className="text-[11px] text-gray-400">
                через {REDIRECT_INTERSTITIAL_SECONDS} сек. — гость ждёт и видит нашу рекламу
              </p>
            </div>
          )}
          {routingGroup === "REDIRECT" && !showRedirectInterstitial && (
            <div className="p-6 text-center space-y-3">
              <p className="text-sm text-gray-500">Перенаправление на</p>
              <p className="text-xs font-mono text-indigo-600 break-all">
                {redirectUrl || "https://..."}
              </p>
              <p className="text-[11px] text-emerald-600">PRO · мгновенный переход</p>
            </div>
          )}
          {routingGroup === "LANDING" && (!establishmentId || !pageModules) && (
            <div className="p-6 text-center space-y-2">
              <p className="text-sm font-medium text-gray-900">Сначала привяжите заведение</p>
              <p className="text-xs text-gray-400">После сохранения здесь появится превью страницы гостя</p>
            </div>
          )}
        </div>
        <div className="h-3 rounded-b-[1.2rem] bg-gray-800 flex items-center justify-center">
          <div className="w-16 h-0.5 rounded-full bg-gray-600" />
        </div>
      </div>
    </div>
  );
}

function SectionPlaceholder({
  section,
}: {
  section: "BUSINESS_CARD" | "WIFI" | "TIPS";
}) {
  const labels: Record<typeof section, string> = {
    BUSINESS_CARD: "Визитка",
    WIFI: "Wi-Fi",
    TIPS: "Чаевые",
  };
  return (
    <div className="p-6 text-center space-y-2">
      <p className="font-medium text-gray-900">{labels[section]}</p>
      <p className="text-xs text-gray-400">Контент из «Страниц заведений»</p>
    </div>
  );
}
