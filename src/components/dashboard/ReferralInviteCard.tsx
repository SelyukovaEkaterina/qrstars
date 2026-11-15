"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Gift, Send, MessageCircle, Share2 } from "lucide-react";
import { trackEvent } from "@/lib/track-event";

interface ReferralLinkData {
  referralLink: string;
  bonusDays: number;
}

export function referralShareText(link: string, bonusDays: number): string {
  return `Делаю QR-коды для бизнеса в QrStars: отзывы на Яндекс Картах и 2ГИС, меню, визитка — бесплатно. Регистрируйся по моей ссылке: если подключишь PRO, получишь ещё ${bonusDays} дней в подарок. ${link}`;
}

/**
 * Ссылка «Приведи друга» с кнопками «Копировать / Telegram / WhatsApp».
 * `place` пишется в событие `dash.referral_link_shared` — видно, откуда делятся.
 */
export function ReferralShareButtons({
  link,
  bonusDays,
  place,
  tone = "light",
}: {
  link: string;
  bonusDays: number;
  place: string;
  tone?: "light" | "dark";
}) {
  const [copied, setCopied] = useState(false);
  const text = referralShareText(link, bonusDays);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      return;
    }
    setCopied(true);
    trackEvent("dash.referral_link_shared", { place, via: "copy" });
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    try {
      await navigator.share({ text });
      trackEvent("dash.referral_link_shared", { place, via: "share" });
    } catch {
      /* пользователь закрыл окно */
    }
  };

  const linkBox =
    tone === "dark"
      ? "border-white/20 bg-white/15 text-white"
      : "border-gray-200 bg-gray-50 text-gray-800";
  const secondary =
    tone === "dark"
      ? "border-white/30 text-white hover:bg-white/10"
      : "border-gray-300 text-gray-700 hover:bg-gray-50";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div
          className={`min-w-0 flex-1 break-all rounded-lg border px-3 py-2.5 font-mono text-sm sm:truncate sm:break-normal ${linkBox}`}
        >
          {link}
        </div>
        <button
          type="button"
          onClick={copy}
          className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
            tone === "dark"
              ? "bg-white text-indigo-700 hover:bg-indigo-50"
              : "bg-indigo-600 text-white hover:bg-indigo-700"
          }`}
        >
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? "Скопировано" : "Копировать"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text.replace(link, "").trim())}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("dash.referral_link_shared", { place, via: "telegram" })}
          className={`inline-flex min-h-10 items-center rounded-lg border px-3 py-2 text-sm font-medium transition ${secondary}`}
        >
          <Send className="mr-1.5 h-4 w-4" />
          Telegram
        </a>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("dash.referral_link_shared", { place, via: "whatsapp" })}
          className={`inline-flex min-h-10 items-center rounded-lg border px-3 py-2 text-sm font-medium transition ${secondary}`}
        >
          <MessageCircle className="mr-1.5 h-4 w-4" />
          WhatsApp
        </a>
        {canShare && (
          <button
            type="button"
            onClick={share}
            className={`inline-flex min-h-10 items-center rounded-lg border px-3 py-2 text-sm font-medium transition ${secondary}`}
          >
            <Share2 className="mr-1.5 h-4 w-4" />
            Поделиться
          </button>
        )}
      </div>
    </div>
  );
}

/** Компактный блок «Приведи друга» для других страниц кабинета (тарифы и т. п.). */
export default function ReferralInviteCard({ place }: { place: string }) {
  const [data, setData] = useState<ReferralLinkData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/partner")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.referralLink) {
          setData({ referralLink: d.referralLink, bonusDays: d.bonusDays });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="shrink-0 rounded-xl bg-emerald-100 p-2.5">
          <Gift className="h-5 w-5 text-emerald-700" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">
            PRO бесплатно: приведите друга — месяц вам и месяц ему
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Когда приглашённый оплатит PRO, вы получите {data.bonusDays} дней PRO, а он —{" "}
            {data.bonusDays} дней сверх оплаченного. Друзей без ограничений.{" "}
            <Link href="/dashboard/partner" className="font-medium text-emerald-700 hover:underline">
              Подробнее
            </Link>
          </p>
        </div>
      </div>
      <ReferralShareButtons link={data.referralLink} bonusDays={data.bonusDays} place={place} />
    </div>
  );
}
