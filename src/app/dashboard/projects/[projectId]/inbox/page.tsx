"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Inbox, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLockedProjectId } from "@/components/dashboard/ProjectScope";
import { isUnassignedProjectId, projectInboxPath, projectQrcodesPath } from "@/lib/project-routes";
import ProjectReviews from "@/components/dashboard/project/ProjectReviews";
import ProjectSubmissions from "@/components/dashboard/project/ProjectSubmissions";

function ProjectInboxContent() {
  const searchParams = useSearchParams();
  const projectId = useLockedProjectId();
  const tab = searchParams.get("tab") === "submissions" ? "submissions" : "reviews";

  const tabs = useMemo(
    () =>
      projectId && !isUnassignedProjectId(projectId)
        ? [
            {
              id: "reviews" as const,
              href: projectInboxPath(projectId, "reviews"),
              label: "Отзывы и оценки",
              icon: Star,
            },
            {
              id: "submissions" as const,
              href: projectInboxPath(projectId, "submissions"),
              label: "Заявки и вопросы",
              icon: Inbox,
            },
          ]
        : [],
    [projectId],
  );

  if (projectId && isUnassignedProjectId(projectId)) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-gray-600">
          Обратная связь доступна внутри проекта.{" "}
          <Link href={projectQrcodesPath(projectId)} className="text-indigo-600 hover:underline">
            К QR-кодам без проекта
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex bg-gray-50">
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Обратная связь</h1>
            <p className="text-gray-500 mt-1">
              Отзывы, оценки, заявки с форм и вопросы аудитории
            </p>
            <div className="mt-4 flex w-full flex-wrap gap-1 rounded-lg bg-gray-100 p-1 sm:inline-flex sm:w-auto">
              {tabs.map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:flex-none sm:px-4",
                      active
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          {tab === "submissions" ? (
            <ProjectSubmissions hideHeader />
          ) : (
            <ProjectReviews hideHeader />
          )}
        </div>
      </main>
    </div>
  );
}

export default function ProjectInboxPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Загрузка…</div>}>
      <ProjectInboxContent />
    </Suspense>
  );
}
