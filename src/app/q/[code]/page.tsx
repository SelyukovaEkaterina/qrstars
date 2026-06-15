import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { recordQrScan } from "@/lib/record-qr-scan";
import { renderDemoScan } from "@/lib/render-demo-scan";
import {
  isDemoQrCode,
  type DemoQrSlug,
  DEMO_QR_CATALOG,
  demoReviewScan,
  demo2ReviewScan,
  demo3ReviewScan,
} from "@/lib/demo-qrcodes";
import { DEFAULT_REVIEW_ROUTING, parseReviewRouting } from "@/lib/review-routing";
import { parsePageModules, parseModuleOrder, parseModuleLabels, parseModuleIcons, parseModuleTypes } from "@/lib/page-modules";
import {
  resolveMenu,
  resolveBusinessCard,
  resolveWifiConfig,
} from "@/lib/establishment-content";
import { resolveTipsConfig } from "@/lib/tips-config";
import { resolveBrandSettings } from "@/lib/brand-theme";
import { getScanCache, setScanCache } from "@/lib/cache";
import { sanitizeMenuForClient } from "@/lib/iiko/sanitize-menu";
import { menuHasLandingContent } from "@/lib/menu-content";
import { menuNeedsDeferredLoad } from "@/lib/menu-deferred";

interface ScanPageProps {
  params: Promise<{ code: string }>;
}

function scanMetaTitle(mode: string | null, estName: string): string {
  switch (mode) {
    case "LANDING": return estName;
    case "REVIEW": return `Оставить отзыв — ${estName}`;
    case "MENU": return `Меню — ${estName}`;
    case "BUSINESS_CARD": return estName;
    case "WIFI": return `Wi-Fi — ${estName}`;
    case "FILE": return estName;
    case "FORM": return estName;
    case "CUSTOM_SECTION": return estName;
    case "TIPS": return `Чаевые — ${estName}`;
    default: return estName;
  }
}

function scanMetaDescription(mode: string | null, estName: string, subtitle?: string | null): string {
  switch (mode) {
    case "LANDING": return subtitle || `Страница заведения «${estName}»`;
    case "REVIEW": return `Оцените обслуживание в «${estName}» — ваш отзыв поможет стать лучше`;
    case "MENU": return `Посмотрите меню «${estName}»`;
    case "BUSINESS_CARD": return `Контакты и информация — «${estName}»`;
    case "WIFI": return `Подключитесь к Wi-Fi в «${estName}»`;
    case "FILE": return `Скачать документ от «${estName}»`;
    case "FORM": return `Заполните форму — «${estName}»`;
    case "CUSTOM_SECTION": return `Информация от «${estName}»`;
    case "TIPS": return `Оставьте чаевые в «${estName}»`;
    default: return `Страница заведения «${estName}»`;
  }
}

function demoEstName(slug: DemoQrSlug): string {
  if (slug.startsWith("demo3")) return demo3ReviewScan.establishmentName;
  if (slug.startsWith("demo2")) return demo2ReviewScan.establishmentName;
  return demoReviewScan.establishmentName;
}

export async function generateMetadata({ params }: ScanPageProps): Promise<Metadata> {
  const { code } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://app.qrstars.ru";
  const url = `${baseUrl}/q/${code}`;

  if (isDemoQrCode(code)) {
    const catalog = DEMO_QR_CATALOG.find((d) => d.slug === code);
    const estName = demoEstName(code as DemoQrSlug);
    const mode = catalog?.mode || "LANDING";
    const title = scanMetaTitle(mode, estName);
    const description = scanMetaDescription(mode, estName);
    return {
      title,
      description,
      openGraph: { title, description, type: "website", url },
    };
  }

  // Try Redis cache first — avoids a DB query on cache hit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cachedMeta: any = await getScanCache(code);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let qrCode: any = cachedMeta?.qr ?? null;

  if (!qrCode) {
    qrCode = await prisma.qRCode.findUnique({
      where: { code },
      select: {
        mode: true,
        establishment: {
          select: {
            name: true,
            landingSubtitle: true,
            coverUrl: true,
            logoUrl: true,
          },
        },
      },
    });
  }

  if (!qrCode?.establishment) {
    return { title: "QR Stars" };
  }

  const est = qrCode.establishment;
  const title = scanMetaTitle(qrCode.mode, est.name);
  const description = scanMetaDescription(qrCode.mode, est.name, est.landingSubtitle);
  const image = est.coverUrl || est.logoUrl || undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url,
      ...(image ? { images: [image] } : {}),
    },
  };
}

const establishmentContentInclude = {
  menu: {
    include: {
      items: { orderBy: { order: "asc" as const } },
    },
  },
  businessCard: true,
  wifiConfig: true,
  customPages: {
    where: { enabled: true },
    orderBy: { createdAt: "asc" as const },
    include: { fileAsset: true },
  },
  forms: { include: { fields: { orderBy: { order: "asc" as const } } }, orderBy: { createdAt: "asc" as const } },
  promocodes: { where: { isActive: true }, take: 1 },
  user: { include: { subscriptions: { where: { status: "ACTIVE" }, take: 1 } } },
  tipsEmployees: { orderBy: { order: "asc" as const } },
} as const;

// ─── Mode-optimised includes (#3) ───────────────────────────────────────────
// Only load relations actually needed for the QR's mode.
// REDIRECT skips the second query entirely (handled separately).

/** Minimal scalar select — determines mode/activation before loading relations. */
const qrMinimalSelect = {
  id: true,
  code: true,
  label: true,
  mode: true,
  isActive: true,
  source: true,
  batchId: true,
  establishmentId: true,
  userId: true,
  redirectUrl: true,
  tipsType: true,
  tipsPhone: true,
  tipsBankName: true,
} as const;

/** Relations shared by all non-REDIRECT render modes. */
const estCommonInclude = {
  promocodes: { where: { isActive: true }, take: 1 },
  user: { include: { subscriptions: { where: { status: "ACTIVE" }, take: 1 } } },
} as const;

/** Full include for LANDING mode (kitchen-sink: everything the landing needs). */
const landingQrInclude = {
  establishment: { include: establishmentContentInclude },
  businessCard: true,
  wifiConfig: true,
  menu: { include: { items: { orderBy: { order: "asc" as const } } } },
  tipsEmployees: { orderBy: { order: "asc" as const } },
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildScanInclude(mode: string): any {
  switch (mode) {
    case "WIFI":
      return {
        wifiConfig: true,
        establishment: { include: { ...estCommonInclude, wifiConfig: true } },
      };
    case "BUSINESS_CARD":
      return {
        businessCard: true,
        establishment: { include: { ...estCommonInclude, businessCard: true } },
      };
    case "MENU":
      return {
        menu: { include: { items: { orderBy: { order: "asc" as const } } } },
        establishment: {
          include: {
            ...estCommonInclude,
            menu: { include: { items: { orderBy: { order: "asc" as const } } } },
          },
        },
      };
    case "FILE":
      return {
        fileAsset: true,
        establishment: { include: estCommonInclude },
      };
    case "FORM":
      return {
        form: { include: { fields: { orderBy: { order: "asc" as const } } } },
        establishment: { include: estCommonInclude },
      };
    case "CUSTOM_SECTION":
      return {
        customPage: { include: { fileAsset: true } },
        establishment: { include: estCommonInclude },
      };
    case "TIPS":
      return {
        tipsEmployees: { orderBy: { order: "asc" as const } },
        establishment: {
          include: { ...estCommonInclude, tipsEmployees: { orderBy: { order: "asc" as const } } },
        },
      };
    case "LANDING":
      return landingQrInclude;
    default:
      // REVIEW and any future mode
      return { establishment: { include: estCommonInclude } };
  }
}

/**
 * Extra-module queries for LANDING mode (multi-menu, multi-card, multi-wifi).
 * Computed once and cached inside `scan:{code}` payload (#2).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function computeLandingExtras(qrCode: any) {
  const moduleTypes = parseModuleTypes(qrCode.establishment?.moduleTypes);
  const extraMenuIds = Object.values(moduleTypes).filter((m) => m.type === "menu").map((m) => m.instanceId);
  const extraBcIds = Object.values(moduleTypes).filter((m) => m.type === "businessCard").map((m) => m.instanceId);
  const extraWifiIds = Object.values(moduleTypes).filter((m) => m.type === "wifi").map((m) => m.instanceId);

  const [menus, businessCards, wifis] = await Promise.all([
    extraMenuIds.length > 0
      ? prisma.qRMenu.findMany({ where: { id: { in: extraMenuIds } }, include: { items: { orderBy: { order: "asc" as const } } } })
      : Promise.resolve([]),
    extraBcIds.length > 0
      ? prisma.businessCard.findMany({ where: { id: { in: extraBcIds } } })
      : Promise.resolve([]),
    extraWifiIds.length > 0
      ? prisma.wifiConfig.findMany({ where: { id: { in: extraWifiIds } } })
      : Promise.resolve([]),
  ]);

  return { menus, businessCards, wifis };
}

export default async function ScanPage({ params }: ScanPageProps) {
  const { code } = await params;

  const demoPage = await renderDemoScan(code);
  if (demoPage) {
    return demoPage;
  }

  // ─── Step 1: resolve QR data (cache → minimal → mode-specific) ───────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cached: any = await getScanCache(code);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let qrCode: any = cached?.qr ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cachedExtras: any = cached?.extras ?? null;

  if (!qrCode) {
    // Cache miss — minimal scalar lookup first (indexed, ~0.1ms)
    qrCode = await prisma.qRCode.findUnique({
      where: { code },
      select: qrMinimalSelect,
    });

    if (!qrCode) {
      return <QrNotActivated code={code} variant="not-found" />;
    }

    // For active non-REDIRECT modes, load relations matching the mode
    if (
      qrCode.isActive &&
      !(qrCode.mode === "REDIRECT" && qrCode.redirectUrl)
    ) {
      const fullQr = await prisma.qRCode.findUnique({
        where: { code },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        include: buildScanInclude(qrCode.mode) as any,
      });
      if (!fullQr) {
        return <QrNotActivated code={code} variant="not-found" />;
      }

      // Pre-compute LANDING extra-module queries so they are cached too (#2)
      if (fullQr.mode === "LANDING" && fullQr.establishment) {
        cachedExtras = await computeLandingExtras(fullQr);
      }

      qrCode = fullQr;
      if (qrCode.isActive) {
        setScanCache(code, { qr: qrCode, extras: cachedExtras }, qrCode.establishmentId).catch(() => {});
      }
    }
  }

  if (!qrCode) {
    return <QrNotActivated code={code} variant="not-found" />;
  }

  if (!qrCode.isActive) {
    if (qrCode.source === "MARKETPLACE" && qrCode.batchId) {
      return <QrNotActivated code={code} variant="marketplace" />;
    }
    if (qrCode.source !== "DASHBOARD") {
      redirect(`/activate/${code}`);
    }
  }

  const scanHeaders = await headers();

  const incrementScan = () => {
    recordQrScan({
      qrCodeId: qrCode.id,
      establishmentId: qrCode.establishmentId,
      headers: scanHeaders,
    });
  };

  // REDIRECT: fast path — no relations loaded, just bounce
  if (qrCode.mode === "REDIRECT" && qrCode.redirectUrl) {
    incrementScan();
    redirect(qrCode.redirectUrl);
  }

  const est = qrCode.establishment;
  const rawMenu = resolveMenu(est, qrCode);
  const businessCard = resolveBusinessCard(est, qrCode);
  const wifiConfig = resolveWifiConfig(est, qrCode);

  if (qrCode.mode === "FILE") {
    if (!qrCode.fileAsset) {
      return <ScanEmptyState emoji="📁" title="Файл не загружен" desc="Владелец ещё не прикрепил документ к этому QR-коду." />;
    }
    incrementScan();
    const fileBrand = resolveBrandSettings(est ?? {});
    const FileDownloadView = (await import("@/components/scan/FileDownloadView")).default;
    return (
      <FileDownloadView
        file={JSON.parse(JSON.stringify(qrCode.fileAsset))}
        establishmentName={est?.name}
        brandColor={fileBrand.brandColor}
        pageAppearance={fileBrand.pageAppearance}
      />
    );
  }

  if (!est) {
    if (qrCode.source === "DASHBOARD") {
      return <ScanEmptyState emoji="⚙️" title="QR-код настроен" desc="Привяжите заведение в настройках QR-кода для отображения контента." />;
    }
    redirect(`/activate/${code}`);
  }

  const brand = resolveBrandSettings(est);
  const brandProps = {
    brandColor: brand.brandColor,
    pageAppearance: brand.pageAppearance,
  };

  const sub = est.user.subscriptions[0];
  const isPro = sub?.plan === "PRO" || sub?.plan === "NETWORK";
  let promoCode: string | undefined;
  if (isPro && est.promocodes.length > 0) {
    promoCode = est.promocodes[0].code;
  }
  const reviewRouting = isPro
    ? parseReviewRouting(est.reviewRouting)
    : DEFAULT_REVIEW_ROUTING;
  const platformUrls = {
    yandexMapsUrl: est.yandexMapsUrl,
    twoGisUrl: est.twoGisUrl,
    avitoUrl: est.avitoUrl,
  };
  const reviewProps = {
    establishmentName: est.name,
    establishmentId: est.id,
    qrCodeId: qrCode.id,
    reviewRouting,
    platformUrls,
    watermarkEnabled: isPro ? !est.watermarkEnabled : true,
    showPromo: isPro && !!promoCode,
    promoCode,
  };

  const pdConsent = {
    ready: !!(est.legalName && est.inn),
    policyUrl: `/privacy/${est.id}`,
  };

  if (qrCode.mode === "LANDING") {
    incrementScan();
    const MicroLandingView = (await import("@/components/scan/MicroLandingView")).default;
    const pageModules = parsePageModules(est.pageModules);
    const moduleOrder = parseModuleOrder(est.moduleOrder);
    const moduleLabels = parseModuleLabels(est.moduleLabels);
    const moduleIcons = parseModuleIcons(est.moduleIcons);
    const moduleTypes = parseModuleTypes(est.moduleTypes);
    const safeCard = businessCard
      ? {
          id: businessCard.id,
          fullName: businessCard.fullName,
          title: businessCard.title,
          company: businessCard.company,
          phone: businessCard.phone,
          email: businessCard.email,
          website: businessCard.website,
          address: businessCard.address,
          about: businessCard.about,
          avatarUrl: businessCard.avatarUrl,
          socialLinks: (businessCard.socialLinks as { type: string; url: string }[]) || [],
          accentColor: businessCard.accentColor,
          tipsUrl: businessCard.tipsUrl,
          tipsLabel: businessCard.tipsLabel,
        }
      : null;

    // Use cached extras when available (#2), otherwise compute now
    const extras = cachedExtras ?? await computeLandingExtras(qrCode);
    const extraMenusRaw = extras.menus;
    const extraBusinessCards = extras.businessCards;
    const extraWifiConfigs = extras.wifis;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extraMenus = extraMenusRaw.map((m: any) =>
      JSON.parse(JSON.stringify(sanitizeMenuForClient(m)))
    );
    const menuStub = rawMenu
      ? JSON.parse(JSON.stringify(sanitizeMenuForClient(rawMenu)))
      : null;

    return (
      <MicroLandingView
        establishmentName={est.name}
        establishmentId={est.id}
        qrCodeId={qrCode.id}
        pageModules={pageModules}
        moduleOrder={moduleOrder}
        moduleLabels={moduleLabels}
        moduleIcons={moduleIcons}
        moduleTypes={moduleTypes}
        menu={menuStub}
        businessCard={safeCard}
        wifiConfig={wifiConfig ? JSON.parse(JSON.stringify(wifiConfig)) : null}
        reviewRouting={reviewRouting}
        customPages={JSON.parse(JSON.stringify(est.customPages || []))}
        extraMenus={extraMenus}
        extraBusinessCards={JSON.parse(JSON.stringify(extraBusinessCards.map((bc: Record<string, unknown>) => ({
          id: bc.id,
          fullName: bc.fullName,
          title: bc.title,
          company: bc.company,
          phone: bc.phone,
          email: bc.email,
          website: bc.website,
          address: bc.address,
          about: bc.about,
          avatarUrl: bc.avatarUrl,
          socialLinks: bc.socialLinks || [],
          accentColor: bc.accentColor,
          tipsUrl: bc.tipsUrl,
          tipsLabel: bc.tipsLabel,
        }))))}
        extraWifiConfigs={JSON.parse(JSON.stringify(extraWifiConfigs))}
        forms={JSON.parse(JSON.stringify(est.forms || []))}
        platformUrls={platformUrls}
        watermarkEnabled={reviewProps.watermarkEnabled}
        showPromo={reviewProps.showPromo}
        promoCode={promoCode}
        pdConsent={pdConsent}
        {...brandProps}
        logoUrl={est.logoUrl}
        coverUrl={est.coverUrl}
        landingSubtitle={est.landingSubtitle}
        address={est.address}
        phone={est.phone}
        yandexMapsUrl={est.yandexMapsUrl}
        workingHours={est.workingHours}
        tipsConfig={(() => {
          const tips = resolveTipsConfig(est, qrCode);
          if (!tips) return undefined;
          return {
            tipsType: tips.tipsType,
            tipsPhone: tips.tipsPhone,
            tipsBankName: tips.tipsBankName,
            tipsUrl: tips.tipsUrl,
            employees:
              tips.tipsType === "EMPLOYEES"
                ? JSON.parse(JSON.stringify(est.tipsEmployees || []))
                : undefined,
          };
        })()}
      />
    );
  }

  if (qrCode.mode === "BUSINESS_CARD") {
    if (!businessCard) {
      return <ScanEmptyState emoji="📋" title="Визитка не настроена" desc="Заполните визитку в разделе «Моя страница»." />;
    }
    incrementScan();
    const bc = businessCard;
    const BusinessCardView = (await import("@/components/scan/BusinessCardView")).default;
    return (
      <BusinessCardView
        card={{
          id: bc.id,
          fullName: bc.fullName,
          title: bc.title,
          company: bc.company,
          phone: bc.phone,
          email: bc.email,
          website: bc.website,
          address: bc.address,
          about: bc.about,
          avatarUrl: bc.avatarUrl,
          socialLinks: (bc.socialLinks as { type: string; url: string }[]) || [],
          accentColor: bc.accentColor,
          tipsUrl: bc.tipsUrl,
          tipsLabel: bc.tipsLabel,
        }}
        qrCode={code}
        showContactForm={bc.contactEnabled && !!bc.contactMessengerId}
        pdConsent={pdConsent}
        watermarkEnabled={reviewProps.watermarkEnabled}
        {...brandProps}
      />
    );
  }

  if (qrCode.mode === "MENU") {
    if (!rawMenu) {
      return <ScanEmptyState emoji="☕" title="Меню не заполнено" desc="Добавьте позиции в разделе «Моя страница»." />;
    }
    const menuStub = JSON.parse(JSON.stringify(sanitizeMenuForClient(rawMenu))) as import("@/components/dashboard/MenuEditor").MenuData;
    if (!menuHasLandingContent(menuStub)) {
      return <ScanEmptyState emoji="☕" title="Меню не заполнено" desc="Добавьте позиции в разделе «Моя страница»." />;
    }
    incrementScan();
    const menuProps = {
      establishmentName: est?.name ?? "",
      establishmentId: est?.id ?? "",
      qrCodeId: qrCode.id,
      qrLabel: qrCode.label?.trim() || qrCode.code,
      pdConsent,
      watermarkEnabled: reviewProps.watermarkEnabled,
      ...brandProps,
    };
    if (menuNeedsDeferredLoad(menuStub)) {
      const LazyMenuView = (await import("@/components/scan/LazyMenuView")).default;
      return <LazyMenuView menuStub={menuStub} loadImmediately {...menuProps} />;
    }
    const MenuView = (await import("@/components/scan/MenuView")).default;
    return <MenuView menu={menuStub} {...menuProps} />;
  }

  if (qrCode.mode === "WIFI") {
    if (!wifiConfig) {
      return <ScanEmptyState emoji="📶" title="Wi-Fi не настроен" desc="Настройте Wi-Fi в разделе «Моя страница»." />;
    }
    incrementScan();
    const WifiConnect = (await import("@/components/scan/WifiConnect")).default;
    return (
      <WifiConnect
        wifiConfig={JSON.parse(JSON.stringify(wifiConfig))}
        watermarkEnabled={reviewProps.watermarkEnabled}
        {...brandProps}
      />
    );
  }

  if (qrCode.mode === "TIPS") {
    incrementScan();
    const tips = resolveTipsConfig(est, qrCode);
    if (!tips?.tipsType) {
      return (
        <ScanEmptyState
          emoji="💰"
          title="Чаевые не настроены"
          desc="Настройте чаевые в разделе «Моя страница» → блок «Чаевые»."
        />
      );
    }

    if (tips.tipsType === "EMPLOYEES") {
      const employees = est.tipsEmployees || [];
      if (employees.length === 0) {
        return (
          <ScanEmptyState
            emoji="👥"
            title="Список сотрудников пуст"
            desc="Добавьте сотрудников в разделе «Моя страница» → «Чаевые»."
          />
        );
      }
      const TipsEmployeesView = (await import("@/components/scan/TipsEmployeesView")).default;
      return (
        <TipsEmployeesView
          employees={JSON.parse(JSON.stringify(employees))}
          establishmentName={est.name}
          {...brandProps}
        />
      );
    }

    const TipsView = (await import("@/components/scan/TipsView")).default;
    return (
      <TipsView
        tipsType={tips.tipsType as "REDIRECT" | "PHONE"}
        redirectUrl={tips.tipsType === "REDIRECT" ? tips.tipsUrl : null}
        tipsPhone={tips.tipsPhone}
        tipsBankName={tips.tipsBankName}
        establishmentName={est.name}
        {...brandProps}
      />
    );
  }

  if (qrCode.mode === "FORM") {
    if (!qrCode.form) {
      return <ScanEmptyState emoji="📝" title="Форма не настроена" desc="Владелец ещё не привязал форму к этому QR-коду." />;
    }
    incrementScan();
    const FormView = (await import("@/components/scan/FormView")).default;
    return (
      <FormView
        form={JSON.parse(JSON.stringify(qrCode.form))}
        qrCodeId={qrCode.id}
        pdConsent={pdConsent}
        {...brandProps}
      />
    );
  }

  if (qrCode.mode === "CUSTOM_SECTION") {
    if (!qrCode.customPage) {
      return <ScanEmptyState emoji="📄" title="Страница не найдена" desc="Кастомная страница была удалена." />;
    }
    incrementScan();
    const cp = qrCode.customPage;
    if (cp.type === "LINK" && cp.url) {
      redirect(cp.url);
    }
    if (cp.type === "FILE") {
      if (!cp.fileAsset) {
        return (
          <ScanEmptyState
            emoji="📁"
            title="Файл не загружен"
            desc="Владелец ещё не прикрепил документ к этой странице."
          />
        );
      }
      const FileDownloadView = (await import("@/components/scan/FileDownloadView")).default;
      return (
        <FileDownloadView
          file={JSON.parse(JSON.stringify(cp.fileAsset))}
          establishmentName={est.name}
          {...brandProps}
        />
      );
    }
    const CustomPageView = (await import("@/components/scan/CustomPageView")).default;
    return (
      <CustomPageView
        title={cp.title}
        content={cp.content}
        {...brandProps}
      />
    );
  }

  incrementScan();
  const ScanFlow = (await import("@/components/scan/ScanFlow")).default;
  return <ScanFlow {...reviewProps} {...brandProps} pdConsent={pdConsent} />;
}

function ScanEmptyState({
  emoji,
  title,
  desc,
}: {
  emoji: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <div className="text-5xl">{emoji}</div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-500">{desc}</p>
      </div>
    </div>
  );
}

function QrNotActivated({
  code,
  variant,
}: {
  code: string;
  variant: "not-found" | "marketplace";
}) {
  const isMarketplace = variant === "marketplace";
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="3" height="3" rx="0.5" />
                <rect x="19" y="14" width="2" height="2" rx="0.5" />
                <rect x="14" y="19" width="2" height="2" rx="0.5" />
                <rect x="18" y="19" width="3" height="2" rx="0.5" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">QR Stars</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Top accent */}
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />

          <div className="p-8 text-center">
            {/* Icon */}
            <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-100 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-amber-500" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>

            <h1 className="text-xl font-bold text-gray-900 mb-2">
              {isMarketplace ? "Табличка не активирована" : "QR-код не активирован"}
            </h1>
            <p className="text-sm text-gray-500 mb-1">
              Код: <span className="font-mono text-gray-700">{code}</span>
            </p>
          </div>

          {/* Instructions */}
          <div className="mx-6 mb-6 rounded-xl bg-indigo-50 border border-indigo-100 p-4">
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">Как активировать</p>
            <ol className="space-y-2 text-sm text-indigo-900">
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center">1</span>
                <span>Найдите <strong>мастер-код</strong> — он вложен в комплект с табличкой</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center">2</span>
                <span>Войдите или зарегистрируйтесь в личном кабинете</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center">3</span>
                <span>Введите мастер-код на странице активации</span>
              </li>
            </ol>
          </div>

          <div className="px-6 pb-6">
            <a
              href="https://app.qrstars.ru/dashboard/activate"
              className="block w-full text-center py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shadow-sm"
            >
              Активировать в личном кабинете
            </a>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Нет аккаунта?{" "}
          <a href="https://app.qrstars.ru/register" className="text-indigo-500 hover:text-indigo-600 underline underline-offset-2">
            Зарегистрируйтесь бесплатно
          </a>
        </p>
      </div>
    </div>
  );
}

