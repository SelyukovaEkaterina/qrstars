"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import StickerDesigner, {
  DEFAULT_STICKER_CONFIG,
  type StickerConfig,
  type SaveAndApplyPayload,
} from "@/components/dashboard/StickerDesigner";
import { Loader2, ArrowLeft } from "lucide-react";
import { TEMPLATE_ROUTES } from "@/lib/template-routes";

interface TemplateData {
  id: string;
  name: string;
  layout: { __type?: string; stickerConfig?: StickerConfig };
}

export default function TemplateEditorPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;

  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [saved,   setSaved]     = useState(false);
  const [tpl,     setTpl]       = useState<TemplateData | null>(null);
  const [error,   setError]     = useState("");
  const [applyError, setApplyError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(`/api/templates/${templateId}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((d) => {
        if (d.template?.readOnly) {
          router.replace(TEMPLATE_ROUTES.tableTents);
          return;
        }
        setTpl(d.template);
        setLoading(false);
      })
      .catch(() => { setError("Шаблон не найден"); setLoading(false); });
  }, [status, templateId]);

  const handleSaveAndApply = useCallback(async ({
    cfg,
    qrId,
    qrStyleTemplateId,
  }: SaveAndApplyPayload) => {
    if (!tpl) return;
    setSaving(true);
    setApplyError("");
    try {
      const templateRes = await fetch(`/api/templates/${tpl.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layout: {
            __type: "sticker",
            width: 50, height: 50,
            background: { type: "solid", color: "#fff" },
            elements: [],
            stickerConfig: cfg,
          },
        }),
      });
      if (!templateRes.ok) {
        setApplyError("Не удалось сохранить шаблон таблички");
        return;
      }

      const qrRes = await fetch("/api/qrcodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: qrId,
          templateId: tpl.id,
          qrStyleTemplateId,
        }),
      });
      if (!qrRes.ok) {
        setApplyError("Шаблон сохранён, но не удалось применить к QR-коду");
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }, [tpl]);

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
        </main>
      </div>
    );
  }

  if (error || !tpl) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-4">{error || "Шаблон не найден"}</p>
            <button onClick={() => router.push(TEMPLATE_ROUTES.tableTents)}
              className="text-indigo-600 hover:underline text-sm">
              ← К шаблонам табличек
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.push(TEMPLATE_ROUTES.tableTents)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{tpl.name}</h1>
              <p className="text-sm text-gray-500">
                Дизайн таблички · сохранение применяет макет и оформление QR к выбранному коду
              </p>
            </div>
            {saved && (
              <span className="ml-auto text-sm font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                Сохранено и применено ✓
              </span>
            )}
          </div>

          {applyError && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {applyError}
            </p>
          )}

          <StickerDesigner
            variant="template"
            initialConfig={tpl.layout?.stickerConfig || DEFAULT_STICKER_CONFIG}
            onSaveAndApply={handleSaveAndApply}
            saving={saving}
          />
        </div>
      </main>
    </div>
  );
}
