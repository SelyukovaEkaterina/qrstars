"use client";

import Link from "next/link";
import { Check, Crown, ExternalLink, Monitor } from "lucide-react";
import Card from "@/components/ui/Card";
import { SITE_TEMPLATES, type SiteTemplateId } from "@/lib/site-templates";
import { buildSiteTokens } from "@/lib/site-theme";

interface Props {
  establishmentId: string;
  value: SiteTemplateId;
  onChange: (id: SiteTemplateId) => void;
  brandColor: string;
  pageAppearance: "light" | "dark";
  disabled?: boolean;
  isPro: boolean;
  /** card — сайт-визитка: на FREE он уже работает в «Классике». */
  kind?: "microsite" | "card";
}

/** Схематичная миниатюра шаблона в цветах проекта. */
function TemplateThumb({ id, brandColor, appearance }: { id: SiteTemplateId; brandColor: string; appearance: "light" | "dark" }) {
  const t = buildSiteTokens(id, brandColor, appearance);
  const line = (w: string, h = 4, color = t.muted, opacity = 0.45) => (
    <div style={{ width: w, height: h, borderRadius: 2, background: color, opacity }} />
  );
  return (
    <div className="aspect-[16/10] w-full overflow-hidden" style={{ background: t.bg }}>
      <div className="flex h-[12%] items-center gap-1 px-2" style={{ borderBottom: `1px solid ${t.border}` }}>
        <div className="h-2 w-2 rounded-full" style={{ background: t.accent }} />
        {line("22%", 3, t.text, 0.7)}
        <div className="ml-auto flex gap-1">
          {line("10px", 2)}
          {line("10px", 2)}
          {line("10px", 2)}
        </div>
      </div>
      {id === "showcase" && (
        <div className="relative h-[58%]" style={{ background: `linear-gradient(135deg, ${t.accent}, #111)` }}>
          <div className="absolute bottom-2 left-2 space-y-1">
            {line("70px", 7, "#fff", 0.95)}
            {line("50px", 3, "#fff", 0.7)}
            <div className="mt-1 h-2 w-8 rounded-full" style={{ background: "#fff" }} />
          </div>
        </div>
      )}
      {id === "classic" && (
        <div className="grid h-[58%] grid-cols-2 items-center gap-2 px-2">
          <div className="space-y-1">
            {line("90%", 6, t.text, 0.85)}
            {line("70%", 3)}
            <div className="mt-1 h-2 w-8 rounded" style={{ background: t.accent }} />
          </div>
          <div className="h-[80%] rounded" style={{ background: `linear-gradient(135deg, ${t.accentSoft}, ${t.accent})` }} />
        </div>
      )}
      {id === "editorial" && (
        <div className="flex h-[58%] flex-col items-center justify-center gap-1">
          {line("60%", 7, t.text, 0.85)}
          {line("40%", 3)}
          <div className="mt-1 h-px w-10" style={{ background: t.accent }} />
        </div>
      )}
      {id === "bold" && (
        <div className="grid h-[58%] grid-cols-[1.4fr_1fr] items-center gap-2 px-2">
          <div className="space-y-1">
            {line("95%", 7, t.text, 0.95)}
            {line("60%", 7, t.text, 0.95)}
            <div className="h-1 w-6 rounded" style={{ background: t.accent }} />
          </div>
          <div className="h-[85%] rounded-md" style={{ background: t.accent }} />
        </div>
      )}
      <div className="grid h-[30%] grid-cols-4 gap-1 px-2 pt-1.5" style={{ background: t.band }}>
        {[0, 1, 2, 3].map((i) =>
          id === "editorial" ? (
            <div key={i} className="space-y-1 pt-1">
              {line("90%", 2, t.text, 0.5)}
              {line("60%", 2)}
            </div>
          ) : (
            <div key={i} className="rounded-sm" style={{ background: t.surface, border: `1px solid ${t.border}` }} />
          )
        )}
      </div>
    </div>
  );
}

export default function SiteTemplatePicker({
  establishmentId,
  value,
  onChange,
  brandColor,
  pageAppearance,
  disabled,
  isPro,
  kind = "microsite",
}: Props) {
  const isCard = kind === "card";
  const previewHref = `/site-preview/${establishmentId}`;
  return (
    <Card>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Monitor className="h-5 w-5 text-gray-500" />
        <h3 className="font-semibold text-gray-900">{isCard ? "Сайт-визитка для компьютера" : "Сайт для компьютера"}</h3>
        {!isPro && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            <Crown className="h-3 w-3" /> PRO
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-gray-500">
        {isCard
          ? "С компьютера ваша визитка открывается как сайт: фото, услуги и цены, отзывы, форма заявки и контакты. Собирается сам из визитки — выберите только подачу."
          : "С компьютера ваш микросайт открывается как полноценный сайт: первый экран, меню, услуги, отзывы и контакты. Собирается сам из того, что вы заполнили, — выберите только подачу."}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SITE_TEMPLATES.map((tpl) => {
          const selected = tpl.id === value;
          return (
            <button
              key={tpl.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(tpl.id)}
              title={`${tpl.description}. Подходит: ${tpl.bestFor}`}
              className={`group relative overflow-hidden rounded-xl border-2 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                selected ? "border-indigo-600 ring-2 ring-indigo-600/20" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <TemplateThumb id={tpl.id} brandColor={brandColor} appearance={pageAppearance} />
              <div className="border-t border-gray-100 bg-white px-2.5 py-2">
                <p className="text-sm font-semibold text-gray-900">{tpl.name}</p>
                <p className="truncate text-[11px] text-gray-500">{tpl.bestFor}</p>
              </div>
              {selected && (
                <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a
          href={previewHref}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
        >
          <ExternalLink className="h-4 w-4" /> Открыть сайт в новом окне
        </a>
        <span className="text-xs text-gray-500">
          Там можно сравнить шаблоны на ваших данных и посмотреть версию для телефона.
        </span>
      </div>
      {!isPro && (
        <p className="mt-3 text-xs text-gray-500">
          {isCard
            ? "На FREE сайт-визитка уже работает — в шаблоне «Классика» и с плашкой QrStars. Другие шаблоны, свой адрес и без плашки — на PRO."
            : "Гости увидят сайт на тарифе PRO — он входит в тариф вместе с микросайтом, без доплат."}{" "}
          <Link href="/dashboard/subscription" className="font-medium text-indigo-600 hover:underline">
            Подробнее о PRO
          </Link>
        </p>
      )}
    </Card>
  );
}
