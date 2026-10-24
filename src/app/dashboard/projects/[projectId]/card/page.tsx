import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { resolveBrandSettings } from "@/lib/brand-theme";
import { isUnassignedProjectId, projectQrcodesPath } from "@/lib/project-routes";
import { normalizeCardServices, parseCardSocialLinks } from "@/lib/business-card";
import ProjectCardEditor from "@/components/dashboard/project/ProjectCardEditor";

/** Доступ к проекту проверяет layout `projects/[projectId]`. */
export default async function ProjectCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { projectId } = await params;
  if (isUnassignedProjectId(projectId)) {
    redirect(projectQrcodesPath(projectId));
  }
  const { welcome } = await searchParams;

  const est = await prisma.establishment.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      brandColor: true,
      pageAppearance: true,
      landingTheme: true,
      businessCard: { include: { contactMessenger: true } },
      qrcodes: {
        where: { mode: "BUSINESS_CARD" },
        select: { id: true, code: true, label: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!est) redirect("/dashboard");

  const brand = resolveBrandSettings(est);
  const card = est.businessCard
    ? JSON.parse(
        JSON.stringify({
          ...est.businessCard,
          socialLinks: parseCardSocialLinks(est.businessCard.socialLinks),
          services: normalizeCardServices(est.businessCard.services),
        }),
      )
    : null;

  return (
    <div className="flex bg-gray-50">
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <ProjectCardEditor
          projectId={est.id}
          initialCard={card}
          brandColor={brand.brandColor}
          pageAppearance={brand.pageAppearance}
          cardQrcodes={est.qrcodes}
          welcome={welcome === "1"}
        />
      </main>
    </div>
  );
}
