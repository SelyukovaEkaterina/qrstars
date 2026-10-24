import SupportChat from "@/components/dashboard/SupportChat";
import { Headphones, Lightbulb } from "lucide-react";
import Link from "next/link";

/** Авторизацию проверяет dashboard/layout.tsx, здесь своя проверка сессии не нужна. */
export default function DashboardSupportPage() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Headphones className="w-7 h-7 shrink-0 text-indigo-600" />
              Поддержка
            </h1>
            <p className="text-gray-500 mt-1">
              Задайте вопрос по тарифам, QR-кодам или настройке — ответ придёт сюда
            </p>
          </div>
          <SupportChat className="min-h-[420px]" />
          <Link
            href="/dashboard/ideas"
            className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            <Lightbulb className="h-4 w-4" />
            Есть идея? Напишите нам
          </Link>
        </div>
      </main>
    </div>
  );
}
