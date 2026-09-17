"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import SupportChat from "@/components/dashboard/SupportChat";
import { Headphones, Lightbulb, Loader2 } from "lucide-react";
import Link from "next/link";

export default function DashboardSupportPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen bg-gray-50">
          <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
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
          <Link
            href="/dashboard/ideas"
            className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            <Lightbulb className="h-4 w-4" />
            Есть идея? Напишите нам
          </Link>
        </div>
      </main>
    </div>
  );
}
