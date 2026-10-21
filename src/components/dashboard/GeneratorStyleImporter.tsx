"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Palette, X } from "lucide-react";
import { GENERATOR_STYLE_PARAM, GENERATOR_STYLE_STORAGE_KEY } from "@/lib/generator-style-keys";

/** Шаблоны изменились вне страницы шаблонов — список нужно перечитать. */
export const TEMPLATES_CHANGED_EVENT = "qrstars:templates-changed";

type ReadableParams = { get(name: string): string | null };

/** Запомнить `?qr_style=` до регистрации/входа: OAuth уводит со страницы, query теряется. */
export function rememberGeneratorStyle(searchParams: ReadableParams) {
  const style = searchParams.get(GENERATOR_STYLE_PARAM);
  if (!style) return;
  try {
    localStorage.setItem(GENERATOR_STYLE_STORAGE_KEY, style);
  } catch {
    /* приватный режим — перенос дизайна не критичен */
  }
}

function takeStoredStyle(): string | null {
  try {
    const value = localStorage.getItem(GENERATOR_STYLE_STORAGE_KEY);
    localStorage.removeItem(GENERATOR_STYLE_STORAGE_KEY);
    return value;
  } catch {
    return null;
  }
}

/**
 * Сохраняет дизайн из генератора на лендинге в «Шаблоны оформления».
 * Источник — `?qr_style=` в URL кабинета или значение, запомненное на /register.
 */
export default function GeneratorStyleImporter() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const startedRef = useRef(false);
  const [saved, setSaved] = useState<null | { appliesToFirstQr: boolean }>(null);

  useEffect(() => {
    if (startedRef.current) return;
    const fromUrl = searchParams.get(GENERATOR_STYLE_PARAM);
    const stored = takeStoredStyle();
    const style = fromUrl || stored;
    if (!style) return;
    startedRef.current = true;

    if (fromUrl) {
      const rest = new URLSearchParams(searchParams.toString());
      rest.delete(GENERATOR_STYLE_PARAM);
      const query = rest.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }

    fetch("/api/templates/from-generator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ style }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.template) return;
        setSaved({ appliesToFirstQr: Boolean(data.appliesToFirstQr) });
        window.dispatchEvent(new Event(TEMPLATES_CHANGED_EVENT));
      })
      .catch(() => {});
  }, [searchParams, pathname, router]);

  if (!saved) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-indigo-200 bg-white p-4 shadow-xl sm:inset-x-auto sm:right-6 sm:bottom-6"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        <Palette className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-gray-900">Дизайн из генератора сохранён</p>
        <p className="mt-0.5 text-gray-600">
          {saved.appliesToFirstQr
            ? "Первый QR-код получит этот стиль. Он также лежит в "
            : "Привяжите его к QR-коду в карточке кода. Стиль лежит в "}
          <Link href="/dashboard/settings/templates" className="font-medium text-indigo-600 hover:underline">
            «Шаблонах оформления»
          </Link>
          .
        </p>
      </div>
      <button
        type="button"
        onClick={() => setSaved(null)}
        className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        aria-label="Закрыть"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
