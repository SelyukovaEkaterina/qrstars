"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import SupportChat from "@/components/dashboard/SupportChat";
import { Headphones, Loader2 } from "lucide-react";

export default function DashboardSupportPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

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
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Headphones className="w-7 h-7 text-indigo-600" />
              Поддержка
            </h1>
            <p className="text-gray-500 mt-1">
              Задайте вопрос по тарифам, QR-кодам или настройке — ответ придёт сюда
            </p>
          </div>
          <SupportChat className="min-h-[420px]" />
        </div>
      </main>
    </div>
  );
}
