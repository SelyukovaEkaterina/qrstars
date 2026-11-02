"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Crown, Link2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { MICROSITE_HOST_SUFFIX } from "@/lib/microsite-host";
import { PLAN_PRICING } from "@/lib/plans";

interface CardShortAddressProps {
  projectId: string;
  hasPaidFeatures: boolean;
  initialSlug: string | null;
  suggestion: string;
}

/**
 * Короткий адрес визитки `{slug}.qrstars.ru` (PRO). На FREE — промо с примером адреса из имени мастера.
 * Адрес открывает саму визитку, пока у проекта нет микросайта (`/a/[slug]`).
 */
export default function CardShortAddress({
  projectId,
  hasPaidFeatures,
  initialSlug,
  suggestion,
}: CardShortAddressProps) {
  const [slug, setSlug] = useState(initialSlug ?? suggestion);
  const [savedSlug, setSavedSlug] = useState(initialSlug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  if (!hasPaidFeatures) {
    const price = PLAN_PRICING.PRO.yearlyRub.toLocaleString("ru-RU");
    return (
      <Card className="border-indigo-200 bg-indigo-50/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-indigo-900">
              <Crown className="h-4 w-4 text-amber-500" />
              Свой адрес визитки
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-gray-900">
              {suggestion}
              {MICROSITE_HOST_SUFFIX}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Легко продиктовать по телефону, написать на машине и кинуть в чат ЖК. Плюс без подписи QrStars внизу
              визитки. PRO — {price} ₽ в год ({PLAN_PRICING.PRO.yearlyNote}).
            </p>
          </div>
          <Link
            href="/dashboard/subscription"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Подключить PRO
          </Link>
        </div>
      </Card>
    );
  }

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const value = slug.trim().toLowerCase();
      const res = await fetch(`/api/establishments/${projectId}/page`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortSlug: value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Не удалось сохранить адрес");
        return;
      }
      setSavedSlug(value || null);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setSaving(false);
    }
  };

  const url = savedSlug ? `https://${savedSlug}${MICROSITE_HOST_SUFFIX}` : null;
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* буфер обмена недоступен */
    }
  };

  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
        <Link2 className="h-4 w-4 text-indigo-600" />
        Свой адрес визитки
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-indigo-500">
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            className="min-w-0 flex-1 rounded-l-lg bg-transparent px-3 py-2 font-mono text-sm text-gray-900 outline-none"
            placeholder={suggestion}
            aria-label="Короткий адрес"
            maxLength={32}
          />
          <span className="pr-3 font-mono text-sm text-gray-500">{MICROSITE_HOST_SUFFIX}</span>
        </div>
        <Button size="sm" onClick={() => void save()} disabled={saving || slug.trim() === (savedSlug ?? "")}>
          {saving ? "Сохраняем…" : "Сохранить"}
        </Button>
        {url && (
          <Button variant="outline" size="sm" onClick={() => void copy()}>
            {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
            {copied ? "Скопировано" : "Копировать"}
          </Button>
        )}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      ) : url ? (
        <p className="mt-2 text-sm text-gray-600">
          Визитка открывается по адресу{" "}
          <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:underline">
            {url.replace("https://", "")}
          </a>
          . QR-код на наклейках не меняется.
        </p>
      ) : (
        <p className="mt-2 text-sm text-gray-500">Латиница, цифры и дефис, от 2 до 32 символов.</p>
      )}
    </Card>
  );
}
