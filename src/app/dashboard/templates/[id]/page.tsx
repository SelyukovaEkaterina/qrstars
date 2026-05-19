"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import TemplateConstructor from "@/components/dashboard/TemplateConstructor";
import { generatePDFFromLayout, generateQRForPDF } from "@/lib/pdf-generator";
import { TemplateData, TemplateLayout } from "@/types/template";
import { Loader2, ArrowLeft, AlertCircle } from "lucide-react";

export default function TemplateEditorPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;

    fetch(`/api/templates/${templateId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        setTemplate(data.template);
        setLoading(false);
      })
      .catch(() => {
        setError("Шаблон не найден");
        setLoading(false);
      });
  }, [status, router, templateId]);

  const handleSave = useCallback(
    async (name: string, layout: TemplateLayout) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/templates/${templateId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, layout }),
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Ошибка сохранения");
          return;
        }
        const data = await res.json();
        setTemplate(data.template);
      } catch {
        alert("Ошибка соединения");
      } finally {
        setSaving(false);
      }
    },
    [templateId]
  );

  const handleDownloadPDF = useCallback(async (layout: TemplateLayout) => {
    try {
      const qrEl = layout.elements.find((e) => e.type === "qr");
      const qrDataUrl = await generateQRForPDF(
        "https://qrstars.ru",
        qrEl?.qrColor || "#1e1b4b",
        qrEl?.qrBgColor || "#ffffff"
      );
      await generatePDFFromLayout(layout, qrDataUrl);
    } catch (e) {
      console.error("PDF error:", e);
      alert("Ошибка генерации PDF");
    }
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </main>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="text-lg text-gray-500">{error || "Шаблон не найден"}</p>
            <button
              onClick={() => router.push("/dashboard/templates")}
              className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800"
            >
              <ArrowLeft className="w-4 h-4" />
              Назад к шаблонам
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <TemplateConstructor
          initialLayout={template.layout as TemplateLayout}
          templateName={template.name}
          onSave={handleSave}
          onDownloadPDF={handleDownloadPDF}
          saving={saving}
        />
      </main>
    </div>
  );
}
