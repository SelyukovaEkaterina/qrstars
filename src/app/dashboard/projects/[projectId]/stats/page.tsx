import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sessionUserId } from "@/lib/session-user";
import { canAccessAnalytics, requireEstablishmentAccess } from "@/lib/establishment-access";
import { isUnassignedProjectId, projectQrcodesPath } from "@/lib/project-routes";
import EnhancedAnalytics from "@/components/dashboard/EnhancedAnalytics";
import BasicAnalytics from "@/components/dashboard/BasicAnalytics";
import Link from "next/link";
import { Crown } from "lucide-react";

export default async function ProjectStatsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = sessionUserId(session);
  if (!userId) redirect("/login?session=expired");

  const { projectId } = await params;
  if (isUnassignedProjectId(projectId)) {
    redirect(projectQrcodesPath(projectId));
  }

  const access = await requireEstablishmentAccess(userId, projectId);
  if (!access.ok) notFound();

  const [establishment, isPro] = await Promise.all([
    prisma.establishment.findUnique({
      where: { id: projectId },
      include: { reviews: true, qrcodes: true },
    }),
    canAccessAnalytics(userId),
  ]);
  if (!establishment) notFound();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Статистика</h1>
            <p className="text-gray-500 mt-1">Сканирования, переходы и оценки проекта</p>
          </div>
          {isPro ? (
            <EnhancedAnalytics lockedEstablishmentId={projectId} />
          ) : (
            <>
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Crown className="w-5 h-5" />
                      Расширенная статистика — на PRO
                    </h2>
                    <p className="text-indigo-100 mt-1 text-sm">
                      Детализация по устройствам, регионам и выгрузка CSV
                    </p>
                  </div>
                  <Link
                    href="/dashboard/subscription"
                    className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
                  >
                    Подключить PRO
                  </Link>
                </div>
              </div>
              <BasicAnalytics
                lockedEstablishmentId={projectId}
                establishments={[
                  {
                    id: establishment.id,
                    name: establishment.name,
                    reviews: establishment.reviews.map((r) => ({
                      id: r.id,
                      rating: r.rating,
                      comment: r.comment,
                      isNegative: r.isNegative,
                      qrCodeId: r.qrCodeId,
                      createdAt: r.createdAt.toISOString(),
                    })),
                    qrcodes: establishment.qrcodes.map((q) => ({
                      id: q.id,
                      code: q.code,
                      label: q.label,
                      mode: q.mode,
                      scansCount: q.scansCount,
                    })),
                  },
                ]}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
