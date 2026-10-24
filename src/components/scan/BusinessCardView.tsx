"use client";

import { useMemo, useState } from "react";
import { Check, Clock, Loader2, MapPin, MessageCircle, Phone, Share2, Star } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import {
  headingColor,
  mutedColor,
  panelStyle,
  rowSurfaceStyle,
  scanRootStyle,
  submutedColor,
} from "@/lib/brand-theme-ui";
import { useBrandThemeScan, type BrandThemeScanProps } from "@/components/scan/brand-theme-props";
import ConsentCheckbox from "@/components/scan/ConsentCheckbox";
import { useConsentGate } from "@/components/scan/use-consent-gate";
import { guestPdPolicyUrl, type PdConsent } from "@/lib/pd-consent";
import {
  buildBusinessCardVCard,
  cardChipLinks,
  cardMessengerButtons,
  normalizeCardServices,
  safeHttpUrl,
  telHref,
  yandexMapsSearchHref,
  type CardMessengerKind,
  type PublicBusinessCard,
} from "@/lib/business-card";

export type BusinessCardData = PublicBusinessCard;

const socialLabels: Record<string, { label: string; icon: string }> = {
  telegram: { label: "Telegram", icon: "✈️" },
  whatsapp: { label: "WhatsApp", icon: "📞" },
  max: { label: "MAX", icon: "💬" },
  vk: { label: "VK", icon: "💻" },
  instagram: { label: "Instagram", icon: "📷" },
  facebook: { label: "Facebook", icon: "💻" },
  youtube: { label: "YouTube", icon: "🎥" },
  tiktok: { label: "TikTok", icon: "🎮" },
  twitter: { label: "Twitter / X", icon: "🐦" },
  linkedin: { label: "LinkedIn", icon: "💼" },
  github: { label: "GitHub", icon: "💻" },
};

const messengerMeta: Record<CardMessengerKind, { label: string; color: string }> = {
  whatsapp: { label: "WhatsApp", color: "#25D366" },
  telegram: { label: "Telegram", color: "#229ED9" },
  max: { label: "MAX", color: "#7B3FE4" },
};

interface BusinessCardViewProps extends BrandThemeScanProps {
  card: BusinessCardData;
  qrCode?: string;
  /** Публичная ссылка на визитку — для «Поделиться» и vCard. */
  shareUrl?: string;
  showContactForm?: boolean;
  isBg?: boolean;
  pdConsent?: PdConsent;
  watermarkEnabled?: boolean;
}

export default function BusinessCardView({
  card,
  qrCode,
  shareUrl,
  showContactForm,
  brandColor,
  pageAppearance,
  isBg,
  pdConsent,
  watermarkEnabled = true,
}: BusinessCardViewProps) {
  const { theme, dark } = useBrandThemeScan({ brandColor, pageAppearance });
  const accent = "var(--brand-600)";
  const vcard = useMemo(() => buildBusinessCardVCard(card, { cardUrl: shareUrl }), [card, shareUrl]);
  const vcardUrl = useMemo(() => `data:text/vcard;charset=utf-8,${encodeURIComponent(vcard)}`, [vcard]);
  const phoneHref = telHref(card.phone);
  const messengers = useMemo(() => cardMessengerButtons(card), [card]);
  const chips = useMemo(() => cardChipLinks(card), [card]);
  const services = useMemo(() => normalizeCardServices(card.services), [card.services]);
  const websiteHref = safeHttpUrl(card.website);
  const reviewsHref = safeHttpUrl(card.reviewsUrl);
  const tipsHref = safeHttpUrl(card.tipsUrl);

  const [contactOpen, setContactOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [contactError, setContactError] = useState("");
  const [contactSuccess, setContactSuccess] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Согласие — когда гость оставляет телефон или у владельца опубликована своя политика.
  const needsConsent = !!pdConsent?.ready || guestPhone.trim() !== "";
  const policyUrl = guestPdPolicyUrl(pdConsent);
  const { consentChecked, setConsentChecked, consentHighlight, consentRef, ensureConsent } =
    useConsentGate(needsConsent);

  const initials = card.fullName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleShare = async () => {
    const url = shareUrl || (typeof window !== "undefined" ? window.location.href : "");
    if (!url) return;
    const text = [card.fullName, card.title].filter(Boolean).join(" — ");
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: card.fullName, text, url });
        return;
      } catch {
        // отмена шаринга — не ошибка; ниже не копируем, чтобы не мешать
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      /* буфер обмена недоступен */
    }
  };

  const handleSendContact = async () => {
    if (!qrCode) return;

    if (!guestName.trim()) {
      setContactError("Укажите ваше имя");
      return;
    }
    if (!message.trim() || message.trim().length < 2) {
      setContactError("Напишите сообщение (минимум 2 символа)");
      return;
    }
    if (!ensureConsent()) return;

    setSending(true);
    setContactError("");

    try {
      const res = await fetch("/api/business-cards/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrCode,
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim() || undefined,
          message: message.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setContactError(data.error || "Не удалось отправить");
        return;
      }

      setContactSuccess(true);
      setGuestName("");
      setGuestPhone("");
      setMessage("");
    } catch {
      setContactError("Ошибка соединения");
    } finally {
      setSending(false);
    }
  };

  const rowClass = "flex items-center gap-3 p-3 rounded-xl border transition-colors hover:opacity-90";

  return (
    <div
      className="flex-1 min-h-[inherit] flex flex-col items-center px-4 py-8 relative"
      style={scanRootStyle(theme, { isBg })}
    >
      <div className="w-full max-w-sm relative z-10">
        <div
          className="backdrop-blur-md rounded-2xl shadow-xl overflow-hidden border"
          style={panelStyle(isBg)}
        >
          <div
            className="h-28 relative"
            style={{
              background: `linear-gradient(135deg, var(--brand-600), var(--brand-500))`,
            }}
          >
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
              {card.avatarUrl ? (
                <img
                  src={card.avatarUrl}
                  alt={card.fullName}
                  className="w-24 h-24 rounded-full border-4 border-white shadow-lg object-cover"
                />
              ) : (
                <div
                  className="w-24 h-24 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-2xl font-bold text-white"
                  style={{ backgroundColor: accent }}
                >
                  {initials}
                </div>
              )}
            </div>
          </div>

          <div className="pt-14 pb-4 px-6 text-center">
            <h1 className="text-xl font-bold" style={{ color: headingColor(isBg) }}>
              {card.fullName}
            </h1>
            {card.title && (
              <p className="text-sm mt-0.5" style={{ color: mutedColor(isBg) }}>
                {card.title}
              </p>
            )}
            {card.company && (
              <p className="text-sm font-medium mt-0.5" style={{ color: mutedColor(isBg) }}>
                {card.company}
              </p>
            )}
            {(card.serviceArea || card.workHours) && (
              <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs" style={{ color: mutedColor(isBg) }}>
                {card.serviceArea && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {card.serviceArea}
                  </span>
                )}
                {card.workHours && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {card.workHours}
                  </span>
                )}
              </div>
            )}
          </div>

          {(phoneHref || messengers.length > 0) && (
            <div className="px-6 pb-4 space-y-2">
              {phoneHref && (
                <a
                  href={phoneHref}
                  className="flex w-full items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold transition-opacity hover:opacity-90"
                  style={{ backgroundColor: accent }}
                >
                  <Phone className="w-5 h-5" />
                  Позвонить
                </a>
              )}
              {messengers.length > 0 && (
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${messengers.length}, minmax(0, 1fr))` }}
                >
                  {messengers.map((m) => (
                    <a
                      key={m.kind}
                      href={m.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center py-3 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
                      style={{ backgroundColor: messengerMeta[m.kind].color }}
                    >
                      {messengerMeta[m.kind].label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {card.about && (
            <div className="px-6 pb-4">
              <p className="text-sm text-center leading-relaxed whitespace-pre-line" style={{ color: mutedColor(isBg) }}>
                {card.about}
              </p>
            </div>
          )}

          {services.length > 0 && (
            <div className="px-6 pb-4">
              <h2 className="text-sm font-semibold mb-2" style={{ color: headingColor(isBg) }}>
                Услуги и цены
              </h2>
              <ul className="rounded-xl border divide-y" style={rowSurfaceStyle(isBg)}>
                {services.map((s, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 px-3 py-2.5 text-sm">
                    <span style={{ color: headingColor(isBg) }}>{s.name}</span>
                    {s.price && (
                      <span className="shrink-0 font-semibold" style={{ color: headingColor(isBg) }}>
                        {s.price}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reviewsHref && (
            <div className="px-6 pb-4">
              <a
                href={reviewsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 py-3 rounded-xl font-medium border-2 transition-opacity hover:opacity-90"
                style={{ borderColor: accent, color: accent }}
              >
                <Star className="w-4 h-4" />
                Отзывы обо мне
              </a>
            </div>
          )}

          {(card.email || websiteHref || card.address) && (
            <div className="px-6 pb-4 space-y-2">
              {card.email && (
                <a href={`mailto:${card.email}`} className={rowClass} style={rowSurfaceStyle(isBg)}>
                  <span className="text-lg">{"✉️"}</span>
                  <div className="min-w-0">
                    <p className="text-xs" style={{ color: submutedColor(isBg) }}>Email</p>
                    <p className="text-sm font-medium break-all" style={{ color: headingColor(isBg) }}>{card.email}</p>
                  </div>
                </a>
              )}
              {websiteHref && (
                <a
                  href={websiteHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={rowClass}
                  style={rowSurfaceStyle(isBg)}
                >
                  <span className="text-lg">{"🌐"}</span>
                  <div className="min-w-0">
                    <p className="text-xs" style={{ color: submutedColor(isBg) }}>Сайт</p>
                    <p className="text-sm font-medium break-all" style={{ color: headingColor(isBg) }}>
                      {websiteHref.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </p>
                  </div>
                </a>
              )}
              {card.address && (
                <a
                  href={yandexMapsSearchHref(card.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={rowClass}
                  style={rowSurfaceStyle(isBg)}
                >
                  <span className="text-lg">{"📍"}</span>
                  <div className="min-w-0">
                    <p className="text-xs" style={{ color: submutedColor(isBg) }}>Адрес</p>
                    <p className="text-sm font-medium" style={{ color: headingColor(isBg) }}>{card.address}</p>
                  </div>
                </a>
              )}
            </div>
          )}

          {chips.length > 0 && (
            <div className="px-6 pb-4">
              <div className="flex flex-wrap justify-center gap-2">
                {chips.map((link, i) => {
                  const meta = socialLabels[link.type] || { label: link.type, icon: "💻" };
                  return (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium text-white transition-transform hover:scale-105"
                      style={{ backgroundColor: accent }}
                    >
                      <span>{meta.icon}</span>
                      {meta.label}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {showContactForm && qrCode && (
            <div className="px-6 pb-4">
              {!contactOpen && !contactSuccess ? (
                <button
                  type="button"
                  onClick={() => setContactOpen(true)}
                  className="w-full py-3 rounded-xl text-center font-medium border-2 transition-colors flex items-center justify-center gap-2"
                  style={{ borderColor: accent, color: accent }}
                >
                  <MessageCircle className="w-4 h-4" />
                  Оставить заявку
                </button>
              ) : contactSuccess ? (
                <div
                  className="p-4 rounded-xl text-center text-sm"
                  style={{ backgroundColor: "var(--brand-50)", color: "var(--brand-600)" }}
                >
                  <p className="font-medium">Сообщение отправлено!</p>
                  <p className="mt-1" style={{ color: mutedColor(isBg) }}>
                    {card.fullName} получит его и свяжется с вами.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setContactSuccess(false);
                      setContactOpen(false);
                    }}
                    className="mt-3 text-sm underline"
                    style={{ color: accent }}
                  >
                    Написать ещё
                  </button>
                </div>
              ) : (
                <div
                  className="space-y-3 p-4 rounded-xl border"
                  style={rowSurfaceStyle(isBg)}
                >
                  <p className="text-sm font-medium text-center" style={{ color: headingColor(isBg) }}>
                    Написать {card.fullName}
                  </p>
                  <Input
                    label="Ваше имя"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Как к вам обращаться"
                    maxLength={100}
                  />
                  <Input
                    label="Телефон для ответа"
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="+7 (999) 123-45-67"
                    maxLength={40}
                  />
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isBg ? "text-white/80" : dark ? "text-slate-300" : "text-gray-700"}`}>Сообщение</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={4}
                      maxLength={2000}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                        isBg
                          ? "bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-white/50"
                          : dark
                            ? "bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:ring-indigo-400"
                            : "border-gray-300 focus:ring-indigo-500"
                      }`}
                      placeholder="Что нужно сделать, адрес, удобное время..."
                    />
                  </div>
                  {needsConsent && (
                    <ConsentCheckbox
                      ref={consentRef}
                      checked={consentChecked}
                      onChange={setConsentChecked}
                      policyUrl={policyUrl}
                      isBg={isBg}
                      dark={dark}
                      highlight={consentHighlight}
                    />
                  )}
                  {contactError && <p className="text-sm text-red-600">{contactError}</p>}
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={handleSendContact}
                      disabled={sending}
                      style={{ backgroundColor: accent }}
                    >
                      {sending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Отправка...
                        </>
                      ) : (
                        "Отправить"
                      )}
                    </Button>
                    <Button variant="outline" onClick={() => setContactOpen(false)} disabled={sending}>
                      Отмена
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tipsHref && (
            <div className="px-6 pb-4">
              <a
                href={tipsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 rounded-xl text-center font-medium transition-opacity hover:opacity-90 border-2"
                style={{ borderColor: accent, color: accent }}
              >
                {card.tipsLabel || "Оставить чаевые"}
              </a>
            </div>
          )}

          <div className="px-6 pb-6 flex gap-2">
            <a
              href={vcardUrl}
              download={`${card.fullName}.vcf`}
              className="flex-1 block py-3 rounded-xl text-center text-white font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              {"💾"} Сохранить контакт
            </a>
            {qrCode && (
              <button
                type="button"
                onClick={() => void handleShare()}
                className="shrink-0 px-4 rounded-xl border-2 transition-opacity hover:opacity-90"
                style={{ borderColor: accent, color: accent }}
                aria-label="Поделиться визиткой"
                title="Поделиться визиткой"
              >
                {shareCopied ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {watermarkEnabled && (
          <p className="text-center text-xs mt-6 relative z-10" style={{ color: submutedColor(isBg) }}>
            <a href="https://qrstars.ru/qr-business-cards.html?utm_source=qrstars&utm_medium=watermark&utm_campaign=business_card" target="_blank" rel="noopener noreferrer">
              QrStars.ru — сделать такую визитку бесплатно
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
