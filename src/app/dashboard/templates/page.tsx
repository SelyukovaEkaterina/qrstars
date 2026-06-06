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
import {
  QR_CODE_TEMPLATES,
  DEFAULT_QR_CONFIG,
  renderQRTemplate,
  canvasDisplaySize,
  normalizeQRTemplateConfig,
  type QRTemplateConfig,
  type QRTemplatePreset,
} from "@/lib/qr-code-templates";
import {
  BUILTIN_STICKER_TEMPLATES,
  isBuiltInStickerTemplateId,
} from "@/lib/builtin-sticker-templates";
import QRTemplateEditor from "@/components/dashboard/QRTemplateEditor";
import { Loader2, Plus, Pencil, Trash2, X, QrCode, LayoutTemplate } from "lucide-react";

type Tab = "qr" | "table-tent";

interface TemplateRow {
  id: string;
  name: string;
  layout: { __type?: string; stickerConfig?: StickerConfig; config?: QRTemplateConfig };
  createdAt: string;
}

function StickerThumb({ cfg }: { cfg: StickerConfig }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const fmt = FORMATS.find((f) => f.id === cfg.formatId) || FORMATS[0];
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const thumbFmt = { ...fmt, previewW: 140, previewH: 140, dpi: 72 };
    renderSticker(c, cfg, thumbFmt, true).catch(() => {});
  }, [cfg, fmt]);
  return <canvas ref={ref} style={{ display: "block", width: 140, height: 140 }} />;
}

function QRThumbFromConfig({ config, maxSide = 120 }: { config: QRTemplateConfig; maxSide?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: maxSide, height: maxSide });

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    renderQRTemplate(c, normalizeQRTemplateConfig(config), "https://qrstars.ru", 200)
      .then(() => setDisplaySize(canvasDisplaySize(c.width, c.height, maxSide)))
      .catch(() => {});
  }, [config, maxSide]);

  return (
    <canvas
      ref={ref}
      style={{ display: "block", width: displaySize.width, height: displaySize.height }}
    />
  );
}

function QRThumbFromPreset({ preset }: { preset: QRTemplatePreset }) {
  return <QRThumbFromConfig config={preset.config} />;
}

function newQRTemplatePreset(): QRTemplatePreset {
  const cfg = normalizeQRTemplateConfig({ ...DEFAULT_QR_CONFIG });
  return {
    id: "new",
    name: "Новый шаблон",
    description: "Настройте стиль QR-кода и сохраните",
    accent: cfg.fg,
    config: cfg,
  };
}

export default function TemplatesPage() {
  const { status } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("qr");

  const [stickerTemplates, setStickerTemplates] = useState<TemplateRow[]>([]);
  const [qrStyleTemplates, setQrStyleTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [renaming, setRenaming] = useState<TemplateRow | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const [editingPreset, setEditingPreset] = useState<QRTemplatePreset | null>(null);
  const [editingSaved, setEditingSaved] = useState<TemplateRow | null>(null);
  const [bindQrId, setBindQrId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam === "table-tent" || tabParam === "qr") setTab(tabParam);

    const bindQr = params.get("bindQr");
    if (bindQr) {
      setBindQrId(bindQr);
      setTab("qr");
      const presetParam = params.get("preset");
      const preset =
        presetParam != null
          ? QR_CODE_TEMPLATES.find((p) => p.id === presetParam) ?? QR_CODE_TEMPLATES[0]
          : QR_CODE_TEMPLATES[0];
      if (preset) {
        setEditingSaved(null);
        setEditingPreset(preset);
      }
      params.delete("bindQr");
      params.delete("preset");
      const next = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${next ? `?${next}` : ""}`,
      );
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/templates");
      const d = await r.json();
      const all: TemplateRow[] = d.templates || [];
      setStickerTemplates(
        all.filter(
          (t) => t.layout?.__type === "sticker" && !isBuiltInStickerTemplateId(t.id),
        ),
      );
      setQrStyleTemplates(
        all.filter(
          (t) => t.layout?.__type === "qr-style" && !t.id.startsWith("qr-preset-")
        )
      );
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load]);

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

  const handleDelete = async (id: string, type: "sticker" | "qr-style") => {
    if (!confirm("Удалить шаблон?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (type === "sticker") {
        setStickerTemplates((prev) => prev.filter((t) => t.id !== id));
      } else {
        setQrStyleTemplates((prev) => prev.filter((t) => t.id !== id));
      }
    } finally {
      setDeleting(null);
    }
  };

  const handleRename = async () => {
    if (!renaming || !renameVal.trim()) return;
    await fetch(`/api/templates/${renaming.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameVal.trim() }),
    });
    setStickerTemplates((prev) =>
      prev.map((t) => (t.id === renaming.id ? { ...t, name: renameVal.trim() } : t)),
    );
    setQrStyleTemplates((prev) =>
      prev.map((t) => (t.id === renaming.id ? { ...t, name: renameVal.trim() } : t)),
    );
    setRenaming(null);
  };

  const openNewQRTemplate = () => {
    setEditingSaved(null);
    setEditingPreset(newQRTemplatePreset());
  };

  const handleQRSaved = useCallback(
    (id: string, name: string, config: QRTemplateConfig) => {
      setQrStyleTemplates((prev) => {
        const exists = prev.find((t) => t.id === id);
        if (exists) {
          return prev.map((t) =>
            t.id === id ? { ...t, name, layout: { __type: "qr-style", config } } : t,
          );
        }
        return [...prev, { id, name, layout: { __type: "qr-style", config }, createdAt: new Date().toISOString() }];
      });
      setEditingSaved(null);
      setEditingPreset(null);
    },
    [],
  );

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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Шаблоны</h1>
              <p className="text-sm text-gray-500 mt-0.5">QR-коды и таблички для печати</p>
            </div>
            {tab === "qr" && (
              <button
                onClick={openNewQRTemplate}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
              >
                <Plus size={16} />
                Новый шаблон QR-кода
              </button>
            )}
            {tab === "table-tent" && (
              <button
                onClick={() => { setNewName(""); setShowCreate(true); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
              >
                <Plus size={16} />
                Новый шаблон таблички
              </button>
            )}
          </div>

          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6">
            <button
              onClick={() => setTab("qr")}
              className={`flex items-center gap-2 flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                tab === "qr" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <QrCode size={16} />
              Шаблоны QR-кода
            </button>
            <button
              onClick={() => setTab("table-tent")}
              className={`flex items-center gap-2 flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                tab === "table-tent" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <LayoutTemplate size={16} />
              Шаблоны таблички
            </button>
          </div>

          {tab === "qr" && (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                Создайте свой шаблон или выберите готовый стиль. В предпросмотре можно выбрать свой QR-код и
                сразу скачать PNG — стиль можно сохранить и привязать к коду.
              </p>

              <h3 className="text-sm font-semibold text-gray-700 mb-3">Мои шаблоны</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                <button
                  type="button"
                  onClick={openNewQRTemplate}
                  className="bg-white rounded-xl border-2 border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center min-h-[200px] gap-2 text-indigo-600"
                >
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Plus size={24} />
                  </div>
                  <span className="text-sm font-semibold">Новый шаблон</span>
                  <span className="text-xs text-gray-500 px-4 text-center">С нуля или на базе настроек</span>
                </button>
                {qrStyleTemplates.map((tpl) => {
                      const config = tpl.layout?.config;
                      if (!config) return null;
                      return (
                        <div
                          key={tpl.id}
                          className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md hover:border-indigo-200 transition-all"
                        >
                          <button
                            onClick={() => {
                              setEditingSaved(tpl);
                              setEditingPreset({
                                id: tpl.id,
                                name: tpl.name,
                                description: "",
                                accent: config.fg,
                                config,
                              });
                            }}
                            className="block w-full bg-gray-50 flex items-center justify-center p-4"
                          >
                            <QRThumbFromConfig config={config} />
                          </button>
                          <div className="p-3 border-t border-gray-100">
                            <p className="font-medium text-gray-900 text-sm truncate mb-2">
                              {tpl.name}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingSaved(tpl);
                                  setEditingPreset({
                                    id: tpl.id,
                                    name: tpl.name,
                                    description: "",
                                    accent: config.fg,
                                    config,
                                  });
                                }}
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
                                onClick={() => handleDelete(tpl.id, "qr-style")}
                                disabled={deleting === tpl.id}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                                title="Удалить"
                              >
                                {deleting === tpl.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
              </div>

              <h3 className="text-sm font-semibold text-gray-700 mb-3">Готовые стили</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {QR_CODE_TEMPLATES.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => { setEditingSaved(null); setEditingPreset(preset); }}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md hover:border-indigo-200 transition-all text-left"
                  >
                    <div className="p-4 flex items-center justify-center bg-gray-50">
                      <QRThumbFromPreset preset={preset} />
                    </div>
                    <div className="p-3 border-t border-gray-100">
                      <p className="font-medium text-gray-900 text-sm mb-1">{preset.name}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">{preset.description}</p>
                      <div className="mt-2 h-1.5 rounded-full" style={{ background: preset.accent, opacity: 0.5 }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "table-tent" && (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                Таблички и стикеры для печати с QR-кодом. Привяжите к динамическому QR-коду в его настройках.
              </p>

              <h3 className="text-sm font-semibold text-gray-700 mb-3">Мои шаблоны</h3>
              {stickerTemplates.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center mb-8">
                  <p className="text-gray-500 text-sm mb-3">Пока нет своих шаблонов</p>
                  <button
                    onClick={() => { setNewName(""); setShowCreate(true); }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
                  >
                    <Plus size={16} />
                    Создать свой шаблон
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                  {stickerTemplates.map((tpl) => {
                    const cfg = tpl.layout?.stickerConfig || DEFAULT_STICKER_CONFIG;
                    const fmt = FORMATS.find((f) => f.id === cfg.formatId) || FORMATS[0];
                    return (
                      <div key={tpl.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md hover:border-indigo-200 transition-all">
                        <button
                          onClick={() => router.push(`/dashboard/templates/${tpl.id}`)}
                          className="block w-full bg-gray-50 flex items-center justify-center p-3"
                          style={{ minHeight: 160 }}
                        >
                          <div className="rounded-lg overflow-hidden shadow-sm">
                            <StickerThumb cfg={cfg} />
                          </div>
                        </button>
                        <div className="p-3 border-t border-gray-100">
                          <p className="font-medium text-gray-900 text-sm truncate mb-1">{tpl.name}</p>
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{fmt.name}</span>
                            <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded capitalize">
                              {cfg.layoutId || "standard"} · {cfg.paletteId || "light"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => router.push(`/dashboard/templates/${tpl.id}`)}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                              <Pencil size={11} /> Редактировать
                            </button>
                            <button
                              onClick={() => { setRenaming(tpl); setRenameVal(tpl.name); }}
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Переименовать"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => handleDelete(tpl.id, "sticker")}
                              disabled={deleting === tpl.id}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                              title="Удалить"
                            >
                              {deleting === tpl.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <h3 className="text-sm font-semibold text-gray-700 mb-3">Готовые макеты</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {BUILTIN_STICKER_TEMPLATES.map((preset) => {
                  const cfg = { url: "https://qrstars.ru", ...preset.stickerConfig } as StickerConfig;
                  const fmt = FORMATS.find((f) => f.id === cfg.formatId) || FORMATS[0];
                  return (
                    <div
                      key={preset.id}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-indigo-200 transition-all"
                    >
                      <div className="bg-gray-50 flex items-center justify-center p-3" style={{ minHeight: 160 }}>
                        <div className="rounded-lg overflow-hidden shadow-sm">
                          <StickerThumb cfg={cfg} />
                        </div>
                      </div>
                      <div className="p-3 border-t border-gray-100">
                        <p className="font-medium text-gray-900 text-sm mb-1">{preset.shortName}</p>
                        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{preset.description}</p>
                        <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{fmt.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {editingPreset && (
        <QRTemplateEditor
          preset={editingPreset}
          existingId={editingSaved?.id}
          existingName={editingSaved?.name}
          bindQrId={bindQrId ?? undefined}
          onClose={() => { setEditingPreset(null); setEditingSaved(null); setBindQrId(null); }}
          onSaved={handleQRSaved}
          onBound={() => setBindQrId(null)}
        />
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900 text-lg">Новый шаблон таблички</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Название</label>
            <input
              autoFocus type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Например: Ресторан 5×5"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
              maxLength={60}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Отмена</button>
              <button onClick={handleCreate} disabled={creating || !newName.trim()} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {creating ? "Создание…" : "Создать и открыть"}
              </button>
            </div>
          </div>
        </div>
      )}

      {renaming && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900 text-lg">Переименовать</h3>
              <button onClick={() => setRenaming(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <input
              autoFocus type="text" value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
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
