"use client";

import { useMemo, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
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

interface SocialLink {
  type: string;
  url: string;
}

export interface BusinessCardData {
  id: string;
  fullName: string;
  title: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  about: string | null;
  avatarUrl: string | null;
  socialLinks: SocialLink[];
  accentColor: string;
}

const socialLabels: Record<string, { label: string; icon: string }> = {
  telegram: { label: "Telegram", icon: "\u2708\ufe0f" },
  whatsapp: { label: "WhatsApp", icon: "\ud83d\udcde" },
  vk: { label: "VK", icon: "\ud83d\udcbb" },
  instagram: { label: "Instagram", icon: "\ud83d\udcf7" },
  facebook: { label: "Facebook", icon: "\ud83d\udcbb" },
  youtube: { label: "YouTube", icon: "\ud83c\udfa5" },
  tiktok: { label: "TikTok", icon: "\ud83c\udfae" },
  twitter: { label: "Twitter / X", icon: "\ud83d\udc26" },
  linkedin: { label: "LinkedIn", icon: "\ud83d\udcbc" },
  github: { label: "GitHub", icon: "\ud83d\udcbb" },
};

function buildVCard(card: BusinessCardData): string {
  let vcard = "BEGIN:VCARD\nVERSION:3.0\n";
  vcard += `FN:${card.fullName}\n`;
  if (card.company) vcard += `ORG:${card.company}\n`;
  if (card.title) vcard += `TITLE:${card.title}\n`;
  if (card.phone) vcard += `TEL;TYPE=CELL:${card.phone}\n`;
  if (card.email) vcard += `EMAIL:${card.email}\n`;
  if (card.website) vcard += `URL:${card.website}\n`;
  if (card.address) vcard += `ADR;TYPE=WORK:;;${card.address};;;;\n`;
  if (card.about) vcard += `NOTE:${card.about}\n`;
  vcard += "END:VCARD";
  return vcard;
}

interface BusinessCardViewProps extends BrandThemeScanProps {
  card: BusinessCardData;
  qrCode?: string;
  showContactForm?: boolean;
  isBg?: boolean;
}

export default function BusinessCardView({
  card,
  qrCode,
  showContactForm,
  brandColor,
  pageAppearance,
  isBg,
}: BusinessCardViewProps) {
  const { theme, dark } = useBrandThemeScan({ brandColor, pageAppearance });
  const accent = "var(--brand-600)";
  const vcard = useMemo(() => buildVCard(card), [card]);
  const vcardUrl = useMemo(() => `data:text/vcard;charset=utf-8,${encodeURIComponent(vcard)}`, [vcard]);

  const [contactOpen, setContactOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [contactError, setContactError] = useState("");
  const [contactSuccess, setContactSuccess] = useState(false);

  const initials = card.fullName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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

    setSending(true);
    setContactError("");

    try {
      const res = await fetch("/api/business-cards/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrCode,
          guestName: guestName.trim(),
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
      setMessage("");
    } catch {
      setContactError("Ошибка соединения");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={`min-h-[inherit] ${isBg ? "" : ""} flex flex-col items-center px-4 py-8 relative`}
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

          <div className="pt-14 pb-6 px-6 text-center">
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
          </div>

          {card.about && (
            <div className="px-6 pb-4">
              <p className="text-sm text-center leading-relaxed" style={{ color: mutedColor(isBg) }}>
                {card.about}
              </p>
            </div>
          )}

          <div className="px-6 pb-4 space-y-2">
            {card.phone && (
              <a
                href={`tel:${card.phone}`}
                className="flex items-center gap-3 p-3 rounded-xl border transition-colors hover:opacity-90"
                style={rowSurfaceStyle(isBg)}
              >
                <span className="text-lg">{"\ud83d\udcde"}</span>
                <div>
                  <p className="text-xs" style={{ color: submutedColor(isBg) }}>
                    Телефон
                  </p>
                  <p className="text-sm font-medium" style={{ color: headingColor(isBg) }}>
                    {card.phone}
                  </p>
                </div>
              </a>
            )}
            {card.email && (
              <a
                href={`mailto:${card.email}`}
                className="flex items-center gap-3 p-3 rounded-xl border transition-colors hover:opacity-90"
                style={rowSurfaceStyle(isBg)}
              >
                <span className="text-lg">{"\u2709\ufe0f"}</span>
                <div>
                  <p className="text-xs" style={{ color: submutedColor(isBg) }}>Email</p>
                  <p className="text-sm font-medium" style={{ color: headingColor(isBg) }}>{card.email}</p>
                </div>
              </a>
            )}
            {card.website && (
              <a
                href={card.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl border transition-colors hover:opacity-90"
                style={rowSurfaceStyle(isBg)}
              >
                <span className="text-lg">{"\ud83c\udf10"}</span>
                <div>
                  <p className="text-xs" style={{ color: submutedColor(isBg) }}>Сайт</p>
                  <p className="text-sm font-medium" style={{ color: headingColor(isBg) }}>
                    {card.website.replace(/^https?:\/\//, "")}
                  </p>
                </div>
              </a>
            )}
            {card.address && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(card.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl border transition-colors hover:opacity-90"
                style={rowSurfaceStyle(isBg)}
              >
                <span className="text-lg">{"\ud83d\udccd"}</span>
                <div>
                  <p className="text-xs" style={{ color: submutedColor(isBg) }}>Адрес</p>
                  <p className="text-sm font-medium" style={{ color: headingColor(isBg) }}>{card.address}</p>
                </div>
              </a>
            )}
          </div>

          {card.socialLinks && card.socialLinks.length > 0 && (
            <div className="px-6 pb-4">
              <div className="flex flex-wrap justify-center gap-2">
                {card.socialLinks.map((link, i) => {
                  const meta = socialLabels[link.type] || { label: link.type, icon: "\ud83d\udcbb" };
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
                  Написать человеку
                </button>
              ) : contactSuccess ? (
                <div
                  className="p-4 rounded-xl text-center text-sm"
                  style={{ backgroundColor: "var(--brand-50)", color: "var(--brand-600)" }}
                >
                  <p className="font-medium">Сообщение отправлено!</p>
                  <p className="mt-1" style={{ color: mutedColor(isBg) }}>
                    Владелец визитки получит его в мессенджере.
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
                      placeholder="Ваш вопрос или предложение..."
                    />
                  </div>
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

          <div className="px-6 pb-6">
            <a
              href={vcardUrl}
              download={`${card.fullName}.vcf`}
              className="block w-full py-3 rounded-xl text-center text-white font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              {"\ud83d\udcbe"} Сохранить контакт
            </a>
          </div>
        </div>

        <p className="text-center text-xs mt-6 relative z-10" style={{ color: submutedColor(isBg) }}>
          QrStars.ru
        </p>
      </div>
    </div>
  );
}
