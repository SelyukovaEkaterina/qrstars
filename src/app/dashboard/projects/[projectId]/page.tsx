import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sessionUserId } from "@/lib/session-user";
import { requireEstablishmentAccess } from "@/lib/establishment-access";
import { isReviewCapableQrMode } from "@/lib/qr-routing";
import {
  UNASSIGNED_PROJECT_ID,
  isUnassignedProjectId,
  micrositePublicUrl,
  projectInboxPath,
  projectPagePath,
  projectQrNewPath,
  projectQrcodesPath,
  projectSettingsPath,
  projectStatsPath,
} from "@/lib/project-routes";
import Card from "@/components/ui/Card";
import {
  ExternalLink,
  Layout,
  MessageSquare,
  Plus,
  QrCode,
  Settings,
  Star,
} from "lucide-react";

export default async function ProjectHomePage({
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
    redirect(projectQrcodesPath(UNASSIGNED_PROJECT_ID));
  }

  const access = await requireEstablishmentAccess(userId, projectId);
  if (!access.ok) notFound();

  const establishment = await prisma.establishment.findUnique({
    where: { id: projectId },
    include: {
      reviews: { orderBy: { createdAt: "desc" }, take: 5 },
      qrcodes: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          code: true,
          label: true,
          isActive: true,
          mode: true,
          scansCount: true,
        },
      },
      _count: { select: { reviews: true } },
    },
  });
  if (!establishment) notFound();

  const totalScans = establishment.qrcodes.reduce((sum, qr) => sum + qr.scansCount, 0);
  const hasReviewQr = establishment.qrcodes.some((qr) => isReviewCapableQrMode(qr.mode));
  const avgRating =
    establishment.reviews.length > 0
      ? (
          establishment.reviews.reduce((sum, review) => sum + review.rating, 0) /
          establishment.reviews.length
        ).toFixed(1)
      : "—";
  const micrositeHref = micrositePublicUrl(establishment.shortSlug);
  const hasMaps = Boolean(establishment.yandexMapsUrl || establishment.twoGisUrl);
  const missingQr = establishment.qrcodes.length === 0;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <main className="flex-1 min-w-0 overflow-x-hidden p-4 sm:p-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{establishment.name}</h1>
              <p className="text-gray-500 mt-1">
                Главная проекта: QR-коды, микросайт и входящая обратная связь
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {micrositeHref && (
                <a
                  href={micrositeHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  Открыть микросайт
                </a>
              )}
              <Link
                href={projectQrNewPath(projectId)}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Новый QR-код
              </Link>
            </div>
          </div>

          {(missingQr || !hasMaps) && (
            <Card className="border-amber-200 bg-amber-50">
              <p className="font-medium text-amber-950">Что настроить дальше</p>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {missingQr && (
                  <li>
                    <Link href={projectQrNewPath(projectId)} className="underline">
                      Создайте первый QR-код
                    </Link>{" "}
                    — для стола, слайда или бейджа.
                  </li>
                )}
                {!hasMaps && (
                  <li>
                    <Link href={projectSettingsPath(projectId)} className="underline">
                      Добавьте ссылки на карты
                    </Link>
                    , если собираете отзывы на Яндекс или 2GIS.
                  </li>
                )}
              </ul>
            </Card>
          )}

          <div className={`grid grid-cols-1 gap-4 ${hasReviewQr ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <QrCode className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totalScans}</p>
                  <p className="text-sm text-gray-500">Сканирований</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-50 rounded-lg">
                  <Layout className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{establishment.qrcodes.length}</p>
                  <p className="text-sm text-gray-500">QR-кодов</p>
                </div>
              </div>
            </Card>
            {hasReviewQr && (
              <Card>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <Star className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{avgRating}</p>
                    <p className="text-sm text-gray-500">
                      Средняя оценка · {establishment._count.reviews}
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href={projectQrcodesPath(projectId)} className="block">
              <Card className="h-full hover:border-indigo-200 transition-colors">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-indigo-600" />
                  QR-коды
                </h2>
                <p className="text-sm text-gray-500 mt-2">
                  Сценарии перехода, оформление и файлы для печати.
                </p>
              </Card>
            </Link>
            <Link href={projectPagePath(projectId)} className="block">
              <Card className="h-full hover:border-indigo-200 transition-colors">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Layout className="h-5 w-5 text-indigo-600" />
                  Микросайт
                </h2>
                <p className="text-sm text-gray-500 mt-2">
                  Блоки, оформление и материалы, которые открываются по QR.
                </p>
              </Card>
            </Link>
            <Link href={projectInboxPath(projectId)} className="block">
              <Card className="h-full hover:border-indigo-200 transition-colors">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-indigo-600" />
                  Обратная связь
                </h2>
                <p className="text-sm text-gray-500 mt-2">
                  Отзывы, оценки, заявки и вопросы с форм.
                </p>
              </Card>
            </Link>
            <Link href={projectStatsPath(projectId)} className="block">
              <Card className="h-full hover:border-indigo-200 transition-colors">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Settings className="h-5 w-5 text-indigo-600" />
                  Статистика и настройки
                </h2>
                <p className="text-sm text-gray-500 mt-2">
                  Сканы по дням, карты, команда и уведомления проекта.
                </p>
              </Card>
            </Link>
          </div>

          {establishment.reviews.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Последние отзывы</h2>
                <Link
                  href={projectInboxPath(projectId, "reviews")}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Все отзывы
                </Link>
              </div>
              <div className="space-y-3">
                {establishment.reviews.map((review) => (
                  <div key={review.id} className="border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                    <p className="text-sm font-medium text-gray-900">
                      {review.rating}★ {review.guestName || "Гость"}
                    </p>
                    {review.comment && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
