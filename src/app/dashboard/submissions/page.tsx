"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import FormSubmissionsPanel from "@/components/dashboard/FormSubmissionsPanel";
import { Loader2, Inbox } from "lucide-react";

interface EstablishmentOption {
  id: string;
  name: string;
}

export default function SubmissionsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [establishments, setEstablishments] = useState<EstablishmentOption[]>([]);
  const [establishmentId, setEstablishmentId] = useState("");
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
        if (list.length > 0) setEstablishmentId(list[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, router]);

  useEffect(() => {
    if (!establishmentId) {
      setForms([]);
      return;
    }
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
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Inbox className="w-7 h-7 text-indigo-600" />
                Заявки
              </h1>
              <p className="text-gray-500 mt-1">
                Ответы гостей из форм на микро-лендинге
              </p>
            </div>
            {establishments.length > 1 && (
              <select
                value={establishmentId}
                onChange={(e) => setEstablishmentId(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]"
              >
                {establishments.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : establishments.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p>Сначала создайте заведение в разделе «Заведения».</p>
            </div>
          ) : establishmentId ? (
            <FormSubmissionsPanel
              key={establishmentId}
              establishmentId={establishmentId}
              forms={forms}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}
