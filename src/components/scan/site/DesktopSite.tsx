"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Clock,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Send,
  Smartphone,
  Star,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { buildSiteTokens, mix, type SiteTokens } from "@/lib/site-theme";
import type { SiteTemplateId } from "@/lib/site-templates";
import { formatHoursStatus, WEEK_DAYS, WEEK_DAY_LABELS, type WeekDay, type WorkingHours } from "@/lib/working-hours";
import type { CardService, CardMessengerKind } from "@/lib/business-card";
import { siteFontVariables } from "./site-fonts";

export interface SiteMenuItem {
  id?: string;
  name: string;
  description: string | null;
  price: string | null;
  weight: string | null;
  category: string | null;
  imageUrl: string | null;
}

export interface SiteModuleLink {
  key: string;
  label: string;
  emoji: string | null;
  Icon: LucideIcon | null;
  href?: string | null;
}

/** Главная кнопка первого экрана: раздел, якорь на странице или внешняя ссылка. */
export interface SiteAction {
  label: string;
  section?: string;
  anchor?: string;
  href?: string;
}

export interface DesktopSiteProps {
  template: SiteTemplateId;
  appearance: "light" | "dark";
  brandColor: string;
  name: string;
  subtitle: string | null;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  mapsUrl?: string | null;
  workingHours: WorkingHours | null;
  platformLinks: { label: string; href: string }[];
  menu: {
    title: string | null;
    description: string | null;
    items: SiteMenuItem[];
    cartEnabled: boolean;
  } | null;
  menuKey: string | null;
  services: CardService[];
  /** `kicker` — подпись блока и пункт меню (по умолчанию «О нас»). */
  about: { title: string; html: string | null; text: string | null; kicker?: string } | null;
  messengers: { kind: CardMessengerKind; href: string }[];
  primaryAction: SiteAction | null;
  modules: SiteModuleLink[];
  reviewKey: string | null;
  onOpenSection: (key: string) => void;
  onHome: () => void;
  /** Открытый раздел (отзыв, форма, полное меню…) — показывается внутри сайта. */
  section: { label: string; node: ReactNode } | null;
  /** Стиль и фон рамки раздела: разделы рисуются в теме микросайта. */
  sectionFrame?: { style: CSSProperties; coverUrl: string | null; overlayStyle: CSSProperties };
  watermark: "none" | "small" | "promo";
  /** Адрес сайта для QR «Откройте на телефоне»; undefined — текущий адрес страницы, null — без QR. */
  publicUrl?: string | null;
  /** Плавающая панель (переключатель шаблонов в демо). */
  overlay?: ReactNode;
}

export const MESSENGER_META: Record<CardMessengerKind, { label: string; Icon: LucideIcon }> = {
  whatsapp: { label: "WhatsApp", Icon: MessageCircle },
  telegram: { label: "Telegram", Icon: Send },
  max: { label: "MAX", Icon: MessageCircle },
};

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}

export function heroFontSize(name: string, big: number, small: number): number {
  const len = name.length;
  if (len <= 14) return big;
  if (len >= 32) return small;
  return Math.round(big - ((len - 14) / 18) * (big - small));
}

/* ────────────────────────────── primitives ────────────────────────────── */

export function Heading({
  t,
  as = "h2",
  className = "",
  style,
  children,
}: {
  t: SiteTokens;
  as?: "h1" | "h2" | "h3";
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const Tag = as;
  return (
    <Tag
      className={className}
      style={{
        fontFamily: t.headingFont,
        fontWeight: t.headingWeight,
        textTransform: t.headingTransform,
        letterSpacing: t.headingTracking,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

export function Kicker({ t, children, color }: { t: SiteTokens; children: ReactNode; color?: string }) {
  return (
    <p
      className="text-xs font-semibold uppercase"
      style={{ color: color ?? t.accentText, letterSpacing: "0.18em", fontFamily: t.bodyFont }}
    >
      {children}
    </p>
  );
}

type BtnVariant = "primary" | "ghost" | "onImage";

export function ActionButton({
  t,
  variant,
  action,
  onAction,
  icon: Icon,
  size = "lg",
}: {
  t: SiteTokens;
  variant: BtnVariant;
  action: SiteAction;
  onAction: (a: SiteAction) => void;
  icon?: LucideIcon;
  size?: "lg" | "sm";
}) {
  const style: CSSProperties =
    variant === "primary"
      ? { borderRadius: t.radius }
      : variant === "ghost"
        ? { borderRadius: t.radius, borderColor: t.border, color: t.text, background: t.surface }
        : { borderRadius: t.radius };
  const cls =
    variant === "primary"
      ? "bg-[var(--site-accent)] hover:bg-[var(--site-accent-hover)] text-[color:var(--site-on-accent)] shadow-lg shadow-black/10"
      : variant === "ghost"
        ? "border hover:opacity-80"
        : "border border-white/40 bg-white/10 text-white backdrop-blur-md hover:bg-white/20";
  const pad = size === "lg" ? "px-7 py-3.5 text-[15px]" : "px-4 py-2 text-sm";
  const content = (
    <>
      {Icon && <Icon className={size === "lg" ? "w-[18px] h-[18px]" : "w-4 h-4"} />}
      <span>{action.label}</span>
    </>
  );
  const className = `inline-flex items-center gap-2 font-semibold transition-all ${pad} ${cls}`;
  if (action.href) {
    const external = /^https?:/i.test(action.href);
    return (
      <a
        href={action.href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className={className}
        style={style}
      >
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={() => onAction(action)} className={className} style={style}>
      {content}
    </button>
  );
}

export function Monogram({ t, name, size, radius }: { t: SiteTokens; name: string; size: number; radius?: string }) {
  const letter = name.replace(/[«»"'\s]/g, "").charAt(0).toUpperCase() || "•";
  return (
    <div
      className="flex items-center justify-center shrink-0 select-none"
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? t.radius,
        background: t.accent,
        color: t.onAccent,
        fontFamily: t.headingFont,
        fontWeight: 700,
        fontSize: size * 0.46,
      }}
    >
      {letter}
    </div>
  );
}

export function Logo({ t, name, logoUrl, size }: { t: SiteTokens; name: string; logoUrl?: string | null; size: number }) {
  const radius = t.template === "editorial" ? "6px" : t.template === "classic" ? "12px" : "999px";
  if (logoUrl) {
    return (
       
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        className="object-cover shrink-0 bg-white"
        style={{ width: size, height: size, borderRadius: radius, border: `1px solid ${t.border}` }}
      />
    );
  }
  return <Monogram t={t} name={name} size={size} radius={radius} />;
}

/** «Открыто до 22:00» — считаем после монтирования: время сервера и гостя различается. */
function StatusPill({ t, hours, onImage }: { t: SiteTokens; hours: WorkingHours | null; onImage?: boolean }) {
  const [status, setStatus] = useState<{ open: boolean; text: string } | null>(null);
  useEffect(() => {
    const update = () => setStatus(formatHoursStatus(hours));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [hours]);
  if (!status) return null;
  return (
    <span
      className="inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium border"
      style={{
        borderRadius: "999px",
        ...(onImage
          ? { background: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.3)", color: "#fff" }
          : { background: t.surface, borderColor: t.border, color: t.text }),
      }}
    >
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ background: status.open ? "#22c55e" : "#a1a1aa", boxShadow: status.open ? "0 0 0 4px rgba(34,197,94,0.2)" : undefined }}
      />
      {status.text}
    </span>
  );
}

export function Section({
  id,
  t,
  band,
  children,
  className = "",
}: {
  id?: string;
  t: SiteTokens;
  band?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-24 py-24 ${className}`} style={{ background: band ? t.band : "transparent" }}>
      <div className="mx-auto max-w-6xl px-10">{children}</div>
    </section>
  );
}

export function SectionTitle({
  t,
  kicker,
  title,
  description,
  center,
  action,
}: {
  t: SiteTokens;
  kicker?: string;
  title: string;
  description?: string | null;
  center?: boolean;
  action?: ReactNode;
}) {
  const size = t.template === "editorial" ? 52 : t.template === "bold" ? 40 : 44;
  return (
    <div className={`mb-12 flex items-end gap-8 ${center ? "flex-col items-center text-center" : "justify-between"}`}>
      <div className={center ? "max-w-2xl" : "max-w-3xl"}>
        {kicker && <Kicker t={t}>{kicker}</Kicker>}
        <Heading t={t} className="mt-3 leading-[1.05]" style={{ fontSize: size }}>
          {title}
        </Heading>
        {description && (
          <p className="mt-4 text-lg leading-relaxed" style={{ color: t.muted }}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ────────────────────────────── hero ────────────────────────────── */

interface HeroProps {
  t: SiteTokens;
  p: DesktopSiteProps;
  primary: SiteAction | null;
  secondary: SiteAction | null;
  onAction: (a: SiteAction) => void;
}

export function heroFallbackBackground(t: SiteTokens): string {
  return `radial-gradient(900px 520px at 12% 8%, ${mix(t.accent, "#ffffff", 0.2)}66, transparent 60%), radial-gradient(700px 500px at 90% 90%, ${t.accent}55, transparent 60%), linear-gradient(135deg, ${mix(t.accent, "#000000", 0.45)}, #0b0b12)`;
}

function HeroFacts({ t, p, onImage }: { t: SiteTokens; p: DesktopSiteProps; onImage?: boolean }) {
  if (!p.address && !p.phone) return null;
  const color = onImage ? "rgba(255,255,255,0.82)" : t.muted;
  return (
    <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-[15px]" style={{ color }}>
      {p.address && (
        <span className="inline-flex items-center gap-2">
          <MapPin className="w-4 h-4" /> {p.address}
        </span>
      )}
      {p.phone && (
        <a href={telHref(p.phone)} className="inline-flex items-center gap-2 hover:opacity-80">
          <Phone className="w-4 h-4" /> {p.phone}
        </a>
      )}
    </div>
  );
}

function HeroShowcase({ t, p, primary, secondary, onAction }: HeroProps) {
  return (
    <section className="relative overflow-hidden" style={{ minHeight: "min(86vh, 820px)" }}>
      {p.heroImageUrl ? (
         
        <img src={p.heroImageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0" style={{ background: heroFallbackBackground(t) }} />
      )}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.8) 100%)" }}
      />
      <div className="relative mx-auto flex max-w-6xl flex-col justify-end px-10 pb-20 pt-40" style={{ minHeight: "min(86vh, 820px)" }}>
        <div>
          <StatusPill t={t} hours={p.workingHours} onImage />
        </div>
        <Heading
          t={t}
          as="h1"
          className="mt-7 max-w-4xl text-white"
          style={{ fontSize: heroFontSize(p.name, 92, 60), lineHeight: 0.98 }}
        >
          {p.name}
        </Heading>
        {p.subtitle && <p className="mt-6 max-w-2xl text-xl leading-relaxed text-white/85">{p.subtitle}</p>}
        <div className="mt-10 flex flex-wrap gap-4">
          {primary && <ActionButton t={t} variant="primary" action={primary} onAction={onAction} />}
          {secondary && (
            <ActionButton
              t={t}
              variant="onImage"
              action={secondary}
              onAction={onAction}
              icon={secondary.href?.startsWith("tel:") ? Phone : Navigation}
            />
          )}
        </div>
        <HeroFacts t={t} p={p} onImage />
      </div>
    </section>
  );
}

function HeroClassic({ t, p, primary, secondary, onAction }: HeroProps) {
  return (
    <section className="mx-auto grid max-w-6xl grid-cols-[1.05fr_1fr] items-center gap-16 px-10 py-20">
      <div>
        <StatusPill t={t} hours={p.workingHours} />
        <Heading
          t={t}
          as="h1"
          className="mt-6"
          style={{ fontSize: heroFontSize(p.name, 66, 46), lineHeight: 1.04 }}
        >
          {p.name}
        </Heading>
        {p.subtitle && (
          <p className="mt-6 max-w-xl text-lg leading-relaxed" style={{ color: t.muted }}>
            {p.subtitle}
          </p>
        )}
        <div className="mt-9 flex flex-wrap gap-3">
          {primary && <ActionButton t={t} variant="primary" action={primary} onAction={onAction} />}
          {secondary && (
            <ActionButton
              t={t}
              variant="ghost"
              action={secondary}
              onAction={onAction}
              icon={secondary.href?.startsWith("tel:") ? Phone : Navigation}
            />
          )}
        </div>
        <HeroFacts t={t} p={p} />
      </div>
      <div className="relative">
        {p.heroImageUrl ? (
           
          <img
            src={p.heroImageUrl}
            alt=""
            loading="lazy"
            className="aspect-[4/3] w-full object-cover shadow-2xl shadow-black/15"
            style={{ borderRadius: t.radiusLg }}
          />
        ) : (
          <div
            className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden"
            style={{ borderRadius: t.radiusLg, background: `linear-gradient(140deg, ${t.accentSoft}, ${t.band})`, border: `1px solid ${t.border}` }}
          >
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full" style={{ background: t.accent, opacity: 0.12 }} />
            <div className="absolute -bottom-20 -left-10 h-72 w-72 rounded-full" style={{ background: t.accent, opacity: 0.08 }} />
            <Logo t={t} name={p.name} logoUrl={p.logoUrl} size={140} />
          </div>
        )}
      </div>
    </section>
  );
}

function HeroEditorial({ t, p, primary, secondary, onAction }: HeroProps) {
  return (
    <>
      <section className="mx-auto max-w-5xl px-10 pb-16 pt-24 text-center">
        <div className="flex justify-center">
          <StatusPill t={t} hours={p.workingHours} />
        </div>
        <Heading
          t={t}
          as="h1"
          className="mx-auto mt-8 max-w-4xl"
          style={{ fontSize: heroFontSize(p.name, 104, 64), lineHeight: 1 }}
        >
          {p.name}
        </Heading>
        {p.subtitle && (
          <p
            className="mx-auto mt-7 max-w-2xl text-2xl italic leading-snug"
            style={{ color: t.muted, fontFamily: t.headingFont }}
          >
            {p.subtitle}
          </p>
        )}
        <div className="mx-auto mt-10 flex items-center justify-center gap-4" aria-hidden>
          <span className="h-px w-20" style={{ background: t.border }} />
          <Star className="h-3.5 w-3.5" style={{ color: t.accentText, fill: t.accentText }} />
          <span className="h-px w-20" style={{ background: t.border }} />
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {primary && <ActionButton t={t} variant="primary" action={primary} onAction={onAction} />}
          {secondary && (
            <ActionButton
              t={t}
              variant="ghost"
              action={secondary}
              onAction={onAction}
              icon={secondary.href?.startsWith("tel:") ? Phone : Navigation}
            />
          )}
        </div>
      </section>
      {p.heroImageUrl && (
        <div className="mx-auto max-w-6xl px-10 pb-8">
          { }
          <img
            src={p.heroImageUrl}
            alt=""
            loading="lazy"
            className="aspect-[21/9] w-full object-cover"
            style={{ borderRadius: t.radiusLg }}
          />
        </div>
      )}
    </>
  );
}

function HeroBold({ t, p, primary, secondary, onAction }: HeroProps) {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full blur-3xl"
        style={{ background: t.accent, opacity: 0.28 }}
      />
      <div className="relative mx-auto grid max-w-6xl grid-cols-12 items-center gap-12 px-10 py-24">
        <div className="col-span-7">
          <StatusPill t={t} hours={p.workingHours} />
          <Heading
            t={t}
            as="h1"
            className="mt-8"
            style={{ fontSize: heroFontSize(p.name, 74, 44), lineHeight: 1.02 }}
          >
            {p.name}
          </Heading>
          <div className="mt-8 h-2 w-28" style={{ background: t.accent, borderRadius: 999 }} />
          {p.subtitle && (
            <p className="mt-8 max-w-xl text-lg leading-relaxed" style={{ color: t.muted }}>
              {p.subtitle}
            </p>
          )}
          <div className="mt-10 flex flex-wrap gap-3">
            {primary && <ActionButton t={t} variant="primary" action={primary} onAction={onAction} />}
            {secondary && (
              <ActionButton
                t={t}
                variant="ghost"
                action={secondary}
                onAction={onAction}
                icon={secondary.href?.startsWith("tel:") ? Phone : Navigation}
              />
            )}
          </div>
        </div>
        <div className="relative col-span-5">
          <div
            className="absolute inset-0 translate-x-5 translate-y-5"
            style={{ border: `2px solid ${t.accent}`, borderRadius: t.radiusLg }}
          />
          {p.heroImageUrl ? (
             
            <img
              src={p.heroImageUrl}
              alt=""
              loading="lazy"
              className="relative aspect-[4/5] w-full object-cover"
              style={{ borderRadius: t.radiusLg }}
            />
          ) : (
            <div
              className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden"
              style={{ borderRadius: t.radiusLg, background: `linear-gradient(160deg, ${t.accent}, ${mix(t.accent, "#000000", 0.55)})` }}
            >
              {p.logoUrl ? (
                <Logo t={t} name={p.name} logoUrl={p.logoUrl} size={150} />
              ) : (
                <span
                  className="select-none"
                  style={{ fontFamily: t.headingFont, fontWeight: 800, fontSize: 220, color: "rgba(255,255,255,0.9)", lineHeight: 1 }}
                >
                  {p.name.replace(/[«»"'\s]/g, "").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────── blocks ────────────────────────────── */

function MenuBlock({
  t,
  menu,
  onOpenFull,
}: {
  t: SiteTokens;
  menu: NonNullable<DesktopSiteProps["menu"]>;
  onOpenFull: (() => void) | null;
}) {
  const categories = useMemo(() => {
    const list: string[] = [];
    for (const item of menu.items) {
      const c = item.category?.trim();
      if (c && !list.includes(c)) list.push(c);
    }
    return list;
  }, [menu.items]);
  const [active, setActive] = useState<string | null>(null);
  const current = active && categories.includes(active) ? active : categories[0] ?? null;
  const limit = t.template === "editorial" ? 10 : 8;
  const visible = (current ? menu.items.filter((i) => i.category?.trim() === current) : menu.items).slice(0, limit);
  const fullLabel = menu.cartEnabled ? "Открыть меню и заказать" : "Всё меню";

  return (
    <Section id="site-menu" t={t} band={t.template !== "editorial"}>
      <SectionTitle
        t={t}
        kicker="Меню"
        title={menu.title?.trim() || "Наше меню"}
        description={menu.description}
        action={
          onOpenFull ? (
            <ActionButton
              t={t}
              variant="ghost"
              action={{ label: fullLabel, section: "__menu" }}
              onAction={onOpenFull}
              icon={ArrowRight}
              size="sm"
            />
          ) : null
        }
      />
      {categories.length > 1 && (
        <div className="mb-10 flex flex-wrap gap-2">
          {categories.map((c) => {
            const on = c === current;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setActive(c)}
                className="border px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  borderRadius: t.template === "editorial" ? "2px" : "999px",
                  borderColor: on ? t.accent : t.border,
                  background: on ? t.accent : t.surface,
                  color: on ? t.onAccent : t.text,
                }}
              >
                {c}
              </button>
            );
          })}
        </div>
      )}

      {t.template === "editorial" ? (
        <div className="grid grid-cols-2 gap-x-16 gap-y-8">
          {visible.map((item, i) => (
            <div key={item.id ?? i}>
              <div className="flex items-baseline gap-3">
                <span className="text-xl" style={{ fontFamily: t.headingFont, fontWeight: 500 }}>
                  {item.name}
                </span>
                <span className="mb-1 flex-1 border-b border-dotted" style={{ borderColor: t.muted, opacity: 0.5 }} />
                {item.price && (
                  <span className="text-lg font-semibold" style={{ color: t.accentText }}>
                    {item.price}
                  </span>
                )}
              </div>
              {(item.description || item.weight) && (
                <p className="mt-1.5 text-[15px] italic leading-relaxed" style={{ color: t.muted }}>
                  {[item.description, item.weight].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : t.template === "classic" ? (
        <div className="grid grid-cols-2 gap-5">
          {visible.map((item, i) => (
            <div
              key={item.id ?? i}
              className="flex gap-5 border p-4"
              style={{ borderRadius: t.radiusLg, background: t.surface, borderColor: t.border }}
            >
              {item.imageUrl ? (
                 
                <img src={item.imageUrl} alt="" loading="lazy" className="h-24 w-24 shrink-0 object-cover" style={{ borderRadius: t.radius }} />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center" style={{ borderRadius: t.radius, background: t.accentSoft, color: t.accentText }}>
                  <UtensilsCrossed className="h-7 w-7" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold leading-snug">{item.name}</p>
                  {item.price && (
                    <p className="shrink-0 font-semibold" style={{ color: t.accentText }}>
                      {item.price}
                    </p>
                  )}
                </div>
                {item.description && (
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed" style={{ color: t.muted }}>
                    {item.description}
                  </p>
                )}
                {item.weight && (
                  <p className="mt-2 text-xs" style={{ color: t.muted }}>
                    {item.weight}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-6">
          {visible.map((item, i) => (
            <div
              key={item.id ?? i}
              className="group flex flex-col overflow-hidden border transition-transform duration-300 hover:-translate-y-1"
              style={{ borderRadius: t.radiusLg, background: t.surface, borderColor: t.border }}
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                {item.imageUrl ? (
                   
                  <img
                    src={item.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center" style={{ background: t.accentSoft, color: t.accentText }}>
                    <UtensilsCrossed className="h-9 w-9" />
                  </div>
                )}
                {item.price && (
                  <span
                    className="absolute bottom-3 right-3 px-3 py-1 text-sm font-bold shadow-lg"
                    style={{ borderRadius: 999, background: t.accent, color: t.onAccent }}
                  >
                    {item.price}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="font-semibold leading-snug">{item.name}</p>
                {item.description && (
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed" style={{ color: t.muted }}>
                    {item.description}
                  </p>
                )}
                {item.weight && (
                  <p className="mt-auto pt-3 text-xs" style={{ color: t.muted }}>
                    {item.weight}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

export function ServicesBlock({ t, services, band }: { t: SiteTokens; services: CardService[]; band: boolean }) {
  return (
    <Section id="site-services" t={t} band={band}>
      <SectionTitle t={t} kicker="Услуги" title="Услуги и цены" />
      <div
        className="grid grid-cols-2 gap-x-16 border p-10"
        style={{ borderRadius: t.radiusLg, background: t.surface, borderColor: t.border }}
      >
        {services.map((s, i) => (
          <div key={i} className="flex items-baseline gap-3 border-b py-4" style={{ borderColor: t.border }}>
            <span className="text-[17px] font-medium">{s.name}</span>
            <span className="flex-1" />
            {s.price && (
              <span className="shrink-0 text-[17px] font-semibold" style={{ color: t.accentText }}>
                {s.price}
              </span>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

function AboutBlock({ t, about, band }: { t: SiteTokens; about: NonNullable<DesktopSiteProps["about"]>; band: boolean }) {
  return (
    <Section id="site-about" t={t} band={band}>
      <div className="grid grid-cols-[1fr_1.4fr] gap-20">
        <div>
          <Kicker t={t}>{about.kicker || "О нас"}</Kicker>
          <Heading t={t} className="mt-3 leading-[1.05]" style={{ fontSize: t.template === "editorial" ? 52 : 44 }}>
            {about.title}
          </Heading>
        </div>
        {about.html ? (
          <div
            className="site-prose text-lg leading-relaxed [&_a]:underline [&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:mb-1.5 [&_ol]:mb-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-5 [&_strong]:font-semibold [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:pl-6"
            style={{ color: t.muted }}
            dangerouslySetInnerHTML={{ __html: about.html }}
          />
        ) : (
          <p className="whitespace-pre-line text-lg leading-relaxed" style={{ color: t.muted }}>
            {about.text}
          </p>
        )}
      </div>
    </Section>
  );
}

function ModulesBlock({
  t,
  modules,
  onOpen,
  band,
}: {
  t: SiteTokens;
  modules: SiteModuleLink[];
  onOpen: (m: SiteModuleLink) => void;
  band: boolean;
}) {
  return (
    <Section id="site-sections" t={t} band={band}>
      <SectionTitle t={t} kicker="Для гостей" title="Полезное" />
      <div className="grid grid-cols-3 gap-5">
        {modules.map((m) => {
          const Icon = m.Icon;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onOpen(m)}
              className="group flex items-center gap-5 border p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-xl"
              style={{ borderRadius: t.radiusLg, background: t.surface, borderColor: t.border }}
            >
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center text-2xl"
                style={{ borderRadius: t.template === "showcase" ? 999 : t.radius, background: t.accentSoft, color: t.accentText }}
              >
                {m.emoji ? m.emoji : Icon ? <Icon className="h-6 w-6" /> : null}
              </span>
              <span className="min-w-0 flex-1 text-lg font-semibold leading-snug">{m.label}</span>
              {m.href ? (
                <ArrowUpRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: t.muted }} />
              ) : (
                <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" style={{ color: t.muted }} />
              )}
            </button>
          );
        })}
      </div>
    </Section>
  );
}

function ReviewBand({
  t,
  onRate,
  platformLinks,
}: {
  t: SiteTokens;
  onRate: () => void;
  platformLinks: DesktopSiteProps["platformLinks"];
}) {
  const [hover, setHover] = useState(0);
  const filled = t.template === "showcase" || t.template === "bold";
  const bg = filled ? `linear-gradient(120deg, ${t.accent}, ${mix(t.accent, "#000000", 0.35)})` : t.band;
  const fg = filled ? "#ffffff" : t.text;
  const sub = filled ? "rgba(255,255,255,0.8)" : t.muted;
  const star = filled ? "#ffffff" : t.accentText;
  return (
    <section id="site-reviews" className="scroll-mt-24 py-10">
      <div className="mx-auto max-w-6xl px-10">
        <div
          className="flex items-center justify-between gap-10 px-14 py-14"
          style={{ background: bg, borderRadius: t.radiusLg, border: filled ? "none" : `1px solid ${t.border}` }}
        >
          <div>
            <Heading t={t} className="leading-tight" style={{ color: fg, fontSize: 38 }}>
              Были у нас? Оцените визит
            </Heading>
            <p className="mt-3 text-lg" style={{ color: sub }}>
              Это займёт полминуты — ваше мнение помогает нам становиться лучше.
            </p>
            {platformLinks.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium" style={{ color: sub }}>
                {platformLinks.map((l) => (
                  <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:opacity-80">
                    Отзывы на {l.label} <ArrowUpRight className="h-4 w-4" />
                  </a>
                ))}
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-2" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`Оценка ${n}`}
                onMouseEnter={() => setHover(n)}
                onClick={onRate}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className="h-12 w-12"
                  strokeWidth={1.5}
                  style={{ color: star, fill: n <= hover ? star : "transparent" }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const JS_DAYS: WeekDay[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const noopSubscribe = () => () => {};

/** День недели гостя; на сервере — null (часовой пояс сервера и гостя различается). */
function useTodayKey(): WeekDay | null {
  return useSyncExternalStore<WeekDay | null>(noopSubscribe, () => JS_DAYS[new Date().getDay()], () => null);
}

export function useQrDataUrl(url: string | null | undefined, dark: string): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (url === null) return;
    let cancelled = false;
    const target = url ?? `${window.location.origin}${window.location.pathname}`;
    import("qrcode")
      .then((QR) => QR.toDataURL(target, { margin: 1, width: 320, color: { dark, light: "#ffffff" } }))
      .then((d) => {
        if (!cancelled) setDataUrl(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url, dark]);
  return dataUrl;
}

function ContactsBlock({ t, p, band }: { t: SiteTokens; p: DesktopSiteProps; band: boolean }) {
  const today = useTodayKey();
  const qrDark = mix(t.accent, "#000000", 0.55);
  const qr = useQrDataUrl(p.publicUrl, qrDark);
  const hasHours = !!p.workingHours && WEEK_DAYS.some((d) => p.workingHours?.[d] !== undefined);
  const mapsHref = p.mapsUrl || (p.address ? `https://yandex.ru/maps/?text=${encodeURIComponent(p.address)}` : null);
  const card: CSSProperties = { borderRadius: t.radiusLg, background: t.surface, borderColor: t.border };
  const hasContacts = !!(p.phone || p.email || p.messengers.length);
  if (!p.address && !hasContacts && !hasHours && p.publicUrl === null) return null;

  return (
    <Section id="site-contacts" t={t} band={band}>
      <SectionTitle t={t} kicker="Контакты" title="Как нас найти" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-6">
        {p.address && (
          <div className="flex flex-col border p-7" style={card}>
            <MapPin className="h-6 w-6" style={{ color: t.accentText }} />
            <p className="mt-5 text-sm font-semibold uppercase tracking-wider" style={{ color: t.muted }}>
              Адрес
            </p>
            <p className="mt-2 text-lg font-medium leading-snug">{p.address}</p>
            {mapsHref && (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold hover:opacity-80"
                style={{ color: t.accentText }}
              >
                Построить маршрут <ArrowUpRight className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
        {hasContacts && (
          <div className="flex flex-col border p-7" style={card}>
            <Phone className="h-6 w-6" style={{ color: t.accentText }} />
            <p className="mt-5 text-sm font-semibold uppercase tracking-wider" style={{ color: t.muted }}>
              Связаться
            </p>
            {p.phone && (
              <a href={telHref(p.phone)} className="mt-2 text-lg font-semibold hover:opacity-80">
                {p.phone}
              </a>
            )}
            {p.email && (
              <a href={`mailto:${p.email}`} className="mt-1.5 inline-flex items-center gap-2 text-[15px] hover:opacity-80" style={{ color: t.muted }}>
                <Mail className="h-4 w-4" /> {p.email}
              </a>
            )}
            {p.messengers.length > 0 && (
              <div className="mt-auto flex flex-wrap gap-2 pt-6">
                {p.messengers.map((m) => {
                  const meta = MESSENGER_META[m.kind];
                  const Icon = meta.Icon;
                  return (
                    <a
                      key={m.kind}
                      href={m.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 border px-3 py-1.5 text-sm font-medium hover:opacity-80"
                      style={{ borderRadius: 999, borderColor: t.border }}
                    >
                      <Icon className="h-4 w-4" style={{ color: t.accentText }} /> {meta.label}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {hasHours && (
          <div className="border p-7" style={card}>
            <Clock className="h-6 w-6" style={{ color: t.accentText }} />
            <p className="mt-5 text-sm font-semibold uppercase tracking-wider" style={{ color: t.muted }}>
              Часы работы
            </p>
            <div className="mt-3 space-y-1.5 text-[15px]">
              {WEEK_DAYS.map((d) => {
                const h = p.workingHours?.[d];
                const isToday = d === today;
                return (
                  <div
                    key={d}
                    className="flex justify-between gap-4"
                    style={{ fontWeight: isToday ? 700 : 400, color: isToday ? t.text : t.muted }}
                  >
                    <span>{WEEK_DAY_LABELS[d]}</span>
                    <span>{h ? `${h.open} – ${h.close}` : h === null ? "выходной" : "—"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {p.publicUrl !== null && (
          <div className="flex flex-col items-center border p-7 text-center" style={card}>
            {qr ? (
               
              <img src={qr} alt="QR-код сайта" width={148} height={148} className="h-[148px] w-[148px] rounded-lg bg-white p-1" />
            ) : (
              <div className="h-[148px] w-[148px] rounded-lg" style={{ background: t.band }} />
            )}
            <p className="mt-4 inline-flex items-center gap-1.5 font-semibold">
              <Smartphone className="h-4 w-4" style={{ color: t.accentText }} /> Сайт на телефоне
            </p>
            <p className="mt-1 text-sm" style={{ color: t.muted }}>
              Наведите камеру — откроется мобильная версия
            </p>
          </div>
        )}
      </div>
    </Section>
  );
}

/* ────────────────────────────── page ────────────────────────────── */

export default function DesktopSite(p: DesktopSiteProps) {
  const t = useMemo(() => buildSiteTokens(p.template, p.brandColor, p.appearance), [p.template, p.brandColor, p.appearance]);

  const goAnchor = (id: string) => {
    const scroll = () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (p.section) {
      p.onHome();
      setTimeout(scroll, 60);
    } else {
      scroll();
    }
  };

  const openSection = (key: string) => {
    p.onOpenSection(key);
    window.scrollTo({ top: 0 });
  };

  const onAction = (a: SiteAction) => {
    if (a.section) openSection(a.section);
    else if (a.anchor) goAnchor(a.anchor);
  };

  const secondary: SiteAction | null = p.phone
    ? { label: "Позвонить", href: telHref(p.phone) }
    : p.address
      ? { label: "Как добраться", href: p.mapsUrl || `https://yandex.ru/maps/?text=${encodeURIComponent(p.address)}` }
      : null;

  const hasContactsBlock = !!(p.address || p.phone || p.email || p.messengers.length || p.workingHours || p.publicUrl !== null);
  const nav: { label: string; anchor: string }[] = [];
  if (p.menu) nav.push({ label: "Меню", anchor: "site-menu" });
  if (p.services.length) nav.push({ label: "Услуги", anchor: "site-services" });
  if (p.about) nav.push({ label: p.about.kicker || "О нас", anchor: "site-about" });
  if (p.modules.length) nav.push({ label: "Полезное", anchor: "site-sections" });
  if (p.reviewKey) nav.push({ label: "Отзывы", anchor: "site-reviews" });
  if (hasContactsBlock) nav.push({ label: "Контакты", anchor: "site-contacts" });

  // Чередуем фон секций, чтобы страница не сливалась.
  const menuBand = !!p.menu && t.template !== "editorial";
  const blockOrder = [
    p.services.length > 0 ? "services" : null,
    p.about ? "about" : null,
    p.modules.length > 0 ? "modules" : null,
    "contacts",
  ].filter(Boolean) as string[];
  const bandOf = (key: string) => (blockOrder.indexOf(key) % 2 === 0 ? !menuBand : menuBand);

  const heroProps: HeroProps = { t, p, primary: p.primaryAction, secondary, onAction };
  const rootStyle: CSSProperties = {
    background: t.bg,
    color: t.text,
    fontFamily: t.bodyFont,
    ["--site-accent" as string]: t.accent,
    ["--site-accent-hover" as string]: t.accentHover,
    ["--site-on-accent" as string]: t.onAccent,
  };

  return (
    <div className={`${siteFontVariables} min-h-screen antialiased`} style={rootStyle}>
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-xl"
        style={{ background: `${t.bg}e0`, borderColor: t.border }}
      >
        <div className="mx-auto flex h-[72px] max-w-6xl items-center gap-8 px-10">
          <button type="button" onClick={() => (p.section ? p.onHome() : window.scrollTo({ top: 0, behavior: "smooth" }))} className="flex min-w-0 items-center gap-3">
            <Logo t={t} name={p.name} logoUrl={p.logoUrl} size={40} />
            <span
              className="truncate text-lg"
              style={{ fontFamily: t.headingFont, fontWeight: t.headingWeight, letterSpacing: t.headingTracking, textTransform: t.headingTransform, fontSize: t.template === "bold" ? 15 : 18 }}
            >
              {p.name}
            </span>
          </button>
          <nav className="ml-auto flex items-center gap-7 text-[15px] font-medium">
            {nav.map((n) => (
              <button key={n.anchor} type="button" onClick={() => goAnchor(n.anchor)} className="transition-opacity hover:opacity-70" style={{ color: t.muted }}>
                {n.label}
              </button>
            ))}
          </nav>
          {p.phone && (
            <a
              href={telHref(p.phone)}
              className="inline-flex shrink-0 items-center gap-2 bg-[var(--site-accent)] px-4 py-2 text-sm font-semibold text-[color:var(--site-on-accent)] transition-colors hover:bg-[var(--site-accent-hover)]"
              style={{ borderRadius: t.radius }}
            >
              <Phone className="h-4 w-4" /> {p.phone}
            </a>
          )}
        </div>
      </header>

      {p.section ? (
        <main className="mx-auto max-w-3xl px-10 pb-24 pt-10">
          <button
            type="button"
            onClick={p.onHome}
            className="inline-flex items-center gap-2 text-sm font-semibold hover:opacity-80"
            style={{ color: t.accentText }}
          >
            <ArrowLeft className="h-4 w-4" /> На главную
          </button>
          <Heading t={t} as="h1" className="mt-4 leading-tight" style={{ fontSize: 40 }}>
            {p.section.label}
          </Heading>
          <div
            className="relative mt-8 flex flex-col overflow-hidden border shadow-xl shadow-black/5 [&_.min-h-screen]:min-h-[60vh]"
            style={{ borderRadius: t.radiusLg, borderColor: t.border, ...p.sectionFrame?.style }}
          >
            {p.sectionFrame?.coverUrl && (
              <div className="pointer-events-none absolute inset-0 z-0">
                { }
                <img src={p.sectionFrame.coverUrl} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0" style={p.sectionFrame.overlayStyle} />
              </div>
            )}
            <div className="relative z-10 flex flex-col">{p.section.node}</div>
          </div>
        </main>
      ) : (
        <main>
          {t.template === "showcase" && <HeroShowcase {...heroProps} />}
          {t.template === "classic" && <HeroClassic {...heroProps} />}
          {t.template === "editorial" && <HeroEditorial {...heroProps} />}
          {t.template === "bold" && <HeroBold {...heroProps} />}

          {p.menu && <MenuBlock t={t} menu={p.menu} onOpenFull={p.menuKey ? () => openSection(p.menuKey!) : null} />}
          {p.services.length > 0 && <ServicesBlock t={t} services={p.services} band={bandOf("services")} />}
          {p.about && <AboutBlock t={t} about={p.about} band={bandOf("about")} />}
          {p.modules.length > 0 && (
            <ModulesBlock
              t={t}
              modules={p.modules}
              band={bandOf("modules")}
              onOpen={(m) => {
                if (m.href) window.open(m.href, "_blank", "noopener,noreferrer");
                else openSection(m.key);
              }}
            />
          )}
          {p.reviewKey && <ReviewBand t={t} platformLinks={p.platformLinks} onRate={() => openSection(p.reviewKey!)} />}
          <ContactsBlock t={t} p={p} band={bandOf("contacts")} />
        </main>
      )}

      <footer className="border-t" style={{ borderColor: t.border }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-10 py-10 text-sm" style={{ color: t.muted }}>
          <div className="flex items-center gap-3">
            <Logo t={t} name={p.name} logoUrl={p.logoUrl} size={32} />
            <span>
              © {new Date().getFullYear()} {p.name}
              {p.address ? ` · ${p.address}` : ""}
            </span>
          </div>
          {p.watermark === "small" && (
            <a
              href="https://qrstars.ru/?utm_source=microsite&utm_medium=desktop_site"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 hover:opacity-80"
            >
              Сайт сделан в QrStars
            </a>
          )}
          {p.watermark === "promo" && (
            <a
              href="https://qrstars.ru/?utm_source=microsite&utm_medium=desktop_site_promo"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 border px-4 py-2 font-medium hover:opacity-80"
              style={{ borderRadius: 999, borderColor: t.border, color: t.text }}
            >
              Сделано в QrStars · свой сайт для бизнеса →
            </a>
          )}
        </div>
      </footer>
      {p.overlay}
    </div>
  );
}
