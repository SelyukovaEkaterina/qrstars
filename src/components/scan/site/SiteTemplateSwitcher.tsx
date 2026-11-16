"use client";

import { Moon, Sun } from "lucide-react";
import { SITE_TEMPLATES, type SiteTemplateId } from "@/lib/site-templates";

interface Props {
  template: SiteTemplateId;
  appearance: "light" | "dark";
  onTemplate: (id: SiteTemplateId) => void;
  onAppearance: (a: "light" | "dark") => void;
  /** Ссылка «Хочу такой сайт» (демо). */
  ctaHref?: string;
  ctaLabel?: string;
}

/** Плавающая панель внизу демо-сайта: шаблон и тема. */
export default function SiteTemplateSwitcher({ template, appearance, onTemplate, onAppearance, ctaHref, ctaLabel = "Хочу такой сайт" }: Props) {
  const themeLocked = template === "bold";
  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-gray-950/90 p-1.5 pl-5 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-xl">
      <span className="mr-2 whitespace-nowrap text-xs font-medium text-white/60">Шаблон сайта</span>
      {SITE_TEMPLATES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onTemplate(t.id)}
          title={`${t.description}. Подходит: ${t.bestFor}`}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            t.id === template ? "bg-white text-gray-950" : "text-white/80 hover:bg-white/10"
          }`}
        >
          {t.name}
        </button>
      ))}
      <span className="mx-1.5 h-6 w-px bg-white/15" />
      <button
        type="button"
        disabled={themeLocked}
        onClick={() => onAppearance(appearance === "dark" ? "light" : "dark")}
        title={themeLocked ? "«Контраст» всегда тёмный" : appearance === "dark" ? "Светлая тема" : "Тёмная тема"}
        className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 disabled:opacity-35 disabled:hover:bg-transparent"
      >
        {appearance === "dark" || themeLocked ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>
      {ctaHref && (
        <a
          href={ctaHref}
          className="ml-1 whitespace-nowrap rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-400"
        >
          {ctaLabel}
        </a>
      )}
    </div>
  );
}
