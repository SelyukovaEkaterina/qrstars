"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useLockedProjectId } from "@/components/dashboard/ProjectScope";
import { isUnassignedProjectId, projectQrcodesPath } from "@/lib/project-routes";
import ProjectForms from "@/components/dashboard/project/ProjectForms";

function ProjectFormsContent() {
  const projectId = useLockedProjectId();

  if (!projectId) return null;
  if (isUnassignedProjectId(projectId)) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-gray-600">
          Формы доступны внутри проекта.{" "}
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
        <div className="mx-auto max-w-5xl">
          <ProjectForms projectId={projectId} />
        </div>
      </main>
    </div>
  );
}

export default function ProjectFormsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectFormsContent />
    </Suspense>
  );
}
