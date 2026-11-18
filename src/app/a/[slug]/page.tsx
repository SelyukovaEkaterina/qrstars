import { notFound } from "next/navigation";
import { toPublicBusinessCard } from "@/lib/business-card";
import prisma from "@/lib/prisma";
import { resolveBrandSettings } from "@/lib/brand-theme";
import { getSlugPageCache, setSlugPageCache } from "@/lib/cache";
import type { Metadata } from "next";
import LandingLockedState from "@/components/scan/LandingLockedState";
import { establishmentCanShowPublicLanding } from "@/lib/qr-mode-access";
import { MICROSITE_HOST_SUFFIX } from "@/lib/microsite-host";
import { resolveCardSiteTemplate } from "@/lib/site-templates";
import { businessCardJsonLd, micrositeJsonLd } from "@/lib/site-seo";
import { absolutePublicUrl } from "@/lib/utils";
import JsonLd from "@/components/scan/site/JsonLd";
import { buildMicrositeLandingProps, type MicrositeLandingProps } from "@/lib/microsite-landing-props";
import { isMetrikaCounterId } from "@/lib/owner-metrika";
import OwnerMetrika from "@/components/scan/OwnerMetrika";
import SiteVisitBeacon from "@/components/scan/SiteVisitBeacon";

interface SlugPageProps {
  params: Promise<{ slug: string }>;
}

type SlugLandingProps = MicrositeLandingProps;

export async function generateMetadata({ params }: SlugPageProps): Promise<Metadata> {
  const { slug } = await params;
  const est = await prisma.establishment.findUnique({
    where: { shortSlug: slug },
    select: {
      name: true,
      landingSubtitle: true,
      coverUrl: true,
      logoUrl: true,
      address: true,
      businessCard: { select: { fullName: true, title: true, avatarUrl: true, serviceArea: true } },
      _count: { select: { qrcodes: { where: { isActive: true, mode: "LANDING" } } } },
    },
  });
  if (!est) return { title: "Страница заведения" };
  const url = `https://${slug}${MICROSITE_HOST_SUFFIX}`;
  const card = est._count.qrcodes === 0 ? est.businessCard : null;
  const title = card ? [card.fullName, card.title].filter(Boolean).join(" — ") : est.name;
  const description = card
    ? [card.title ? `${card.title}: телефон, услуги и цены, заявка онлайн` : "Контакты, услуги и цены", card.serviceArea].filter(Boolean).join(" · ")
    : [est.landingSubtitle?.trim() || `${est.name}: меню, контакты, часы работы и отзывы`, est.address].filter(Boolean).join(" · ");
  const image = absolutePublicUrl(card?.avatarUrl || est.coverUrl || est.logoUrl);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: card ? "profile" : "website", ...(image ? { images: [image] } : {}) },
  };
}

export default async function ShortSlugPage({ params }: SlugPageProps) {
  const { slug } = await params;

  const estAccess = await prisma.establishment.findUnique({
    where: { shortSlug: slug },
    select: {
      id: true,
      metrikaCounterId: true,
      user: { include: { subscriptions: { where: { status: "ACTIVE" }, take: 1 } } },
    },
  });
  if (!estAccess) {
    notFound();
  }
  const sub = estAccess.user.subscriptions[0];
  const isPro = sub?.plan === "PRO" || sub?.plan === "NETWORK";
  const allowed = await establishmentCanShowPublicLanding(estAccess.id, isPro);
  if (!allowed) {
    return <LandingLockedState />;
  }

  // Заходы по короткому адресу: свой счётчик в «Статистике» + Метрика владельца (PRO).
  const counterId = isPro && isMetrikaCounterId(estAccess.metrikaCounterId) ? estAccess.metrikaCounterId : null;
  const tracking = (
    <>
      <SiteVisitBeacon slug={slug} />
      {counterId && <OwnerMetrika counterId={counterId} source="direct" />}
    </>
  );

  // Проект-визитка (визитка есть, микросайта нет): короткий адрес открывает саму визитку.
  const cardPage = await renderBusinessCardForSlug(slug, isPro);
  if (cardPage) {
    return (
      <>
        {cardPage}
        {tracking}
      </>
    );
  }

  let landingProps = await getSlugPageCache<SlugLandingProps>(slug);
  if (!landingProps) {
    landingProps = await buildMicrositeLandingProps({ shortSlug: slug });
    if (!landingProps) {
      notFound();
    }
    setSlugPageCache(slug, landingProps.establishmentId, landingProps).catch(() => {});
  }

  const MicroLandingView = (await import("@/components/scan/MicroLandingView")).default;

  return (
    <>
      <JsonLd
        data={micrositeJsonLd({
          name: landingProps.establishmentName,
          url: `https://${slug}${MICROSITE_HOST_SUFFIX}`,
          description: landingProps.landingSubtitle,
          image: absolutePublicUrl(landingProps.coverUrl || landingProps.logoUrl),
          address: landingProps.address,
          telephone: landingProps.phone,
          workingHours: landingProps.workingHours,
          sameAs: [landingProps.platformUrls.yandexMapsUrl, landingProps.platformUrls.twoGisUrl],
        })}
      />
      <MicroLandingView {...landingProps} />
      {tracking}
    </>
  );
}

async function renderBusinessCardForSlug(slug: string, isPro: boolean) {
  const est = await prisma.establishment.findUnique({
    where: { shortSlug: slug },
    include: {
      businessCard: true,
      qrcodes: {
        where: { isActive: true, mode: { in: ["LANDING", "BUSINESS_CARD"] } },
        select: { code: true, mode: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!est?.businessCard) return null;
  if (est.qrcodes.some((q) => q.mode === "LANDING")) return null;
  const cardQr = est.qrcodes.find((q) => q.mode === "BUSINESS_CARD");
  if (!cardQr) return null;

  const bc = est.businessCard;
  const brand = resolveBrandSettings(est);
  const BusinessCardView = (await import("@/components/scan/BusinessCardView")).default;
  const publicCard = toPublicBusinessCard(bc);
  return (
    <>
    <JsonLd
      data={businessCardJsonLd({
        fullName: publicCard.fullName,
        url: `https://${slug}${MICROSITE_HOST_SUFFIX}`,
        title: publicCard.title,
        about: publicCard.about,
        image: absolutePublicUrl(publicCard.avatarUrl),
        telephone: publicCard.phone,
        email: publicCard.email,
        address: publicCard.address,
        serviceArea: publicCard.serviceArea,
        services: publicCard.services,
        sameAs: [publicCard.website, publicCard.reviewsUrl, ...publicCard.socialLinks.map((l) => l.url)],
      })}
    />
    <BusinessCardView
      card={publicCard}
      shareUrl={`https://${slug}${MICROSITE_HOST_SUFFIX}`}
      qrCode={cardQr.code}
      showContactForm={bc.contactEnabled && !!bc.contactMessengerId}
      pdConsent={{ ready: !!(est.legalName && est.inn), policyUrl: `/privacy/${est.id}` }}
      watermarkEnabled={isPro ? !est.watermarkEnabled : true}
      brandColor={brand.brandColor}
      pageAppearance={brand.pageAppearance}
      site={{
        template: resolveCardSiteTemplate(est.siteTemplate, est.industry, isPro),
        watermark: isPro && est.watermarkEnabled ? "none" : "promo",
        publicUrl: `https://${slug}${MICROSITE_HOST_SUFFIX}`,
      }}
    />
    </>
  );
}
