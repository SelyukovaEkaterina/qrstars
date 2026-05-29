"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import StickerDesigner, {
  DEFAULT_STICKER_CONFIG,
  type StickerConfig,
} from "@/components/dashboard/StickerDesigner";
import { Loader2, ArrowLeft } from "lucide-react";

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
      .then((d) => { setTpl(d.template); setLoading(false); })
      .catch(() => { setError("Шаблон не найден"); setLoading(false); });
  }, [status, templateId]);

  const handleSave = useCallback(async (cfg: StickerConfig) => {
    if (!tpl) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/templates/${tpl.id}`, {
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
      if (!res.ok) return;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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
            <button onClick={() => router.push("/dashboard/templates")}
              className="text-indigo-600 hover:underline text-sm">
              ← К шаблонам
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
              onClick={() => router.push("/dashboard/templates")}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{tpl.name}</h1>
              <p className="text-sm text-gray-500">
                Дизайн таблички · в предпросмотре — статический QR, для печати с динамическим QR — в настройках QR-кода
              </p>
            </div>
            {saved && (
              <span className="ml-auto text-sm font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                Сохранено ✓
              </span>
            )}
          </div>

          <StickerDesigner
            variant="template"
            initialConfig={tpl.layout?.stickerConfig || DEFAULT_STICKER_CONFIG}
            onSave={handleSave}
            saving={saving}
          />
        </div>
      </main>
    </div>
  );
}
