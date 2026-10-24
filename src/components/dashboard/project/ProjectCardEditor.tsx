"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, QrCode, Sparkles } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import BusinessCardConstructor, {
  type BusinessCardFormData,
} from "@/components/dashboard/BusinessCardConstructor";
import BusinessCardView from "@/components/scan/BusinessCardView";
import { scanUrlForCode } from "@/lib/utils";
import { projectQrNewPath, projectQrPath } from "@/lib/project-routes";
import type { PageAppearance } from "@/lib/brand-theme";

interface ProjectCardEditorProps {
  projectId: string;
  initialCard: BusinessCardFormData | null;
  brandColor: string;
  pageAppearance: PageAppearance;
  cardQrcodes: Array<{ id: string; code: string; label: string | null }>;
  welcome?: boolean;
}

export default function ProjectCardEditor({
  projectId,
  initialCard,
  brandColor,
  pageAppearance,
  cardQrcodes,
  welcome = false,
}: ProjectCardEditorProps) {
  const router = useRouter();
  const [preview, setPreview] = useState<BusinessCardFormData | null>(initialCard);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const primaryQr = cardQrcodes[0] ?? null;
  const publicUrl = primaryQr ? scanUrlForCode(primaryQr.code) : null;

  const handleSave = async (data: BusinessCardFormData) => {
    setSaving(true);
    setError("");
    const payload = { ...data, accentColor: brandColor };
    try {
      const res = await fetch("/api/business-cards", {
        method: data.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.id ? payload : { ...payload, establishmentId: projectId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Не удалось сохранить визитку");
        return;
      }
      setSavedAt(Date.now());
      if (!data.id) window.dispatchEvent(new Event("qrstars:projects-changed"));
      router.refresh();
    } catch {
      setError("Ошибка соединения");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* буфер обмена недоступен */
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">QR-визитка</h1>
        <p className="mt-1 text-sm text-gray-500">
          Клиент сканирует QR или открывает ссылку — и звонит, пишет в мессенджер или сохраняет ваш номер.
        </p>
      </div>

      {welcome && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 leading-relaxed">
          <Sparkles className="inline w-4 h-4 mr-1 text-amber-600" />
          Визитка создана. Добавьте фото и пару услуг с ценами — клиенту проще позвонить, когда он видит, с кем имеет дело и сколько это стоит.
        </div>
      )}

      <Card className="p-4">
        {publicUrl && primaryQr ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-500">Ссылка на визитку</p>
              <p className="break-all font-mono text-sm text-gray-800">{publicUrl}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void copyLink()}>
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? "Скопировано" : "Копировать"}
              </Button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Открыть
              </a>
              <Link
                href={projectQrPath(projectId, primaryQr.id)}
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <QrCode className="w-4 h-4 mr-1" />
                QR-код и дизайн
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              {initialCard
                ? "У визитки пока нет QR-кода. Создайте его и выберите «Быстрый доступ к разделу» → «Визитка»."
                : "Заполните и сохраните визитку, затем создайте для неё QR-код."}
            </p>
            {initialCard && (
              <Link
                href={projectQrNewPath(projectId)}
                className="inline-flex shrink-0 items-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <QrCode className="w-4 h-4 mr-1" />
                Создать QR-код
              </Link>
            )}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="min-w-0 space-y-3">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          {savedAt && !error && (
            <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              Визитка сохранена
            </div>
          )}
          <BusinessCardConstructor
            initialData={initialCard}
            onSave={handleSave}
            onChange={setPreview}
            saving={saving}
          />
        </div>

        <div className="hidden lg:block lg:sticky lg:top-6">
          <p className="mb-2 text-center text-xs font-medium text-gray-500">Так видит клиент</p>
          <div className="mx-auto h-[680px] w-[360px] overflow-y-auto rounded-[2.5rem] border-[10px] border-gray-900 bg-white shadow-xl flex flex-col">
            {preview?.fullName.trim() ? (
              <BusinessCardView
                card={{
                  ...preview,
                  id: preview.id ?? "preview",
                  services: (preview.services ?? []).filter((s) => s.name.trim()),
                }}
                brandColor={brandColor}
                pageAppearance={pageAppearance}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-gray-400">
                Введите имя — здесь появится визитка
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
