"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import MessengerContactsManager from "@/components/dashboard/MessengerContactsManager";
import MonthlyReportSettings from "@/components/dashboard/MonthlyReportSettings";
import AccountSettings from "@/components/dashboard/AccountSettings";
import { Loader2, Wand2 } from "lucide-react";

interface Establishment {
  id: string;
  name: string;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [activeId, setActiveId] = useState("");

  // Авторизацию проверяет dashboard/layout.tsx.
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.establishments?.length > 0) {
          setEstablishments(data.establishments);
          setActiveId(data.establishments[0].id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const current = establishments.find((e) => e.id === activeId);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <main className="flex min-w-0 flex-1 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Аккаунт и уведомления</h1>

          <section id="notification-channels" className="scroll-mt-20 space-y-3">
            {establishments.length > 1 && (
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500">
                  Типы уведомлений для проекта
                </p>
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
                  {establishments.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setActiveId(e.id)}
                      title={e.name}
                      aria-pressed={e.id === activeId}
                      className={`min-h-10 max-w-[14rem] shrink-0 truncate whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        e.id === activeId
                          ? "bg-indigo-600 text-white"
                          : "bg-white text-gray-700 border hover:bg-gray-50"
                      }`}
                    >
                      {e.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {current && (
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-gray-200 bg-white px-4 py-3">
                <p className="min-w-0 text-sm text-gray-600">
                  Площадки для отзывов и команда проекта{" "}
                  <span className="font-medium text-gray-900">«{current.name}»</span> — в его
                  настройках.
                </p>
                <Link
                  href={`/dashboard/projects/${activeId}/settings`}
                  className="inline-flex min-h-10 items-center text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Настройки проекта →
                </Link>
              </div>
            )}

            <MessengerContactsManager
              establishmentId={current?.id ?? null}
              establishmentName={current?.name}
            />
          </section>

          <MonthlyReportSettings />

          <Card className="border-dashed">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Wand2 className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">Пошаговый мастер нового QR-кода</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {current
                      ? "Тот же мастер, что при первом запуске: поможет быстро добавить ещё один QR-код или проект."
                      : "Тот же мастер, что при первом запуске: создаст проект и первый QR-код."}
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/start"
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Открыть мастер
              </Link>
            </div>
          </Card>

          <AccountSettings />
        </div>
      </main>
    </div>
  );
}
