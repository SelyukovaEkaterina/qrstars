"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import {
  renderSticker,
  DEFAULT_STICKER_CONFIG,
  FORMATS,
  type StickerConfig,
} from "@/components/dashboard/StickerDesigner";
import { Loader2, Plus, Pencil, Trash2, X } from "lucide-react";

/* ── Types ── */
interface TemplateRow {
  id: string;
  name: string;
  layout: { __type?: string; stickerConfig?: StickerConfig };
  createdAt: string;
  _qrCount?: number;
}

/* ── Thumbnail canvas ── */
function StickerThumb({ cfg }: { cfg: StickerConfig }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const fmt = FORMATS.find((f) => f.id === cfg.formatId) || FORMATS[0];

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const thumbFmt = { ...fmt, previewW: 140, previewH: 140, dpi: 72 };
    renderSticker(c, cfg, thumbFmt, true).catch(() => {});
  }, [cfg, fmt]);

  return (
    <canvas
      ref={ref}
      style={{ display: "block", width: 140, height: 140 }}
    />
  );
}

/* ── Main page ── */
export default function TemplatesPage() {
  const { status } = useSession();
  const router = useRouter();

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [deleting, setDeleting]   = useState<string | null>(null);

  /* create-new modal state */
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]       = useState("");
  const [creating, setCreating]     = useState(false);

  /* rename modal */
  const [renaming, setRenaming]     = useState<TemplateRow | null>(null);
  const [renameVal, setRenameVal]   = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/templates");
      const d = await r.json();
      const rows: TemplateRow[] = (d.templates || []).filter(
        (t: TemplateRow) => t.layout?.__type === "sticker",
      );
      setTemplates(rows);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load]);

  /* ── create new template ── */
  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const cfg: StickerConfig = { ...DEFAULT_STICKER_CONFIG };
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          layout: {
            __type: "sticker",
            width: 50,
            height: 50,
            background: { type: "solid", color: "#fff" },
            elements: [],
            stickerConfig: cfg,
          },
        }),
      });
      if (!res.ok) return;
      const d = await res.json();
      router.push(`/dashboard/templates/${d.template.id}`);
    } finally {
      setCreating(false);
    }
  };

  /* ── delete ── */
  const handleDelete = async (id: string) => {
    if (!confirm("Удалить шаблон?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/templates/${id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  /* ── rename ── */
  const handleRename = async () => {
    if (!renaming || !renameVal.trim()) return;
    await fetch(`/api/templates/${renaming.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameVal.trim() }),
    });
    setTemplates((prev) =>
      prev.map((t) => (t.id === renaming.id ? { ...t, name: renameVal.trim() } : t)),
    );
    setRenaming(null);
  };

  /* ── render ── */
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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Шаблоны печати</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Дизайны стикеров и табличек, которые можно привязать к QR-коду
              </p>
            </div>
            <button
              onClick={() => { setNewName(""); setShowCreate(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
            >
              <Plus size={16} />
              Новый шаблон
            </button>
          </div>

          {/* Empty state */}
          {templates.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
              <div className="text-5xl mb-4">🖨️</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Нет шаблонов</h3>
              <p className="text-gray-500 text-sm mb-5">
                Создайте дизайн стикера или таблички и привяжите к QR-коду
              </p>
              <button
                onClick={() => { setNewName(""); setShowCreate(true); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
              >
                <Plus size={16} />
                Создать первый шаблон
              </button>
            </div>
          )}

          {/* Template grid */}
          {templates.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {templates.map((tpl) => {
                const cfg = tpl.layout?.stickerConfig || DEFAULT_STICKER_CONFIG;
                const fmt = FORMATS.find((f) => f.id === cfg.formatId) || FORMATS[0];
                return (
                  <div
                    key={tpl.id}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md hover:border-indigo-200 transition-all"
                  >
                    {/* Preview */}
                    <button
                      onClick={() => router.push(`/dashboard/templates/${tpl.id}`)}
                      className="block w-full bg-gray-50 flex items-center justify-center p-3"
                      style={{ minHeight: 160 }}
                    >
                      <div className="rounded-lg overflow-hidden shadow-sm">
                        <StickerThumb cfg={cfg} />
                      </div>
                    </button>

                    {/* Footer */}
                    <div className="p-3 border-t border-gray-100">
                      <p className="font-medium text-gray-900 text-sm truncate mb-1">
                        {tpl.name}
                      </p>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                          {fmt.name}
                        </span>
                        <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded capitalize">
                          {cfg.layoutId || cfg.themeId || "standard"} · {cfg.paletteId || "light"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => router.push(`/dashboard/templates/${tpl.id}`)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Pencil size={11} />
                          Редактировать
                        </button>
                        <button
                          onClick={() => { setRenaming(tpl); setRenameVal(tpl.name); }}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Переименовать"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(tpl.id)}
                          disabled={deleting === tpl.id}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                          title="Удалить"
                        >
                          {deleting === tpl.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <Trash2 size={12} />
                          }
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ── Create modal ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900 text-lg">Новый шаблон</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Название</label>
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Например: Ресторан 5×5"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
              maxLength={60}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {creating ? "Создание…" : "Создать и открыть"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rename modal ── */}
      {renaming && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900 text-lg">Переименовать</h3>
              <button onClick={() => setRenaming(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <input
              autoFocus
              type="text"
              value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
              maxLength={60}
            />
            <div className="flex gap-3">
              <button onClick={() => setRenaming(null)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Отмена</button>
              <button onClick={handleRename} disabled={!renameVal.trim()} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
