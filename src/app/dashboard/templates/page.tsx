"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Sidebar from "@/components/dashboard/Sidebar";
import { Loader2, Plus, Palette, Trash2, Copy, X } from "lucide-react";
import { TEMPLATE_PRESETS, createBlankLayout } from "@/lib/template-presets";
import { TemplateData, TemplateLayout } from "@/types/template";

export default function TemplatesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      if (!res.ok) return;
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;
    
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data.templates || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, router]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      let layout: TemplateLayout;
      if (selectedPreset !== null) {
        const preset = TEMPLATE_PRESETS[selectedPreset];
        layout = {
          ...preset.layout,
          elements: preset.layout.elements.map((el) => ({
            ...el,
            id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          })),
        };
      } else {
        layout = createBlankLayout();
      }

      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, layout }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Ошибка создания");
        return;
      }

      const data = await res.json();
      router.push(`/dashboard/templates/${data.template.id}`);
    } catch {
      alert("Ошибка соединения");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить шаблон?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/templates/${id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch {
      alert("Ошибка удаления");
    } finally {
      setDeleting(null);
    }
  };

  const handleDuplicate = async (t: TemplateData) => {
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${t.name} (копия)`,
          description: t.description,
          width: t.width,
          height: t.height,
          layout: {
            ...t.layout,
            elements: t.layout.elements.map((el: TemplateLayout["elements"][0]) => ({
              ...el,
              id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            })),
          },
        }),
      });
      if (res.ok) {
        fetchTemplates();
      }
    } catch {
      alert("Ошибка");
    }
  };

  const getPreviewStyle = (layout: TemplateLayout): React.CSSProperties => {
    const bg = layout.background;
    if (bg.type === "gradient" && bg.gradientFrom && bg.gradientTo) {
      return { background: `linear-gradient(${bg.gradientAngle || 180}deg, ${bg.gradientFrom}, ${bg.gradientTo})` };
    }
    return { backgroundColor: bg.color || "#fff" };
  };

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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Шаблоны табличек</h1>
              <p className="text-gray-500 mt-1">Создавайте дизайны для QR-табличек</p>
            </div>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Создать шаблон
            </Button>
          </div>

          {showCreate && (
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Новый шаблон</h3>
                <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Например: Стол 1, Бар..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Выберите готовый дизайн или начните с чистого
                </label>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  <button
                    onClick={() => setSelectedPreset(null)}
                    className={`rounded-xl border-2 overflow-hidden transition-all ${
                      selectedPreset === null ? "border-indigo-500 ring-2 ring-indigo-200" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="h-16 bg-white flex items-center justify-center">
                      <Plus className="w-6 h-6 text-gray-400" />
                    </div>
                    <div className="p-1.5 text-center">
                      <p className="text-[10px] font-medium text-gray-600">Пустой</p>
                    </div>
                  </button>
                  {TEMPLATE_PRESETS.map((preset, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedPreset(i)}
                      className={`rounded-xl border-2 overflow-hidden transition-all ${
                        selectedPreset === i ? "border-indigo-500 ring-2 ring-indigo-200" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div
                        className="h-16 flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: preset.thumbnail.bg }}
                      >
                        QR
                      </div>
                      <div className="p-1.5 text-center">
                        <p className="text-[10px] font-medium text-gray-600 truncate">{preset.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Создаём...
                    </>
                  ) : (
                    "Создать и открыть конструктор"
                  )}
                </Button>
                <Button variant="ghost" onClick={() => setShowCreate(false)}>
                  Отмена
                </Button>
              </div>
            </div>
          )}

          {templates.length === 0 && !showCreate ? (
            <div className="bg-white rounded-xl border p-12 text-center">
              <Palette className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900">Нет шаблонов</h2>
              <p className="text-gray-500 mt-2">Создайте первый шаблон таблички для QR-кода</p>
              <Button className="mt-4" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Создать шаблон
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => router.push(`/dashboard/templates/${t.id}`)}
                >
                  <div
                    className="h-36 flex items-center justify-center relative overflow-hidden"
                    style={getPreviewStyle(t.layout as TemplateLayout)}
                  >
                    <div className="text-white/60 text-sm font-bold">QR</div>
                    {t.layout.elements?.filter((e: { type: string }) => e.type === "text").slice(0, 2).map((el: { text?: string; color?: string }, i: number) => (
                      <div
                        key={i}
                        className="absolute inset-x-0 text-center px-4"
                        style={{
                          top: el === t.layout.elements[0] ? "12%" : "80%",
                          color: el.color || "#fff",
                          fontSize: "12px",
                          fontWeight: 600,
                          textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                        }}
                      >
                        {(el as { text?: string }).text}
                      </div>
                    ))}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{t.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {t.width}×{t.height} мм · {t.layout.elements?.length || 0} элементов
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicate(t);
                          }}
                          className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                          title="Дублировать"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(t.id);
                          }}
                          className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
                          title="Удалить"
                          disabled={deleting === t.id}
                        >
                          {deleting === t.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
