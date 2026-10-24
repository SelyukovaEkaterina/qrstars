"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { TEMPLATES_CHANGED_EVENT } from "@/components/dashboard/GeneratorStyleImporter";
import {
  QR_CODE_TEMPLATES,
  DEFAULT_QR_CONFIG,
  renderQRTemplate,
  canvasDisplaySize,
  normalizeQRTemplateConfig,
  type QRTemplateConfig,
  type QRTemplatePreset,
} from "@/lib/qr-code-templates";
import QRTemplateEditor from "@/components/dashboard/QRTemplateEditor";
import { ART_PRESET_CATEGORIES, type ArtPresetCategory } from "@/lib/qr-engine";
import { Loader2, Plus, Pencil, Trash2, X } from "lucide-react";

/** Шаблоны табличек (table-tent) убраны из кабинета: старые ссылки редиректят на стили QR. */
export type TemplatesMode = "qr";

interface TemplateRow {
  id: string;
  name: string;
  layout: { __type?: string; config?: QRTemplateConfig };
  createdAt: string;
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

const PAGE_META = {
  title: "Шаблоны оформления",
  subtitle: "Стили QR-кодов аккаунта: скачивание и привязка к любым кодам проектов",
  createLabel: "Новый шаблон",
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function TemplatesPageContent({ mode }: { mode: TemplatesMode }) {
  const meta = PAGE_META;

  const [qrStyleTemplates, setQrStyleTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [artCategory, setArtCategory] = useState<ArtPresetCategory | "all">("all");
  const [deleting, setDeleting] = useState<string | null>(null);

  const [renaming, setRenaming] = useState<TemplateRow | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const [editingPreset, setEditingPreset] = useState<QRTemplatePreset | null>(null);
  const [editingSaved, setEditingSaved] = useState<TemplateRow | null>(null);
  const [bindQrId, setBindQrId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bindQr = params.get("bindQr");
    if (!bindQr) return;

    setBindQrId(bindQr);
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
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/templates");
      const d = await r.json();
      const all: TemplateRow[] = d.templates || [];
      setQrStyleTemplates(
        all.filter(
          (t) => t.layout?.__type === "qr-style" && !t.id.startsWith("qr-preset-"),
        ),
      );
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  // Авторизацию проверяет dashboard/layout.tsx.
  useEffect(() => {
    load();
    // Стиль из генератора на лендинге сохраняется в фоне — показываем его без перезагрузки.
    window.addEventListener(TEMPLATES_CHANGED_EVENT, load);
    return () => window.removeEventListener(TEMPLATES_CHANGED_EVENT, load);
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить шаблон?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (res.ok) setQrStyleTemplates((prev) => prev.filter((t) => t.id !== id));
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
        return [
          ...prev,
          {
            id,
            name,
            layout: { __type: "qr-style", config },
            createdAt: new Date().toISOString(),
          },
        ];
      });
      setEditingSaved(null);
      setEditingPreset(null);
    },
    [],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <main className="flex min-w-0 flex-1 items-center justify-center">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
        </main>
      </div>
    );
  }


  const renderPresetCard = (preset: QRTemplatePreset) => (
    <button
      key={preset.id}
      onClick={() => {
        setEditingSaved(null);
        setEditingPreset(preset);
      }}
      className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md hover:border-indigo-200 transition-all text-left"
    >
      <div className="p-4 flex items-center justify-center bg-gray-50">
        <QRThumbFromPreset preset={preset} />
      </div>
      <div className="p-3 border-t border-gray-100">
        <p className="font-medium text-gray-900 text-sm mb-1">{preset.name}</p>
        <p className="text-xs text-gray-500 line-clamp-2">{preset.description}</p>
        <div
          className="mt-2 h-1.5 rounded-full"
          style={{ background: preset.accent, opacity: 0.5 }}
        />
      </div>
    </button>
  );
  return (
    <div className="flex min-h-screen bg-gray-50">
      <main className="min-w-0 flex-1 p-4 sm:p-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">{meta.title}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{meta.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={openNewQRTemplate}
              className="flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 sm:self-auto"
            >
              <Plus size={16} />
              {meta.createLabel}
            </button>
          </div>

          <div>
              <p className="text-sm text-gray-500 mb-4">
                Создайте свой шаблон или выберите готовый стиль. В предпросмотре можно выбрать свой
                QR-код и сразу скачать PNG — стиль можно сохранить и привязать к коду.
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
                        <p className="font-medium text-gray-900 text-sm truncate mb-2">{tpl.name}</p>
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
                            className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Pencil size={11} />
                            Редактировать
                          </button>
                          <button
                            onClick={() => {
                              setRenaming(tpl);
                              setRenameVal(tpl.name);
                            }}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Переименовать"
                            aria-label="Переименовать"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(tpl.id)}
                            disabled={deleting === tpl.id}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                            title="Удалить"
                            aria-label="Удалить"
                          >
                            {deleting === tpl.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Trash2 size={12} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <h3 className="text-sm font-semibold text-gray-700 mb-3">Готовые стили</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {QR_CODE_TEMPLATES.filter((p) => !p.art).map(renderPresetCard)}
              </div>

              <h3 className="text-sm font-semibold text-gray-700 mt-8 mb-3">Арт-стили</h3>
              <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                {[{ id: "all" as const, label: "Все" }, ...ART_PRESET_CATEGORIES].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setArtCategory(c.id)}
                    aria-pressed={artCategory === c.id}
                    className={`h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium ${artCategory === c.id ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {QR_CODE_TEMPLATES.filter((p) => p.art && (artCategory === "all" || p.art.category === artCategory)).map(renderPresetCard)}
              </div>
            </div>
        </div>
      </main>

      {editingPreset && (
        <QRTemplateEditor
          preset={editingPreset}
          existingId={editingSaved?.id}
          existingName={editingSaved?.name}
          bindQrId={bindQrId ?? undefined}
          onClose={() => {
            setEditingPreset(null);
            setEditingSaved(null);
            setBindQrId(null);
          }}
          onSaved={handleQRSaved}
          onBound={() => setBindQrId(null)}
        />
      )}

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
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
              maxLength={60}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRenaming(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handleRename}
                disabled={!renameVal.trim()}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
