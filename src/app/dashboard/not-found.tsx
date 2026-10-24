import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <main className="flex min-h-[60vh] min-w-0 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <p className="text-sm font-medium text-indigo-600">404</p>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">Страница не найдена</h1>
      <p className="mt-2 max-w-md text-sm text-gray-500">
        Такого раздела в кабинете нет. Вернитесь на главную кабинета или откройте список проектов —
        QR-коды лежат внутри проекта.
      </p>
      <div className="mt-6 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <Link
          href="/dashboard"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          В кабинет
        </Link>
        <Link
          href="/dashboard/projects"
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Мои проекты
        </Link>
      </div>
    </main>
  );
}
