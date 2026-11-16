"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import {
  ArrowUpRight,
  Check,
  Clock,
  Download,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Smartphone,
  Star,
} from "lucide-react";
import ConsentCheckbox from "@/components/scan/ConsentCheckbox";
import { useCardContactForm } from "@/components/scan/use-card-contact-form";
import type { PdConsent } from "@/lib/pd-consent";
import {
  cardChipLinks,
  cardMessengerButtons,
  normalizeCardServices,
  safeHttpUrl,
  telHref as cardTelHref,
  yandexMapsSearchHref,
  type PublicBusinessCard,
} from "@/lib/business-card";
import { buildSiteTokens, mix, type SiteTokens } from "@/lib/site-theme";
import type { SiteTemplateId } from "@/lib/site-templates";
import { siteFontVariables } from "./site-fonts";
import {
  ActionButton,
  Heading,
  Kicker,
  MESSENGER_META,
  Section,
  SectionTitle,
  ServicesBlock,
  heroFontSize,
  useQrDataUrl,
  type SiteAction,
} from "./DesktopSite";

export interface DesktopCardSiteProps {
  template: SiteTemplateId;
  appearance: "light" | "dark";
  brandColor: string;
  card: PublicBusinessCard;
  /** Код QR визитки — нужен форме заявки. */
  qrCode?: string;
  showContactForm: boolean;
  pdConsent?: PdConsent;
  vcardUrl: string;
  /** FREE — заметная плашка «сделать такую же» (визитка бесплатная, плашка — канал привлечения). */
  watermark: "none" | "promo";
  /** Адрес для QR «Контакт на телефоне»; undefined — текущая страница, null — без QR. */
  publicUrl?: string | null;
  overlay?: ReactNode;
}

const SOCIAL_LABELS: Record<string, string> = {
  vk: "ВКонтакте",
  instagram: "Instagram",
  youtube: "YouTube",
  ok: "Одноклассники",
  tiktok: "TikTok",
  dzen: "Дзен",
  avito: "Авито",
  profi: "Профи.ру",
  website: "Сайт",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function Avatar({ t, card, size, ring }: { t: SiteTokens; card: PublicBusinessCard; size: number; ring?: string }) {
  const radius = t.template === "classic" || t.template === "bold" ? t.radiusLg : "999px";
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    boxShadow: ring ? `0 0 0 6px ${ring}` : undefined,
  };
  if (card.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={card.avatarUrl} alt={card.fullName} className="shrink-0 object-cover" style={style} />;
  }
  return (
    <div
      className="flex shrink-0 select-none items-center justify-center"
      style={{
        ...style,
        background: `linear-gradient(140deg, ${t.accent}, ${mix(t.accent, "#000000", 0.4)})`,
        color: "#ffffff",
        fontFamily: t.headingFont,
        fontWeight: 700,
        fontSize: size * 0.36,
      }}
    >
      {initials(card.fullName)}
    </div>
  );
}

function Facts({ t, card, onImage, center }: { t: SiteTokens; card: PublicBusinessCard; onImage?: boolean; center?: boolean }) {
  const items = [
    card.serviceArea ? { Icon: MapPin, text: card.serviceArea } : null,
    card.workHours ? { Icon: Clock, text: card.workHours } : null,
  ].filter(Boolean) as { Icon: typeof MapPin; text: string }[];
  if (!items.length) return null;
  return (
    <div className={`mt-6 flex flex-wrap gap-2.5 ${center ? "justify-center" : ""}`}>
      {items.map(({ Icon, text }) => (
        <span
          key={text}
          className="inline-flex items-center gap-2 border px-3.5 py-1.5 text-sm font-medium"
          style={{
            borderRadius: 999,
            ...(onImage
              ? { background: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.3)", color: "#fff" }
              : { background: t.surface, borderColor: t.border, color: t.text }),
          }}
        >
          <Icon className="h-4 w-4" style={{ color: onImage ? "#fff" : t.accentText }} /> {text}
        </span>
      ))}
    </div>
  );
}

function HeroButtons({
  t,
  primary,
  messengers,
  onImage,
  center,
}: {
  t: SiteTokens;
  primary: SiteAction | null;
  messengers: { kind: keyof typeof MESSENGER_META; href: string }[];
  onImage?: boolean;
  center?: boolean;
}) {
  const noop = () => {};
  return (
    <div className={`mt-9 flex flex-wrap gap-3 ${center ? "justify-center" : ""}`}>
      {primary && <ActionButton t={t} variant="primary" action={primary} onAction={noop} icon={primary.href?.startsWith("tel:") ? Phone : undefined} />}
      {messengers.map((m) => (
        <ActionButton
          key={m.kind}
          t={t}
          variant={onImage ? "onImage" : "ghost"}
          action={{ label: MESSENGER_META[m.kind].label, href: m.href }}
          onAction={noop}
          icon={MESSENGER_META[m.kind].Icon}
        />
      ))}
    </div>
  );
}

function CardHero({
  t,
  card,
  primary,
  messengers,
}: {
  t: SiteTokens;
  card: PublicBusinessCard;
  primary: SiteAction | null;
  messengers: { kind: keyof typeof MESSENGER_META; href: string }[];
}) {
  const kicker = [card.title, card.company].filter(Boolean).join(" · ");

  if (t.template === "showcase") {
    return (
      <section
        className="relative overflow-hidden"
        style={{
          background: `radial-gradient(900px 500px at 15% 0%, ${mix(t.accent, "#ffffff", 0.25)}55, transparent 60%), linear-gradient(135deg, ${t.accent}, ${mix(t.accent, "#000000", 0.55)})`,
        }}
      >
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-10 pb-24 pt-20 text-center">
          <Avatar t={t} card={card} size={176} ring="rgba(255,255,255,0.25)" />
          {kicker && <Kicker t={t} color="rgba(255,255,255,0.8)">{kicker}</Kicker>}
          <Heading t={t} as="h1" className="mt-4 text-white" style={{ fontSize: heroFontSize(card.fullName, 76, 52), lineHeight: 1.02 }}>
            {card.fullName}
          </Heading>
          <Facts t={t} card={card} onImage center />
          <HeroButtons t={t} primary={primary} messengers={messengers} onImage center />
        </div>
      </section>
    );
  }

  if (t.template === "editorial") {
    return (
      <section className="mx-auto max-w-4xl px-10 pb-16 pt-20 text-center">
        <div className="flex justify-center">
          <Avatar t={t} card={card} size={168} ring={t.surface} />
        </div>
        {kicker && (
          <div className="mt-8">
            <Kicker t={t}>{kicker}</Kicker>
          </div>
        )}
        <Heading t={t} as="h1" className="mt-5" style={{ fontSize: heroFontSize(card.fullName, 92, 60), lineHeight: 1 }}>
          {card.fullName}
        </Heading>
        <div className="mx-auto mt-8 flex items-center justify-center gap-4" aria-hidden>
          <span className="h-px w-20" style={{ background: t.border }} />
          <Star className="h-3.5 w-3.5" style={{ color: t.accentText, fill: t.accentText }} />
          <span className="h-px w-20" style={{ background: t.border }} />
        </div>
        <Facts t={t} card={card} center />
        <HeroButtons t={t} primary={primary} messengers={messengers} center />
      </section>
    );
  }

  if (t.template === "bold") {
    return (
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full blur-3xl" style={{ background: t.accent, opacity: 0.28 }} />
        <div className="relative mx-auto grid max-w-6xl grid-cols-12 items-center gap-12 px-10 py-24">
          <div className="col-span-7">
            {kicker && <Kicker t={t}>{kicker}</Kicker>}
            <Heading t={t} as="h1" className="mt-5" style={{ fontSize: heroFontSize(card.fullName, 70, 44), lineHeight: 1.02 }}>
              {card.fullName}
            </Heading>
            <div className="mt-8 h-2 w-28" style={{ background: t.accent, borderRadius: 999 }} />
            <Facts t={t} card={card} />
            <HeroButtons t={t} primary={primary} messengers={messengers} />
          </div>
          <div className="relative col-span-5 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 translate-x-5 translate-y-5" style={{ border: `2px solid ${t.accent}`, borderRadius: t.radiusLg }} />
              <div className="relative">
                <Avatar t={t} card={card} size={360} />
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // classic
  return (
    <section className="mx-auto grid max-w-6xl grid-cols-[1.2fr_1fr] items-center gap-16 px-10 py-20">
      <div>
        {kicker && <Kicker t={t}>{kicker}</Kicker>}
        <Heading t={t} as="h1" className="mt-4" style={{ fontSize: heroFontSize(card.fullName, 64, 44), lineHeight: 1.04 }}>
          {card.fullName}
        </Heading>
        {card.about && (
          <p className="mt-6 line-clamp-3 max-w-xl text-lg leading-relaxed" style={{ color: t.muted }}>
            {card.about}
          </p>
        )}
        <Facts t={t} card={card} />
        <HeroButtons t={t} primary={primary} messengers={messengers} />
      </div>
      <div className="flex justify-center">
        <div
          className="relative flex aspect-square w-full max-w-[420px] items-center justify-center overflow-hidden"
          style={{ borderRadius: t.radiusLg, background: `linear-gradient(140deg, ${t.accentSoft}, ${t.band})`, border: `1px solid ${t.border}` }}
        >
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full" style={{ background: t.accent, opacity: 0.12 }} />
          {card.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.avatarUrl} alt={card.fullName} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <Avatar t={t} card={card} size={180} />
          )}
        </div>
      </div>
    </section>
  );
}

function ContactForm({
  t,
  card,
  qrCode,
  pdConsent,
}: {
  t: SiteTokens;
  card: PublicBusinessCard;
  qrCode: string;
  pdConsent?: PdConsent;
}) {
  const f = useCardContactForm(qrCode, pdConsent);
  const { consentChecked, setConsentChecked, consentHighlight, consentRef } = f.consent;
  const radius = t.template === "showcase" ? "14px" : t.radius;
  const field: CSSProperties = { borderRadius: radius, borderColor: t.border, background: t.bg, color: t.text };
  const inputCls = "w-full border px-4 py-3 text-[15px] outline-none transition-shadow focus:ring-2 focus:ring-[var(--site-accent)]";
  const card$: CSSProperties = { borderRadius: t.radiusLg, background: t.surface, borderColor: t.border };

  if (f.success) {
    return (
      <div className="flex flex-col items-center justify-center border p-10 text-center" style={card$}>
        <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: t.accentSoft, color: t.accentText }}>
          <Check className="h-7 w-7" />
        </span>
        <Heading t={t} as="h3" className="mt-5" style={{ fontSize: 26 }}>
          Заявка отправлена
        </Heading>
        <p className="mt-2" style={{ color: t.muted }}>
          {card.fullName} получит её и свяжется с вами.
        </p>
        <button type="button" onClick={() => f.setSuccess(false)} className="mt-5 text-sm font-semibold underline" style={{ color: t.accentText }}>
          Написать ещё
        </button>
      </div>
    );
  }

  return (
    <div className="border p-9" style={card$}>
      <Heading t={t} as="h3" style={{ fontSize: 28 }}>
        Оставить заявку
      </Heading>
      <p className="mt-2 text-[15px]" style={{ color: t.muted }}>
        Опишите задачу — {card.fullName} ответит, как освободится.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium" style={{ color: t.muted }}>Ваше имя</span>
          <input className={inputCls} style={field} value={f.guestName} maxLength={100} placeholder="Как к вам обращаться" onChange={(e) => f.setGuestName(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium" style={{ color: t.muted }}>Телефон для ответа</span>
          <input className={inputCls} style={field} type="tel" value={f.guestPhone} maxLength={40} placeholder="+7 (999) 123-45-67" onChange={(e) => f.setGuestPhone(e.target.value)} />
        </label>
      </div>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium" style={{ color: t.muted }}>Сообщение</span>
        <textarea className={`${inputCls} resize-none`} style={field} rows={4} value={f.message} maxLength={2000} placeholder="Что нужно сделать, адрес, удобное время…" onChange={(e) => f.setMessage(e.target.value)} />
      </label>
      {f.needsConsent && (
        <div className="mt-4">
          <ConsentCheckbox
            ref={consentRef}
            checked={consentChecked}
            onChange={setConsentChecked}
            policyUrl={f.policyUrl}
            dark={t.dark}
            highlight={consentHighlight}
          />
        </div>
      )}
      {f.error && <p className="mt-3 text-sm font-medium text-red-500">{f.error}</p>}
      <button
        type="button"
        onClick={() => void f.send()}
        disabled={f.sending}
        className="mt-6 inline-flex items-center gap-2 bg-[var(--site-accent)] px-7 py-3.5 font-semibold text-[color:var(--site-on-accent)] transition-colors hover:bg-[var(--site-accent-hover)] disabled:opacity-60"
        style={{ borderRadius: t.radius }}
      >
        {f.sending && <Loader2 className="h-4 w-4 animate-spin" />}
        {f.sending ? "Отправляем…" : "Отправить заявку"}
      </button>
    </div>
  );
}

export default function DesktopCardSite(p: DesktopCardSiteProps) {
  const t = useMemo(() => buildSiteTokens(p.template, p.brandColor, p.appearance), [p.template, p.brandColor, p.appearance]);
  const { card } = p;
  const phoneHref = cardTelHref(card.phone);
  const messengers = useMemo(() => cardMessengerButtons(card), [card]);
  const chips = useMemo(() => cardChipLinks(card), [card]);
  const services = useMemo(() => normalizeCardServices(card.services), [card.services]);
  const websiteHref = safeHttpUrl(card.website);
  const reviewsHref = safeHttpUrl(card.reviewsUrl);
  const tipsHref = safeHttpUrl(card.tipsUrl);
  const qrDark = mix(t.accent, "#000000", 0.55);
  const qr = useQrDataUrl(p.publicUrl, qrDark);
  const withForm = p.showContactForm && !!p.qrCode;

  const primary: SiteAction | null = phoneHref
    ? { label: card.phone ?? "Позвонить", href: phoneHref }
    : withForm
      ? { label: "Оставить заявку", href: "#site-contacts" }
      : null;

  const goAnchor = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const nav: { label: string; anchor: string }[] = [];
  if (services.length) nav.push({ label: "Услуги", anchor: "site-services" });
  if (card.about) nav.push({ label: "О себе", anchor: "site-about" });
  if (reviewsHref) nav.push({ label: "Отзывы", anchor: "site-reviews" });
  nav.push({ label: withForm ? "Заявка и контакты" : "Контакты", anchor: "site-contacts" });

  // Фон секций чередуется.
  const blocks = [services.length ? "services" : null, card.about || card.address ? "about" : null, "contacts"].filter(Boolean) as string[];
  const bandOf = (k: string) => blocks.indexOf(k) % 2 === 0;

  const cardStyle: CSSProperties = { borderRadius: t.radiusLg, background: t.surface, borderColor: t.border };
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
      <header className="sticky top-0 z-40 border-b backdrop-blur-xl" style={{ background: `${t.bg}e0`, borderColor: t.border }}>
        <div className="mx-auto flex h-[72px] max-w-6xl items-center gap-8 px-10">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex min-w-0 items-center gap-3">
            <Avatar t={t} card={card} size={40} />
            <span className="min-w-0 text-left leading-tight">
              <span
                className="block truncate"
                style={{ fontFamily: t.headingFont, fontWeight: t.headingWeight, textTransform: t.headingTransform, letterSpacing: t.headingTracking, fontSize: t.template === "bold" ? 14 : 17 }}
              >
                {card.fullName}
              </span>
              {card.title && (
                <span className="block truncate text-xs" style={{ color: t.muted }}>
                  {card.title}
                </span>
              )}
            </span>
          </button>
          <nav className="ml-auto flex items-center gap-7 text-[15px] font-medium">
            {nav.map((n) => (
              <button key={n.anchor} type="button" onClick={() => goAnchor(n.anchor)} className="transition-opacity hover:opacity-70" style={{ color: t.muted }}>
                {n.label}
              </button>
            ))}
          </nav>
          {phoneHref && (
            <a
              href={phoneHref}
              className="inline-flex shrink-0 items-center gap-2 bg-[var(--site-accent)] px-4 py-2 text-sm font-semibold text-[color:var(--site-on-accent)] transition-colors hover:bg-[var(--site-accent-hover)]"
              style={{ borderRadius: t.radius }}
            >
              <Phone className="h-4 w-4" /> {card.phone}
            </a>
          )}
        </div>
      </header>

      <main>
        <CardHero t={t} card={card} primary={primary} messengers={messengers} />

        {services.length > 0 && <ServicesBlock t={t} services={services} band={bandOf("services")} />}

        {(card.about || card.address) && (
          <Section id="site-about" t={t} band={bandOf("about")}>
            <div className="grid grid-cols-[1fr_1.4fr] gap-20">
              <div>
                <Kicker t={t}>О себе</Kicker>
                <Heading t={t} className="mt-3 leading-[1.05]" style={{ fontSize: t.template === "editorial" ? 52 : 44 }}>
                  Обо мне
                </Heading>
              </div>
              <div>
                {card.about && (
                  <p className="whitespace-pre-line text-lg leading-relaxed" style={{ color: t.muted }}>
                    {card.about}
                  </p>
                )}
                {card.address && (
                  <a
                    href={yandexMapsSearchHref(card.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex items-center gap-2 text-[15px] font-semibold hover:opacity-80"
                    style={{ color: t.accentText }}
                  >
                    <MapPin className="h-4 w-4" /> {card.address} <ArrowUpRight className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          </Section>
        )}

        {reviewsHref && (
          <section id="site-reviews" className="scroll-mt-24 py-10">
            <div className="mx-auto max-w-6xl px-10">
              <div
                className="flex items-center justify-between gap-10 px-14 py-12"
                style={{
                  borderRadius: t.radiusLg,
                  background: t.template === "showcase" || t.template === "bold" ? `linear-gradient(120deg, ${t.accent}, ${mix(t.accent, "#000000", 0.35)})` : t.band,
                  border: t.template === "showcase" || t.template === "bold" ? "none" : `1px solid ${t.border}`,
                }}
              >
                {(() => {
                  const filled = t.template === "showcase" || t.template === "bold";
                  const fg = filled ? "#ffffff" : t.text;
                  return (
                    <>
                      <div>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} className="h-6 w-6" style={{ color: filled ? "#fff" : t.accentText, fill: filled ? "#fff" : t.accentText }} />
                          ))}
                        </div>
                        <Heading t={t} className="mt-4 leading-tight" style={{ color: fg, fontSize: 36 }}>
                          Отзывы клиентов
                        </Heading>
                        <p className="mt-2 text-lg" style={{ color: filled ? "rgba(255,255,255,0.8)" : t.muted }}>
                          Почитайте, что говорят о моей работе.
                        </p>
                      </div>
                      <a
                        href={reviewsHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-2 px-7 py-3.5 font-semibold transition-opacity hover:opacity-90"
                        style={{ borderRadius: t.radius, background: filled ? "#ffffff" : t.accent, color: filled ? "#111827" : t.onAccent }}
                      >
                        Читать отзывы <ArrowUpRight className="h-4 w-4" />
                      </a>
                    </>
                  );
                })()}
              </div>
            </div>
          </section>
        )}

        <Section id="site-contacts" t={t} band={bandOf("contacts")}>
          <SectionTitle t={t} kicker="Контакты" title={withForm ? "Свяжитесь со мной" : "Как со мной связаться"} />
          <div className={`grid gap-6 ${withForm ? "grid-cols-[1.25fr_1fr]" : "grid-cols-2"}`}>
            {withForm && <ContactForm t={t} card={card} qrCode={p.qrCode!} pdConsent={p.pdConsent} />}
            <div className="flex flex-col gap-6">
              <div className="border p-8" style={cardStyle}>
                {card.phone && phoneHref && (
                  <a href={phoneHref} className="flex items-center gap-3 text-2xl font-semibold hover:opacity-80" style={{ fontFamily: t.headingFont }}>
                    <Phone className="h-6 w-6" style={{ color: t.accentText }} /> {card.phone}
                  </a>
                )}
                {card.email && (
                  <a href={`mailto:${card.email}`} className="mt-4 flex items-center gap-3 text-[15px] hover:opacity-80" style={{ color: t.muted }}>
                    <Mail className="h-4 w-4" /> {card.email}
                  </a>
                )}
                {websiteHref && (
                  <a href={websiteHref} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-3 text-[15px] hover:opacity-80" style={{ color: t.muted }}>
                    <Globe className="h-4 w-4" /> {websiteHref.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                )}
                {(messengers.length > 0 || chips.length > 0) && (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {messengers.map((m) => {
                      const Icon = MESSENGER_META[m.kind].Icon;
                      return (
                        <a key={m.kind} href={m.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 border px-3.5 py-2 text-sm font-medium hover:opacity-80" style={{ borderRadius: 999, borderColor: t.border }}>
                          <Icon className="h-4 w-4" style={{ color: t.accentText }} /> {MESSENGER_META[m.kind].label}
                        </a>
                      );
                    })}
                    {chips.map((c) => (
                      <a key={c.url} href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 border px-3.5 py-2 text-sm font-medium hover:opacity-80" style={{ borderRadius: 999, borderColor: t.border, color: t.muted }}>
                        {SOCIAL_LABELS[c.type] ?? c.type} <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    ))}
                  </div>
                )}
                <div className="mt-7 flex flex-wrap gap-3">
                  <a
                    href={p.vcardUrl}
                    download={`${card.fullName}.vcf`}
                    className="inline-flex items-center gap-2 border px-5 py-3 text-sm font-semibold hover:opacity-80"
                    style={{ borderRadius: t.radius, borderColor: t.border }}
                  >
                    <Download className="h-4 w-4" style={{ color: t.accentText }} /> Сохранить контакт
                  </a>
                  {tipsHref && (
                    <a href={tipsHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border px-5 py-3 text-sm font-semibold hover:opacity-80" style={{ borderRadius: t.radius, borderColor: t.border }}>
                      {card.tipsLabel || "Оставить чаевые"}
                    </a>
                  )}
                </div>
              </div>
              {p.publicUrl !== null && (
                <div className="flex items-center gap-6 border p-6" style={cardStyle}>
                  {qr ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qr} alt="QR-код визитки" width={112} height={112} className="h-28 w-28 shrink-0 rounded-lg bg-white p-1" />
                  ) : (
                    <div className="h-28 w-28 shrink-0 rounded-lg" style={{ background: t.band }} />
                  )}
                  <div>
                    <p className="inline-flex items-center gap-1.5 font-semibold">
                      <Smartphone className="h-4 w-4" style={{ color: t.accentText }} /> Контакт на телефон
                    </p>
                    <p className="mt-1 text-sm leading-relaxed" style={{ color: t.muted }}>
                      Наведите камеру — откроется визитка, номер сохранится в один тап.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Section>
      </main>

      <footer className="border-t" style={{ borderColor: t.border }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-10 py-10 text-sm" style={{ color: t.muted }}>
          <span>
            © {new Date().getFullYear()} {card.fullName}
            {card.title ? ` · ${card.title}` : ""}
          </span>
          {p.watermark === "promo" && (
            <a
              href="https://qrstars.ru/qr-vizitka-mastera.html?utm_source=card_site&utm_medium=watermark&utm_campaign=business_card"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 border px-4 py-2 font-medium hover:opacity-80"
              style={{ borderRadius: 999, borderColor: t.border, color: t.text }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-mark.svg" alt="" className="h-5 w-5" />
              Сделано в QrStars · сделать такую же визитку бесплатно →
            </a>
          )}
        </div>
      </footer>
      {p.overlay}
    </div>
  );
}
