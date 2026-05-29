import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { DEFAULT_REVIEW_ROUTING, parseReviewRouting } from "@/lib/review-routing";
import { parsePageModules, parseModuleOrder, parseModuleLabels, parseModuleIcons, parseModuleTypes } from "@/lib/page-modules";
import { resolveMenu, resolveBusinessCard, resolveWifiConfig } from "@/lib/establishment-content";
import { resolveBrandSettings } from "@/lib/brand-theme";
import { sanitizeMenuForClient } from "@/lib/iiko/sanitize-menu";
import { getSlugPageCache, setSlugPageCache } from "@/lib/cache";
import type { Metadata } from "next";
import type { ComponentProps } from "react";
import type MicroLandingView from "@/components/scan/MicroLandingView";

interface SlugPageProps {
  params: Promise<{ slug: string }>;
}

type SlugLandingProps = ComponentProps<typeof MicroLandingView>;

const establishmentContentInclude = {
  menu: { include: { items: { orderBy: { order: "asc" as const } } } },
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
} as const;

export async function generateMetadata({ params }: SlugPageProps): Promise<Metadata> {
  const { slug } = await params;
  const cached = await getSlugPageCache<{ establishmentName: string }>(slug);
  if (cached?.establishmentName) {
    return { title: cached.establishmentName };
  }
  const est = await prisma.establishment.findUnique({
    where: { shortSlug: slug },
    select: { name: true },
  });
  return { title: est?.name ?? "Страница заведения" };
}

async function buildSlugLandingProps(slug: string): Promise<SlugLandingProps | null> {
  const est = await prisma.establishment.findUnique({
    where: { shortSlug: slug },
    include: establishmentContentInclude,
  });

  if (!est) return null;

  const brand = resolveBrandSettings(est);
  const brandProps = { brandColor: brand.brandColor, pageAppearance: brand.pageAppearance };

  const sub = est.user.subscriptions[0];
  const isPro = sub?.plan === "PRO" || sub?.plan === "NETWORK";
  let promoCode: string | undefined;
  if (isPro && est.promocodes.length > 0) {
    promoCode = est.promocodes[0].code;
  }

  const reviewRouting = isPro ? parseReviewRouting(est.reviewRouting) : DEFAULT_REVIEW_ROUTING;
  const platformUrls = {
    yandexMapsUrl: est.yandexMapsUrl,
    twoGisUrl: est.twoGisUrl,
    avitoUrl: est.avitoUrl,
  };

  const pageModules = parsePageModules(est.pageModules);
  const moduleOrder = parseModuleOrder(est.moduleOrder);
  const moduleLabels = parseModuleLabels(est.moduleLabels);
  const moduleIcons = parseModuleIcons(est.moduleIcons);
  const moduleTypes = parseModuleTypes(est.moduleTypes);

  const rawMenu = resolveMenu(est, null);
  const businessCard = resolveBusinessCard(est, null);
  const wifiConfig = resolveWifiConfig(est, null);

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

  const extraMenuIds = Object.values(moduleTypes).filter(m => m.type === "menu").map(m => m.instanceId);
  const extraBcIds = Object.values(moduleTypes).filter(m => m.type === "businessCard").map(m => m.instanceId);
  const extraWifiIds = Object.values(moduleTypes).filter(m => m.type === "wifi").map(m => m.instanceId);

  const [extraMenusRaw, extraBusinessCards, extraWifiConfigs] = await Promise.all([
    extraMenuIds.length > 0
      ? prisma.qRMenu.findMany({ where: { id: { in: extraMenuIds } }, include: { items: { orderBy: { order: "asc" } } } })
      : Promise.resolve([]),
    extraBcIds.length > 0
      ? prisma.businessCard.findMany({ where: { id: { in: extraBcIds } } })
      : Promise.resolve([]),
    extraWifiIds.length > 0
      ? prisma.wifiConfig.findMany({ where: { id: { in: extraWifiIds } } })
      : Promise.resolve([]),
  ]);

  const menuForClient = rawMenu
    ? JSON.parse(JSON.stringify(sanitizeMenuForClient(rawMenu)))
    : null;
  const extraMenus = extraMenusRaw.map((m) =>
    JSON.parse(JSON.stringify(sanitizeMenuForClient(m)))
  );

  return {
    establishmentName: est.name,
    establishmentId: est.id,
    qrCodeId: "",
    pageModules,
    moduleOrder,
    moduleLabels,
    moduleIcons,
    moduleTypes,
    menu: menuForClient,
    businessCard: safeCard,
    wifiConfig: wifiConfig ? JSON.parse(JSON.stringify(wifiConfig)) : null,
    reviewRouting,
    customPages: JSON.parse(JSON.stringify(est.customPages || [])),
    extraMenus,
    extraBusinessCards: JSON.parse(JSON.stringify(extraBusinessCards.map((bc: Record<string, unknown>) => ({
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
    })))),
    extraWifiConfigs: JSON.parse(JSON.stringify(extraWifiConfigs)),
    forms: JSON.parse(JSON.stringify(est.forms || [])),
    platformUrls,
    watermarkEnabled: isPro ? !est.watermarkEnabled : true,
    showPromo: isPro && !!promoCode,
    promoCode,
    ...brandProps,
    logoUrl: est.logoUrl,
    coverUrl: est.coverUrl,
    landingSubtitle: est.landingSubtitle,
    address: est.address,
    phone: est.phone,
    yandexMapsUrl: est.yandexMapsUrl,
    workingHours: est.workingHours,
  };
}

export default async function ShortSlugPage({ params }: SlugPageProps) {
  const { slug } = await params;

  let landingProps = await getSlugPageCache<SlugLandingProps>(slug);
  if (!landingProps) {
    landingProps = await buildSlugLandingProps(slug);
    if (!landingProps) {
      notFound();
    }
    setSlugPageCache(slug, landingProps.establishmentId, landingProps).catch(() => {});
  }

  const MicroLandingView = (await import("@/components/scan/MicroLandingView")).default;

  return <MicroLandingView {...landingProps} />;
}
