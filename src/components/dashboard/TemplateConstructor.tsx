"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Type,
  Square,
  QrCode,
  Image as ImageIcon,
  Trash2,
  Download,
  Save,
  ChevronDown,
  ChevronUp,
  Copy,
  Palette,
  Layers,
  Loader2,
  Lock,
  Unlock,
} from "lucide-react";
import QRCodeLib from "qrcode";
import { TemplateLayout, TemplateElement } from "@/types/template";
import { TEMPLATE_PRESETS } from "@/lib/template-presets";

const CANVAS_WIDTH = 560;
const CANVAS_HEIGHT = 395;

interface DragState {
  id: string;
  startX: number;
  startY: number;
  elStartX: number;
  elStartY: number;
}

interface ResizeState {
  id: string;
  handle: string;
  startX: number;
  startY: number;
  elStartX: number;
  elStartY: number;
  elStartW: number;
  elStartH: number;
}

interface Props {
  initialLayout: TemplateLayout;
  templateName: string;
  onSave: (name: string, layout: TemplateLayout) => Promise<void>;
  onDownloadPDF: (layout: TemplateLayout) => Promise<void>;
  saving?: boolean;
}

function generateId() {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function TemplateConstructor({
  initialLayout,
  templateName: initialName,
  onSave,
  onDownloadPDF,
  saving,
}: Props) {
  const [layout, setLayout] = useState<TemplateLayout>(initialLayout);
  const [name, setName] = useState(initialName);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [qrSampleUrl, setQrSampleUrl] = useState("");
  const [showPresets, setShowPresets] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const canvasRef = useRef<HTMLDivElement>(null);

  const selectedElement = layout.elements.find((el) => el.id === selectedId) || null;

  useEffect(() => {
    QRCodeLib.toDataURL("https://qrstars.ru", {
      width: 512,
      margin: 1,
      color: { dark: "#1e1b4b", light: "#ffffff" },
    }).then(setQrSampleUrl);
  }, []);

  const updateElement = useCallback((id: string, updates: Partial<TemplateElement>) => {
    setLayout((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => (el.id === id ? { ...el, ...updates } : el)),
    }));
  }, []);

  const deleteElement = useCallback((id: string) => {
    setLayout((prev) => ({
      ...prev,
      elements: prev.elements.filter((el) => el.id !== id),
    }));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const duplicateElement = useCallback((id: string) => {
    setLayout((prev) => {
      const el = prev.elements.find((e) => e.id === id);
      if (!el) return prev;
      const newEl = { ...el, id: generateId(), x: el.x + 3, y: el.y + 3 };
      return { ...prev, elements: [...prev.elements, newEl] };
    });
  }, []);

  const addElement = useCallback((type: TemplateElement["type"]) => {
    const defaults: Record<string, Partial<TemplateElement>> = {
      text: { text: "Новый текст", fontSize: 4, fontWeight: "normal", color: "#1e1b4b", textAlign: "center" },
      qr: { qrColor: "#1e1b4b", qrBgColor: "#ffffff" },
      shape: { shape: "roundedRect", fill: "#6366f1", borderRadius: 12, opacity: 0.3 },
      image: { imageUrl: "" },
    };
    const newEl: TemplateElement = {
      id: generateId(),
      type,
      x: 20,
      y: 20,
      width: 30,
      height: type === "qr" ? 40 : type === "shape" ? 10 : 8,
      ...defaults[type],
    };
    setLayout((prev) => ({ ...prev, elements: [...prev.elements, newEl] }));
    setSelectedId(newEl.id);
  }, []);

  const moveElement = useCallback((id: string, direction: "up" | "down") => {
    setLayout((prev) => {
      const idx = prev.elements.findIndex((e) => e.id === id);
      if (idx === -1) return prev;
      const newElements = [...prev.elements];
      const targetIdx = direction === "up" ? idx + 1 : idx - 1;
      if (targetIdx < 0 || targetIdx >= newElements.length) return prev;
      [newElements[idx], newElements[targetIdx]] = [newElements[targetIdx], newElements[idx]];
      return { ...prev, elements: newElements };
    });
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();

      if (dragState) {
        const dx = ((e.clientX - dragState.startX) / rect.width) * 100;
        const dy = ((e.clientY - dragState.startY) / rect.height) * 100;
        setLayout((prev) => ({
          ...prev,
          elements: prev.elements.map((el) =>
            el.id === dragState.id
              ? {
                  ...el,
                  x: Math.max(0, Math.min(100 - el.width, dragState.elStartX + dx)),
                  y: Math.max(0, Math.min(100 - el.height, dragState.elStartY + dy)),
                }
              : el
          ),
        }));
      }

      if (resizeState) {
        const dx = ((e.clientX - resizeState.startX) / rect.width) * 100;
        const dy = ((e.clientY - resizeState.startY) / rect.height) * 100;
        const handle = resizeState.handle;

        setLayout((prev) => ({
          ...prev,
          elements: prev.elements.map((el) => {
            if (el.id !== resizeState.id) return el;
            let newX = resizeState.elStartX;
            let newY = resizeState.elStartY;
            let newW = resizeState.elStartW;
            let newH = resizeState.elStartH;

            if (handle.includes("e")) newW = Math.max(5, resizeState.elStartW + dx);
            if (handle.includes("w")) {
              newW = Math.max(5, resizeState.elStartW - dx);
              newX = resizeState.elStartX + (resizeState.elStartW - newW);
            }
            if (handle.includes("s")) newH = Math.max(3, resizeState.elStartH + dy);
            if (handle.includes("n")) {
              newH = Math.max(3, resizeState.elStartH - dy);
              newY = resizeState.elStartY + (resizeState.elStartH - newH);
            }

            return { ...el, x: newX, y: newY, width: newW, height: newH };
          }),
        }));
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
      setResizeState(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, resizeState]);

  const startDrag = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (locked.has(id)) return;
    const el = layout.elements.find((el) => el.id === id);
    if (!el) return;
    setSelectedId(id);
    setDragState({ id, startX: e.clientX, startY: e.clientY, elStartX: el.x, elStartY: el.y });
  };

  const startResize = (e: React.MouseEvent, id: string, handle: string) => {
    e.stopPropagation();
    const el = layout.elements.find((el) => el.id === id);
    if (!el) return;
    setResizeState({
      id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      elStartX: el.x,
      elStartY: el.y,
      elStartW: el.width,
      elStartH: el.height,
    });
  };

  const getBackgroundStyle = (): React.CSSProperties => {
    const bg = layout.background;
    if (bg.type === "gradient" && bg.gradientFrom && bg.gradientTo) {
      const angle = bg.gradientAngle || 180;
      return { background: `linear-gradient(${angle}deg, ${bg.gradientFrom}, ${bg.gradientTo})` };
    }
    return { backgroundColor: bg.color || "#ffffff" };
  };

  const renderCanvasElement = (el: TemplateElement) => {
    const isSelected = selectedId === el.id;
    const isLocked = locked.has(el.id);

    return (
      <div
        key={el.id}
        className={`absolute group ${isSelected ? "ring-2 ring-indigo-500 ring-offset-1" : "hover:ring-1 hover:ring-indigo-300"} ${isLocked ? "cursor-not-allowed" : "cursor-move"}`}
        style={{
          left: `${el.x}%`,
          top: `${el.y}%`,
          width: `${el.width}%`,
          height: el.type === "text" ? "auto" : `${el.height}%`,
          opacity: el.opacity ?? 1,
          zIndex: layout.elements.indexOf(el) + 1,
        }}
        onMouseDown={(e) => startDrag(e, el.id)}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedId(el.id);
        }}
      >
        {el.type === "text" && (
          <div
            style={{
              fontSize: `${(el.fontSize || 4) * (CANVAS_HEIGHT / 100)}px`,
              fontWeight: el.fontWeight || "normal",
              color: el.color || "#000",
              textAlign: el.textAlign || "center",
              fontFamily: "Inter, sans-serif",
              lineHeight: 1.2,
              userSelect: "none",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {el.text}
          </div>
        )}

        {el.type === "qr" && (
          <div
            className="w-full h-full flex items-center justify-center rounded-lg overflow-hidden"
            style={{ backgroundColor: el.qrBgColor || "#ffffff" }}
          >
            {qrSampleUrl && (
              <img
                src={qrSampleUrl}
                alt="QR"
                className="w-full h-full object-contain p-1"
                style={{ filter: el.qrColor ? undefined : undefined }}
              />
            )}
          </div>
        )}

        {el.type === "shape" && (
          <div
            className="w-full h-full"
            style={{
              backgroundColor: el.fill || "transparent",
              border: el.stroke ? `${el.strokeWidth || 1}px solid ${el.stroke}` : "none",
              borderRadius: el.shape === "circle" ? "50%" : el.shape === "roundedRect" ? `${el.borderRadius || 0}px` : "0",
            }}
          />
        )}

        {el.type === "image" && el.imageUrl && (
          <img src={el.imageUrl} alt="" className="w-full h-full object-cover rounded" />
        )}

        {isSelected && !isLocked && (
          <>
            <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-indigo-500 rounded-sm cursor-nw-resize" onMouseDown={(e) => startResize(e, el.id, "nw")} />
            <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-indigo-500 rounded-sm cursor-ne-resize" onMouseDown={(e) => startResize(e, el.id, "ne")} />
            <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-indigo-500 rounded-sm cursor-sw-resize" onMouseDown={(e) => startResize(e, el.id, "sw")} />
            <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-indigo-500 rounded-sm cursor-se-resize" onMouseDown={(e) => startResize(e, el.id, "se")} />
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-indigo-500 rounded-sm cursor-n-resize" onMouseDown={(e) => startResize(e, el.id, "n")} />
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-indigo-500 rounded-sm cursor-s-resize" onMouseDown={(e) => startResize(e, el.id, "s")} />
            <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-indigo-500 rounded-sm cursor-w-resize" onMouseDown={(e) => startResize(e, el.id, "w")} />
            <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-indigo-500 rounded-sm cursor-e-resize" onMouseDown={(e) => startResize(e, el.id, "e")} />
          </>
        )}
      </div>
    );
  };

  const renderProperties = () => {
    if (!selectedElement) {
      return (
        <div className="p-4 space-y-4">
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <Palette className="w-4 h-4 text-indigo-500" />
            Фон таблички
          </h3>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Тип фона</label>
            <select
              value={layout.background.type}
              onChange={(e) =>
                setLayout((prev) => ({
                  ...prev,
                  background: {
                    ...prev.background,
                    type: e.target.value as "solid" | "gradient",
                    color: prev.background.color || "#ffffff",
                    gradientFrom: prev.background.gradientFrom || "#1e1b4b",
                    gradientTo: prev.background.gradientTo || "#312e81",
                  },
                }))
              }
              className="w-full px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="solid">Сплошной цвет</option>
              <option value="gradient">Градиент</option>
            </select>
          </div>

          {layout.background.type === "solid" && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Цвет</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={layout.background.color || "#ffffff"}
                  onChange={(e) =>
                    setLayout((prev) => ({ ...prev, background: { ...prev.background, color: e.target.value } }))
                  }
                  className="w-8 h-8 rounded cursor-pointer border"
                />
                <input
                  type="text"
                  value={layout.background.color || "#ffffff"}
                  onChange={(e) =>
                    setLayout((prev) => ({ ...prev, background: { ...prev.background, color: e.target.value } }))
                  }
                  className="flex-1 px-2 py-1.5 border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {layout.background.type === "gradient" && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Цвет 1</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={layout.background.gradientFrom || "#1e1b4b"}
                    onChange={(e) =>
                      setLayout((prev) => ({ ...prev, background: { ...prev.background, gradientFrom: e.target.value } }))
                    }
                    className="w-8 h-8 rounded cursor-pointer border"
                  />
                  <input
                    type="text"
                    value={layout.background.gradientFrom || "#1e1b4b"}
                    onChange={(e) =>
                      setLayout((prev) => ({ ...prev, background: { ...prev.background, gradientFrom: e.target.value } }))
                    }
                    className="flex-1 px-2 py-1.5 border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Цвет 2</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={layout.background.gradientTo || "#312e81"}
                    onChange={(e) =>
                      setLayout((prev) => ({ ...prev, background: { ...prev.background, gradientTo: e.target.value } }))
                    }
                    className="w-8 h-8 rounded cursor-pointer border"
                  />
                  <input
                    type="text"
                    value={layout.background.gradientTo || "#312e81"}
                    onChange={(e) =>
                      setLayout((prev) => ({ ...prev, background: { ...prev.background, gradientTo: e.target.value } }))
                    }
                    className="flex-1 px-2 py-1.5 border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Угол: {layout.background.gradientAngle || 180}°
                </label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={layout.background.gradientAngle || 180}
                  onChange={(e) =>
                    setLayout((prev) => ({
                      ...prev,
                      background: { ...prev.background, gradientAngle: Number(e.target.value) },
                    }))
                  }
                  className="w-full accent-indigo-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Размер (мм)</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={layout.width}
                onChange={(e) => setLayout((prev) => ({ ...prev, width: Number(e.target.value) }))}
                className="px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ширина"
              />
              <input
                type="number"
                value={layout.height}
                onChange={(e) => setLayout((prev) => ({ ...prev, height: Number(e.target.value) }))}
                className="px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Высота"
              />
            </div>
          </div>
        </div>
      );
    }

    const el = selectedElement;
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-sm">
            {el.type === "text" ? "Текст" : el.type === "qr" ? "QR-код" : el.type === "shape" ? "Фигура" : "Изображение"}
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const newLocked = new Set(locked);
                if (newLocked.has(el.id)) newLocked.delete(el.id);
                else newLocked.add(el.id);
                setLocked(newLocked);
              }}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
              title={locked.has(el.id) ? "Разблокировать" : "Заблокировать"}
            >
              {locked.has(el.id) ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => duplicateElement(el.id)}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
              title="Дублировать"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => deleteElement(el.id)}
              className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
              title="Удалить"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Позиция и размер</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-gray-400">X</span>
              <input
                type="number"
                value={Math.round(el.x * 10) / 10}
                onChange={(e) => updateElement(el.id, { x: Number(e.target.value) })}
                className="w-full px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                step="0.5"
              />
            </div>
            <div>
              <span className="text-[10px] text-gray-400">Y</span>
              <input
                type="number"
                value={Math.round(el.y * 10) / 10}
                onChange={(e) => updateElement(el.id, { y: Number(e.target.value) })}
                className="w-full px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                step="0.5"
              />
            </div>
            <div>
              <span className="text-[10px] text-gray-400">W</span>
              <input
                type="number"
                value={Math.round(el.width * 10) / 10}
                onChange={(e) => updateElement(el.id, { width: Number(e.target.value) })}
                className="w-full px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                step="0.5"
              />
            </div>
            <div>
              <span className="text-[10px] text-gray-400">H</span>
              <input
                type="number"
                value={Math.round(el.height * 10) / 10}
                onChange={(e) => updateElement(el.id, { height: Number(e.target.value) })}
                className="w-full px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                step="0.5"
              />
            </div>
          </div>
        </div>

        {el.type === "text" && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Текст</label>
              <textarea
                value={el.text || ""}
                onChange={(e) => updateElement(el.id, { text: e.target.value })}
                className="w-full px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Размер: {el.fontSize || 4}
              </label>
              <input
                type="range"
                min="1"
                max="15"
                step="0.5"
                value={el.fontSize || 4}
                onChange={(e) => updateElement(el.id, { fontSize: Number(e.target.value) })}
                className="w-full accent-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Начертание</label>
              <select
                value={el.fontWeight || "normal"}
                onChange={(e) => updateElement(el.id, { fontWeight: e.target.value })}
                className="w-full px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="lighter">Тонкий</option>
                <option value="normal">Обычный</option>
                <option value="bold">Жирный</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Выравнивание</label>
              <div className="flex gap-1">
                {(["left", "center", "right"] as const).map((align) => (
                  <button
                    key={align}
                    onClick={() => updateElement(el.id, { textAlign: align })}
                    className={`flex-1 py-1 text-xs rounded border transition-colors ${
                      el.textAlign === align ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "hover:bg-gray-50"
                    }`}
                  >
                    {align === "left" ? "Лево" : align === "center" ? "Центр" : "Право"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Цвет</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={el.color || "#000000"}
                  onChange={(e) => updateElement(el.id, { color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border"
                />
                <input
                  type="text"
                  value={el.color || "#000000"}
                  onChange={(e) => updateElement(el.id, { color: e.target.value })}
                  className="flex-1 px-2 py-1.5 border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </>
        )}

        {el.type === "qr" && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Цвет QR</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={el.qrColor || "#1e1b4b"}
                  onChange={(e) => updateElement(el.id, { qrColor: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border"
                />
                <input
                  type="text"
                  value={el.qrColor || "#1e1b4b"}
                  onChange={(e) => updateElement(el.id, { qrColor: e.target.value })}
                  className="flex-1 px-2 py-1.5 border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Фон QR</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={el.qrBgColor || "#ffffff"}
                  onChange={(e) => updateElement(el.id, { qrBgColor: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border"
                />
                <input
                  type="text"
                  value={el.qrBgColor || "#ffffff"}
                  onChange={(e) => updateElement(el.id, { qrBgColor: e.target.value })}
                  className="flex-1 px-2 py-1.5 border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </>
        )}

        {el.type === "shape" && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Форма</label>
              <select
                value={el.shape || "rect"}
                onChange={(e) => updateElement(el.id, { shape: e.target.value as TemplateElement["shape"] })}
                className="w-full px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="rect">Прямоугольник</option>
                <option value="roundedRect">Скруглённый</option>
                <option value="circle">Круг/Овал</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Заливка</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={el.fill || "#6366f1"}
                  onChange={(e) => updateElement(el.id, { fill: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border"
                />
                <input
                  type="text"
                  value={el.fill || "#6366f1"}
                  onChange={(e) => updateElement(el.id, { fill: e.target.value })}
                  className="flex-1 px-2 py-1.5 border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            {(el.shape === "roundedRect" || el.shape === "rect") && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Скругление: {el.borderRadius || 0}px
                </label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={el.borderRadius || 0}
                  onChange={(e) => updateElement(el.id, { borderRadius: Number(e.target.value) })}
                  className="w-full accent-indigo-500"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Прозрачность: {Math.round((el.opacity ?? 1) * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round((el.opacity ?? 1) * 100)}
                onChange={(e) => updateElement(el.id, { opacity: Number(e.target.value) / 100 })}
                className="w-full accent-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Обводка</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={el.stroke || "#000000"}
                  onChange={(e) => updateElement(el.id, { stroke: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border"
                />
                <input
                  type="text"
                  value={el.stroke || ""}
                  onChange={(e) => updateElement(el.id, { stroke: e.target.value || undefined })}
                  placeholder="нет"
                  className="flex-1 px-2 py-1.5 border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </>
        )}

        {el.type === "image" && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">URL изображения</label>
            <input
              type="text"
              value={el.imageUrl || ""}
              onChange={(e) => updateElement(el.id, { imageUrl: e.target.value })}
              placeholder="https://..."
              className="w-full px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        <div className="pt-2 border-t">
          <label className="block text-xs font-medium text-gray-500 mb-1">Слой</label>
          <div className="flex gap-1">
            <button
              onClick={() => moveElement(el.id, "up")}
              className="flex-1 py-1 text-xs rounded border hover:bg-gray-50 flex items-center justify-center gap-1"
            >
              <ChevronUp className="w-3 h-3" /> Выше
            </button>
            <button
              onClick={() => moveElement(el.id, "down")}
              className="flex-1 py-1 text-xs rounded border hover:bg-gray-50 flex items-center justify-center gap-1"
            >
              <ChevronDown className="w-3 h-3" /> Ниже
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-4 shrink-0">
        <div className="flex-1">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-lg font-bold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 w-full"
            placeholder="Название шаблона"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDownloadPDF(layout)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Скачать PDF
          </button>
          <button
            onClick={() => onSave(name, layout)}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left toolbar */}
        <div className="w-56 bg-white border-r overflow-y-auto shrink-0">
          <div className="p-3">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Элементы</h4>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => addElement("text")}
                className="flex flex-col items-center gap-1 p-2.5 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
              >
                <Type className="w-5 h-5 text-indigo-500" />
                <span className="text-[10px] text-gray-600">Текст</span>
              </button>
              <button
                onClick={() => addElement("shape")}
                className="flex flex-col items-center gap-1 p-2.5 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
              >
                <Square className="w-5 h-5 text-violet-500" />
                <span className="text-[10px] text-gray-600">Фигура</span>
              </button>
              <button
                onClick={() => addElement("qr")}
                className="flex flex-col items-center gap-1 p-2.5 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
              >
                <QrCode className="w-5 h-5 text-emerald-500" />
                <span className="text-[10px] text-gray-600">QR-код</span>
              </button>
              <button
                onClick={() => addElement("image")}
                className="flex flex-col items-center gap-1 p-2.5 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
              >
                <ImageIcon className="w-5 h-5 text-amber-500" />
                <span className="text-[10px] text-gray-600">Фото</span>
              </button>
            </div>
          </div>

          <div className="border-t">
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="w-full p-3 flex items-center justify-between text-xs font-semibold text-gray-400 uppercase tracking-wider hover:bg-gray-50"
            >
              <span>Готовые шаблоны</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showPresets ? "rotate-180" : ""}`} />
            </button>
            {showPresets && (
              <div className="px-3 pb-3 space-y-2">
                {TEMPLATE_PRESETS.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      const newLayout: TemplateLayout = {
                        ...preset.layout,
                        elements: preset.layout.elements.map((el) => ({ ...el, id: generateId() })),
                      };
                      setLayout(newLayout);
                      setSelectedId(null);
                    }}
                    className="w-full text-left rounded-lg border border-gray-200 hover:border-indigo-300 overflow-hidden transition-colors"
                  >
                    <div
                      className="h-14 flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ background: preset.thumbnail.bg }}
                    >
                      QR
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-gray-900">{preset.name}</p>
                      <p className="text-[10px] text-gray-500 leading-tight">{preset.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t">
            <button
              onClick={() => setShowLayers(!showLayers)}
              className="w-full p-3 flex items-center justify-between text-xs font-semibold text-gray-400 uppercase tracking-wider hover:bg-gray-50"
            >
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3" /> Слои ({layout.elements.length})
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showLayers ? "rotate-180" : ""}`} />
            </button>
            {showLayers && (
              <div className="px-3 pb-3 space-y-0.5 max-h-48 overflow-y-auto">
                {layout.elements.map((el, idx) => (
                  <div
                    key={el.id}
                    onClick={() => setSelectedId(el.id)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                      selectedId === el.id ? "bg-indigo-50 text-indigo-700" : "hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    <span className="text-[10px] text-gray-400 w-4">{idx + 1}</span>
                    {el.type === "text" && <Type className="w-3 h-3 shrink-0" />}
                    {el.type === "qr" && <QrCode className="w-3 h-3 shrink-0" />}
                    {el.type === "shape" && <Square className="w-3 h-3 shrink-0" />}
                    {el.type === "image" && <ImageIcon className="w-3 h-3 shrink-0" />}
                    <span className="truncate">
                      {el.type === "text"
                        ? el.text?.slice(0, 20) || "Текст"
                        : el.type === "qr"
                          ? "QR-код"
                          : el.type === "shape"
                            ? "Фигура"
                            : "Фото"}
                    </span>
                    {locked.has(el.id) && <Lock className="w-3 h-3 text-gray-400 shrink-0" />}
                  </div>
                ))}
                {layout.elements.length === 0 && (
                  <p className="text-[10px] text-gray-400 text-center py-2">Нет элементов</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-gray-100 flex items-center justify-center p-6 overflow-auto">
          <div className="relative">
            <div
              ref={canvasRef}
              className="relative overflow-hidden shadow-2xl"
              style={{
                width: CANVAS_WIDTH,
                height: CANVAS_HEIGHT,
                ...getBackgroundStyle(),
                borderRadius: 4,
              }}
              onClick={() => setSelectedId(null)}
            >
              {layout.elements.map((el) => renderCanvasElement(el))}
            </div>
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-gray-400">
              {layout.width} × {layout.height} мм
            </div>
          </div>
        </div>

        {/* Right properties panel */}
        <div className="w-64 bg-white border-l overflow-y-auto shrink-0">
          {renderProperties()}
        </div>
      </div>
    </div>
  );
}
