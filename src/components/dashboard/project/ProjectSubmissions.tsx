"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useLockedProjectId } from "@/components/dashboard/ProjectScope";
import { isUnassignedProjectId } from "@/lib/project-routes";
import FormSubmissionsPanel from "@/components/dashboard/FormSubmissionsPanel";
import { Loader2, Inbox } from "lucide-react";

interface EstablishmentOption {
  id: string;
  name: string;
}

export default function SubmissionsPage({ hideHeader = false }: { hideHeader?: boolean }) {
  const { status } = useSession();
  const router = useRouter();
  const lockedProjectId = useLockedProjectId();
  const lockedEstId =
    lockedProjectId && !isUnassignedProjectId(lockedProjectId) ? lockedProjectId : "";
  const [establishments, setEstablishments] = useState<EstablishmentOption[]>([]);
  const [establishmentId, setEstablishmentId] = useState(lockedEstId);
  const [forms, setForms] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;

    fetch("/api/establishments")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.establishments || []).map((e: { id: string; name: string }) => ({
          id: e.id,
          name: e.name,
        }));
        setEstablishments(list);
        if (lockedEstId) setEstablishmentId(lockedEstId);
        else if (list.length > 0) setEstablishmentId(list[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, router, lockedEstId]);

  useEffect(() => {
    if (!establishmentId) return;
    fetch(`/api/forms?establishmentId=${establishmentId}`)
      .then((r) => r.json())
      .then((data) => {
        setForms(
          (data.forms || []).map((f: { id: string; title: string }) => ({
            id: f.id,
            title: f.title,
          }))
        );
      })
      .catch(() => setForms([]));
  }, [establishmentId]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const projectSelect =
    !lockedEstId && establishments.length > 1 ? (
      <select
        value={establishmentId}
        onChange={(e) => setEstablishmentId(e.target.value)}
        aria-label="Проект"
        className="w-full sm:w-auto sm:min-w-[200px] px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {establishments.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
    ) : null;

  const content = (
    <div className="max-w-4xl mx-auto space-y-6">
      {hideHeader ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">Ответы с форм на микросайте</p>
          {projectSelect}
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Inbox className="w-7 h-7 text-indigo-600" />
              Заявки
            </h1>
            <p className="text-gray-500 mt-1">Ответы с форм на микросайте</p>
          </div>
          {projectSelect}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : establishments.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p>Сначала создайте проект.</p>
        </div>
      ) : establishmentId ? (
        <FormSubmissionsPanel
          key={establishmentId}
          establishmentId={establishmentId}
          forms={establishmentId ? forms : []}
        />
      ) : null}
    </div>
  );

  if (hideHeader) return content;

  return (
    <div className="flex bg-gray-50">
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{content}</main>
    </div>
  );
}
