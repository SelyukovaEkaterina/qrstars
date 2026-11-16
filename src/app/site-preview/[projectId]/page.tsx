import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Metadata } from "next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sessionUserId } from "@/lib/session-user";
import { establishmentAccessWhere, establishmentMicrositeAccess } from "@/lib/establishment-access";
import { isMicrositeFrozen } from "@/lib/qr-mode-access";
import { buildMicrositeLandingProps } from "@/lib/microsite-landing-props";
import { micrositePublicUrl } from "@/lib/project-routes";
import { resolveSiteTemplate } from "@/lib/site-templates";
import { logUserEvent } from "@/lib/user-events-server";
import SitePreviewClient from "./SitePreviewClient";
import { resolveBrandSettings } from "@/lib/brand-theme";
import { toPublicBusinessCard } from "@/lib/business-card";

export const metadata: Metadata = {
  title: "Сайт проекта — превью · QrStars",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ projectId: string }>;
}

/**
 * Превью сайта для компьютера в отдельном окне: владелец переключает шаблоны,
 * тему и вид «компьютер / телефон» на данных своего проекта и сохраняет шаблон.
 * На FREE — тоже открывается (гости сайт не видят, это витрина PRO).
 */
export default async function SitePreviewPage({ params }: Props) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = sessionUserId(session);
  if (!userId) redirect("/login?session=expired");

  const est = await prisma.establishment.findFirst({
    where: { id: projectId, ...establishmentAccessWhere(userId) },
    select: {
      id: true,
      shortSlug: true,
      siteTemplate: true,
      industry: true,
      brandColor: true,
      pageAppearance: true,
      landingTheme: true,
      legalName: true,
      inn: true,
      businessCard: true,
      qrcodes: {
        where: { isActive: true, mode: { in: ["LANDING", "BUSINESS_CARD"] } },
        select: { code: true, mode: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!est) notFound();

  const landingQr = est.qrcodes.find((q) => q.mode === "LANDING")?.code ?? null;
  const cardQr = est.qrcodes.find((q) => q.mode === "BUSINESS_CARD")?.code ?? null;

  // Проект-визитка (визитка есть, микросайта нет) — превью сайта-визитки.
  if (est.businessCard && !landingQr) {
    const access = await establishmentMicrositeAccess(est.id);
    const brand = resolveBrandSettings(est);
    const cardPublicUrl = micrositePublicUrl(est.shortSlug) ?? (cardQr ? `https://app.qrstars.ru/q/${cardQr}` : null);
    logUserEvent(userId, "dash.site_preview_opened", {
      establishmentId: est.id,
      isPro: access.hasPaidFeatures,
      kind: "card",
      template: resolveSiteTemplate(est.siteTemplate, est.industry ?? "SERVICES"),
    });
    return (
      <SitePreviewClient
        kind="card"
        projectId={est.id}
        cardProps={{
          card: JSON.parse(JSON.stringify(toPublicBusinessCard(est.businessCard))),
          // Демо-код: в превью форма работает, но заявка не сохраняется и никуда не уходит.
          qrCode: "demo-master",
          shareUrl: cardPublicUrl ?? undefined,
          showContactForm: est.businessCard.contactEnabled && !!est.businessCard.contactMessengerId,
          pdConsent: { ready: !!(est.legalName && est.inn), policyUrl: `/privacy/${est.id}` },
          brandColor: brand.brandColor,
          pageAppearance: brand.pageAppearance,
          watermarkEnabled: true,
        }}
        cardWatermark={access.hasPaidFeatures ? "none" : "promo"}
        initialTemplate={resolveSiteTemplate(est.siteTemplate, est.industry ?? "SERVICES")}
        templateSaved={!!est.siteTemplate}
        isPro={access.hasPaidFeatures}
        frozen={isMicrositeFrozen(access)}
        publicUrl={cardPublicUrl}
      />
    );
  }

  const [landingProps, access] = await Promise.all([
    buildMicrositeLandingProps({ id: est.id }),
    establishmentMicrositeAccess(est.id),
  ]);
  if (!landingProps) notFound();

  const publicUrl =
    micrositePublicUrl(est.shortSlug) ?? (landingQr ? `https://app.qrstars.ru/q/${landingQr}` : null);

  logUserEvent(userId, "dash.site_preview_opened", {
    establishmentId: est.id,
    isPro: access.hasPaidFeatures,
    template: resolveSiteTemplate(est.siteTemplate, est.industry),
  });

  return (
    <SitePreviewClient
      kind="microsite"
      projectId={est.id}
      landingProps={{ ...landingProps, sitePublicUrl: publicUrl }}
      initialTemplate={resolveSiteTemplate(est.siteTemplate, est.industry)}
      templateSaved={!!est.siteTemplate}
      isPro={access.hasPaidFeatures}
      frozen={isMicrositeFrozen(access)}
      publicUrl={publicUrl}
    />
  );
}
