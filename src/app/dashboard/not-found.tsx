import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm font-medium text-indigo-600">404</p>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">Страница не найдена</h1>
      <p className="mt-2 max-w-md text-sm text-gray-500">
        Такого раздела в кабинете нет. Вернитесь на сводку или откройте список QR-кодов.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        В кабинет
      </Link>
    </main>
  );
}
