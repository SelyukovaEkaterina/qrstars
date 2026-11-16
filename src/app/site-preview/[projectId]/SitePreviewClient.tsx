"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, Loader2, Monitor, Moon, Smartphone, Sun } from "lucide-react";
import MicroLandingView from "@/components/scan/MicroLandingView";
import BusinessCardView from "@/components/scan/BusinessCardView";
import type { MicrositeLandingProps } from "@/lib/microsite-landing-props";
import { SITE_TEMPLATES, siteTemplateInfo, type SiteTemplateId } from "@/lib/site-templates";

type CardViewProps = Omit<React.ComponentProps<typeof BusinessCardView>, "site">;

interface CommonProps {
  projectId: string;
  initialTemplate: SiteTemplateId;
  templateSaved: boolean;
  isPro: boolean;
  frozen: boolean;
  publicUrl: string | null;
}

type Props =
  | (CommonProps & { kind: "microsite"; landingProps: MicrositeLandingProps })
  | (CommonProps & { kind: "card"; cardProps: CardViewProps; cardWatermark: "none" | "promo" });

type Device = "desktop" | "mobile";

export default function SitePreviewClient(props: Props) {
  const { projectId, initialTemplate, templateSaved, isPro, frozen, publicUrl } = props;
  const isCard = props.kind === "card";
  const basePageAppearance = props.kind === "card" ? props.cardProps.pageAppearance : props.landingProps.pageAppearance;
  const initialAppearance: "light" | "dark" = basePageAppearance === "dark" ? "dark" : "light";
  const [template, setTemplate] = useState<SiteTemplateId>(initialTemplate);
  const [appearance, setAppearance] = useState<"light" | "dark">(initialAppearance);
  const [saved, setSaved] = useState({ template: templateSaved ? initialTemplate : null, appearance: initialAppearance });
  const [device, setDevice] = useState<Device>("desktop");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  const dirty = template !== saved.template || appearance !== saved.appearance;
  const info = siteTemplateInfo(template);
  const themeLocked = template === "bold";

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const body: Record<string, string> = { siteTemplate: template };
      if (appearance !== saved.appearance) body.pageAppearance = appearance;
      const res = await fetch(`/api/establishments/${projectId}/page`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(json?.error || "Не удалось сохранить. Попробуйте ещё раз.");
        return;
      }
      setSaved({ template, appearance });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch {
      setError("Нет связи с сервером. Попробуйте ещё раз.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {device === "desktop" ? (
        props.kind === "card" ? (
          <BusinessCardView
            {...props.cardProps}
            pageAppearance={appearance}
            site={{ template, watermark: props.cardWatermark, publicUrl, mode: "desktop" }}
          />
        ) : (
          <MicroLandingView
            {...props.landingProps}
            siteMode="desktop"
            siteTemplate={template}
            pageAppearance={appearance}
          />
        )
      ) : (
        <div className="flex min-h-screen items-start justify-center px-6 pb-40 pt-10">
          <div className="w-[390px] shrink-0 rounded-[2.75rem] bg-gray-900 p-3 shadow-2xl">
            <div className="flex h-[780px] flex-col overflow-y-auto overflow-x-hidden rounded-[2.1rem] bg-white">
              {props.kind === "card" ? (
                <BusinessCardView {...props.cardProps} pageAppearance={appearance} />
              ) : (
                <MicroLandingView {...props.landingProps} embedded siteMode="mobile" pageAppearance={appearance} />
              )}
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-5 left-1/2 z-50 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col items-center gap-2">
        <div className="rounded-full bg-white/95 px-4 py-1.5 text-xs text-gray-700 shadow-lg ring-1 ring-black/5 backdrop-blur">
          {device === "desktop" ? (
            <>
              <b className="text-gray-900">{info.name}</b> — {info.description.toLowerCase()}. Подходит: {info.bestFor}
            </>
          ) : (
            <>На телефоне гости видят {isCard ? "визитку" : "микросайт"} — шаблон влияет только на версию для компьютера</>
          )}
        </div>
        {!isPro && !frozen && (
          <div className="rounded-full bg-amber-50 px-4 py-1.5 text-xs text-amber-900 shadow-lg ring-1 ring-amber-200">
            {isCard
              ? "Сайт-визитка уже работает: на FREE — шаблон «Классика» и плашка QrStars. Другие шаблоны, свой адрес и без плашки — на PRO."
              : "Это превью: гости увидят сайт, когда подключите PRO — он входит в тариф вместе с микросайтом."}{" "}
            <Link href="/dashboard/subscription" data-upsell="site_preview" className="font-semibold underline">
              Подключить PRO
            </Link>
          </div>
        )}
        {frozen && (
          <div className="rounded-full bg-amber-50 px-4 py-1.5 text-xs text-amber-900 shadow-lg ring-1 ring-amber-200">
            Платный доступ закончился: сайт работает, но менять шаблон можно только на PRO.{" "}
            <Link href="/dashboard/subscription" data-upsell="site_preview_frozen" className="font-semibold underline">
              Продлить
            </Link>
          </div>
        )}
        {error && (
          <div className="rounded-full bg-red-50 px-4 py-1.5 text-xs font-medium text-red-700 shadow-lg ring-1 ring-red-200">{error}</div>
        )}

        <div className="flex items-center gap-1 rounded-full bg-gray-950/92 p-1.5 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-xl">
          <Link
            href={`/dashboard/projects/${projectId}/${isCard ? "card" : "page"}`}
            title={isCard ? "Вернуться в редактор визитки" : "Вернуться в редактор микросайта"}
            className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-white/75 transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" /> Кабинет
          </Link>
          <span className="mx-1 h-6 w-px bg-white/15" />

          {device === "desktop" && (
            <>
              {SITE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplate(t.id)}
                  className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                    t.id === template ? "bg-white text-gray-950" : "text-white/80 hover:bg-white/10"
                  }`}
                >
                  {t.name}
                </button>
              ))}
              <span className="mx-1 h-6 w-px bg-white/15" />
            </>
          )}

          <button
            type="button"
            disabled={device === "desktop" && themeLocked}
            onClick={() => setAppearance(appearance === "dark" ? "light" : "dark")}
            title={
              device === "desktop" && themeLocked
                ? "«Контраст» всегда тёмный"
                : "Светлая / тёмная тема (меняется и у мобильной версии)"
            }
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 disabled:opacity-35"
          >
            {appearance === "dark" || (device === "desktop" && themeLocked) ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>

          <div className="ml-1 flex rounded-full bg-white/10 p-0.5">
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              title="Компьютер"
              className={`flex h-8 w-9 items-center justify-center rounded-full transition-colors ${device === "desktop" ? "bg-white text-gray-950" : "text-white/75"}`}
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDevice("mobile")}
              title="Телефон"
              className={`flex h-8 w-9 items-center justify-center rounded-full transition-colors ${device === "mobile" ? "bg-white text-gray-950" : "text-white/75"}`}
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>

          {publicUrl && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Открыть опубликованный сайт"
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/10"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}

          <button
            type="button"
            onClick={save}
            disabled={saving || frozen || !dirty}
            className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-full bg-indigo-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-400 disabled:bg-white/10 disabled:text-white/50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : justSaved ? (
              <Check className="h-4 w-4" />
            ) : null}
            {justSaved ? "Сохранено" : dirty ? "Сохранить" : "Сохранён"}
          </button>
        </div>
      </div>
    </div>
  );
}
