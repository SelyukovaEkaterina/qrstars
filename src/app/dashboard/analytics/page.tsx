import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Sidebar from "@/components/dashboard/Sidebar";
import OverviewTabs from "@/components/dashboard/OverviewTabs";
import Link from "next/link";
import { Crown } from "lucide-react";
import { canAccessAnalytics, establishmentAccessWhere } from "@/lib/establishment-access";
import EnhancedAnalytics from "@/components/dashboard/EnhancedAnalytics";
import BasicAnalytics from "@/components/dashboard/BasicAnalytics";

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as Record<string, unknown>).id as string;

  const [establishments, isPro] = await Promise.all([
    prisma.establishment.findMany({
      where: establishmentAccessWhere(userId),
      include: { reviews: true, qrcodes: true },
    }),
    canAccessAnalytics(userId),
  ]);

  if (isPro) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <OverviewTabs />
            <EnhancedAnalytics />
          </div>
        </main>
      </div>
    );
  }

  const serializedEstablishments = establishments.map((e) => ({
    id: e.id,
    name: e.name,
    reviews: e.reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      isNegative: r.isNegative,
      qrCodeId: r.qrCodeId,
      createdAt: r.createdAt.toISOString(),
    })),
    qrcodes: e.qrcodes.map((q) => ({
      id: q.id,
      code: q.code,
      label: q.label,
      mode: q.mode,
      scansCount: q.scansCount,
    })),
  }));

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <OverviewTabs />

          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Crown className="w-5 h-5" /> Расширенная аналитика
                </h2>
                <p className="mt-1 opacity-90 text-sm">
                  Графики трендов, сравнение периодов, аналитика по дням недели
                  и экспорт отчётов
                </p>
              </div>
              <Link
                href="/dashboard/subscription"
                className="bg-white text-indigo-600 px-6 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition-colors text-center shrink-0"
              >
                Подключить PRO или Сеть
              </Link>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900">
            Базовая аналитика
          </h1>

          <BasicAnalytics establishments={serializedEstablishments} />
        </div>
      </main>
    </div>
  );
}
