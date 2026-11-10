import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { parseRestoreCode } from "@/lib/qr-restore";
import IncidentBanner from "@/components/IncidentBanner";
import RememberRestoreCode from "./RememberRestoreCode";

export const metadata: Metadata = {
  title: "Восстановить QR-код — QrStars",
  robots: { index: false },
};

/** Вход в восстановление QR со страницы скана: залогиненного — сразу в форму, остальных — на вход/регистрацию. */
export default async function RestoreEntryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.code) ? params.code[0] : params.code;
  const code = parseRestoreCode(raw);
  const target = code ? `/dashboard/restore?code=${encodeURIComponent(code)}` : "/dashboard/restore";

  const session = await getServerSession(authOptions);
  if (session?.user) redirect(target);

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <RememberRestoreCode code={code} />
      <IncidentBanner restoreHref={null} />
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900">Восстановление QR-кода</h1>
        {code && (
          <p className="mt-3 text-sm text-gray-600">
            ID кода: <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-900">{code}</span>
          </p>
        )}
        <ol className="mt-6 space-y-3 text-sm text-gray-700">
          <li>1. Войдите в кабинет или зарегистрируйтесь заново: аккаунты могли не сохраниться после аварии.</li>
          <li>2. Откроется форма восстановления, ID кода подставится сам.</li>
          <li>3. Укажите, куда должен вести QR, — напечатанная табличка снова заработает.</li>
        </ol>
        <div className="mt-8 space-y-3">
          <a
            href="/register"
            className="block w-full rounded-xl bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Зарегистрироваться
          </a>
          <a
            href="/login"
            className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            У меня есть аккаунт — войти
          </a>
        </div>
      </div>
    </div>
  );
}
