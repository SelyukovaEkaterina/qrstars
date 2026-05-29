"use client";

import { useState } from "react";
import { useSyncPropState } from "@/lib/sync-prop-state";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Link from "next/link";
import {
  Crown,
  EyeOff,
  Eye,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
  Smartphone,
  Download,
  FileUp,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  GripVertical,
} from "lucide-react";
import MenuView from "@/components/scan/MenuView";
import IikoMenuSettings from "@/components/dashboard/IikoMenuSettings";

export interface MenuItemData {
  id?: string;
  name: string;
  description: string | null;
  price: string | null;
  weight: string | null;
  category: string | null;
  imageUrl: string | null;
  order: number;
  hidden?: boolean;
  iikoProductId?: string;
  iikoSizeId?: string | null;
}

export interface MenuData {
  id?: string;
  title: string | null;
  description: string | null;
  source?: "MANUAL" | "IIKO";
  cartEnabled?: boolean;
  askPhone?: boolean;
  askEmail?: boolean;
  askAddress?: boolean;
  iikoApiLogin?: string;
  iikoApiLoginSaved?: boolean;
  iikoOrganizationId?: string | null;
  iikoExternalMenuId?: string | null;
  iikoPriceCategoryId?: string | null;
  iikoTerminalGroupId?: string | null;
  iikoPaymentTypeId?: string | null;
  iikoOrderTypePickupId?: string | null;
  iikoOrderTypeDeliveryId?: string | null;
  /** id категорий iiko, скрытых в QR-меню */
  iikoHiddenCategoryIds?: string[];
  items: MenuItemData[];
}

const defaultMenu: MenuData = {
  title: "",
  description: "",
  items: [],
};

interface MenuEditorProps {
  initialData?: MenuData | null;
  onSave: (data: MenuData) => Promise<void>;
  saving?: boolean;
  establishmentName?: string;
  establishmentId?: string;
  isPro?: boolean;
}

export default function MenuEditor({
  initialData,
  onSave,
  saving,
  establishmentName,
  establishmentId,
  isPro = false,
}: MenuEditorProps) {
  const menuSyncKey = initialData?.id ?? "new";
  const [menu, setMenu] = useSyncPropState(
    initialData ? { ...defaultMenu, ...initialData } : defaultMenu,
    menuSyncKey
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [iikoPreviewMenu, setIikoPreviewMenu] = useState<MenuData | null>(null);

  const isIiko = menu.source === "IIKO";

  const updateField = (field: keyof MenuData, value: string | null) => {
    setMenu((prev) => ({ ...prev, [field]: value }));
  };

  const addItem = () => {
    const newIndex = menu.items.length;
    setMenu((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          name: "",
          description: "",
          price: "",
          weight: "",
          category: "",
          imageUrl: null,
          order: prev.items.length,
        },
      ],
    }));
    setExpandedItems((prev) => new Set([...prev, newIndex]));
  };

  const updateItem = (index: number, field: keyof MenuItemData, value: string | boolean | null) => {
    setMenu((prev) => {
      const nextItems = [...prev.items];
      nextItems[index] = { ...nextItems[index], [field]: value };
      return { ...prev, items: nextItems };
    });
  };

  const removeItem = (index: number) => {
    setMenu((prev) => {
      const nextItems = [...prev.items];
      nextItems.splice(index, 1);
      return { ...prev, items: nextItems };
    });
    setExpandedItems((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => { if (i < index) next.add(i); else if (i > index) next.add(i - 1); });
      return next;
    });
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    if (index + direction < 0 || index + direction >= menu.items.length) return;
    setMenu((prev) => {
      const nextItems = [...prev.items];
      const temp = nextItems[index];
      nextItems[index] = nextItems[index + direction];
      nextItems[index + direction] = temp;
      return { ...prev, items: nextItems };
    });
    setExpandedItems((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i === index) next.add(index + direction);
        else if (i === index + direction) next.add(index);
        else next.add(i);
      });
      return next;
    });
  };

  const toggleExpanded = (index: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleImageUpload = async (index: number, file: File) => {
    if (!isPro) return;
    setUploadingImageIndex(index);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("qrId", "menu-item");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        updateItem(index, "imageUrl", data.logoUrl || data.url || data.fileUrl);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUploadingImageIndex(null);
    }
  };

  const csvHeaders = ["Название", "Описание", "Цена", "Вес", "Раздел"];
  const csvKeys: (keyof MenuItemData)[] = ["name", "description", "price", "weight", "category"];

  const escapeCsvField = (value: string | null | undefined): string => {
    if (!value) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const exportCSV = () => {
    if (menu.items.length === 0) return;
    const rows = menu.items.map((item) =>
      csvKeys.map((key) => escapeCsvField(item[key] as string | null)).join(",")
    );
    const csv = [csvHeaders.join(","), ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `menu_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
          else inQuotes = false;
        } else { current += ch; }
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ",") { result.push(current); current = ""; }
        else current += ch;
      }
    }
    result.push(current);
    return result;
  };

  const headerMap: Record<string, keyof MenuItemData> = {
    "название": "name", "описание": "description", "цена": "price",
    "стоимость": "price", "вес": "weight", "развесовка": "weight",
    "раздел": "category", "категория": "category",
    "name": "name", "description": "description", "price": "price",
    "weight": "weight", "category": "category",
  };

  const importCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) return;
      const headerRow = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
      const colIndices: Record<string, number> = {};
      headerRow.forEach((h, i) => { const mapped = headerMap[h]; if (mapped) colIndices[mapped] = i; });
      if (colIndices["name"] === undefined) {
        setErrors({ items: "В CSV нет колонки «Название» (или «name»)" });
        return;
      }
      const importedItems: MenuItemData[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const name = (cols[colIndices["name"]] || "").trim();
        if (!name) continue;
        importedItems.push({
          name,
          description: cols[colIndices["description"]]?.trim() || null,
          price: cols[colIndices["price"]]?.trim() || null,
          weight: cols[colIndices["weight"]]?.trim() || null,
          category: cols[colIndices["category"]]?.trim() || null,
          imageUrl: null,
          order: menu.items.length + importedItems.length,
        });
      }
      if (importedItems.length === 0) {
        setErrors({ items: "Не найдено ни одной позиции с названием" });
        return;
      }
      setErrors({});
      setMenu((prev) => ({ ...prev, items: [...prev.items, ...importedItems] }));
    };
    reader.readAsText(file, "utf-8");
  };

  const handleSave = () => {
    const newErrors: Record<string, string> = {};
    if (!isIiko && menu.items.some((i) => !i.name.trim())) {
      newErrors.items = "У всех блюд должно быть название";
    }
    if (isIiko && isPro) {
      if (!menu.iikoApiLoginSaved && !menu.iikoApiLogin?.trim()) {
        newErrors.iiko = "Укажите API-login iiko";
      }
      if (!menu.iikoOrganizationId || !menu.iikoExternalMenuId) {
        newErrors.iiko = "Настройте подключение iiko (организация и меню)";
      }
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    onSave(menu);
  };

  const previewMenu: MenuData = {
    ...(isIiko && iikoPreviewMenu ? iikoPreviewMenu : menu),
    title: (isIiko && iikoPreviewMenu ? iikoPreviewMenu.title : menu.title)?.trim() || "Меню",
    items: (isIiko && iikoPreviewMenu ? iikoPreviewMenu.items : menu.items).filter((i) => !i.hidden),
    source: menu.source,
    cartEnabled: menu.cartEnabled,
  };

  // Group items by category for display
  const categories = Array.from(new Set(menu.items.map((i) => i.category?.trim() || ""))).filter(Boolean);
  const hasCategories = categories.length > 0;

  return (
    <div className="space-y-4">
      {/* Settings row */}
      <Card>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Настройки меню</h3>
            <Input
              label="Заголовок меню"
              value={menu.title || ""}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="Основное меню"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
              <textarea
                value={menu.description || ""}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Коротко о вашем меню"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px] resize-none"
              />
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Источник меню</h4>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMenu((prev) => ({ ...prev, source: "MANUAL" }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                    !isIiko ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-700 border-gray-300"
                  }`}
                >
                  Вручную
                </button>
                <button
                  type="button"
                  disabled={!isPro}
                  onClick={() => setMenu((prev) => ({ ...prev, source: "IIKO" }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                    isIiko ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-700 border-gray-300 disabled:opacity-50"
                  }`}
                >
                  iiko
                </button>
              </div>
            </div>

            {isIiko && (
              <IikoMenuSettings
                menu={menu}
                establishmentId={establishmentId}
                isPro={isPro}
                onChange={(patch) => setMenu((prev) => ({ ...prev, ...patch }))}
                onPreviewLoaded={setIikoPreviewMenu}
              />
            )}
            {errors.iiko && <p className="text-sm text-red-600">{errors.iiko}</p>}
          </div>

          {/* Cart mode */}
          <div className="flex flex-col justify-start">
            <h3 className="font-semibold text-gray-900 mb-4">Режим корзины</h3>
            <div className={`flex items-start gap-3 p-4 rounded-xl border ${isPro ? "border-indigo-100 bg-indigo-50/50" : "border-amber-100 bg-amber-50/50"}`}>
              <div className="mt-0.5">
                {isPro ? <ShoppingCart className="w-5 h-5 text-indigo-500" /> : <Crown className="w-5 h-5 text-amber-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Режим корзины</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {isIiko
                        ? "Гости оформляют заказ — он уходит в iiko и дублируется в ваши каналы уведомлений"
                        : "Гости добавляют позиции в корзину и оформляют заказ — вы получаете уведомление в подключённый канал"}
                    </p>
                  </div>
                  {isPro ? (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!menu.cartEnabled}
                      onClick={() => setMenu((prev) => ({ ...prev, cartEnabled: !prev.cartEnabled }))}
                      className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors ${menu.cartEnabled ? "bg-indigo-600" : "bg-gray-200"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${menu.cartEnabled ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  ) : (
                    <Link href="/dashboard/subscription" className="shrink-0 text-xs font-medium text-amber-700 hover:text-amber-900">PRO →</Link>
                  )}
                </div>
                {isPro && menu.cartEnabled && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-indigo-600">
                      Убедитесь, что в настройках заведения подключён хотя бы один канал уведомлений (email, Telegram или MAX)
                    </p>
                    <p className="text-xs font-medium text-gray-700">Дополнительные поля в форме заказа:</p>
                    <div className="flex flex-wrap gap-3">
                      {([
                        { key: "askPhone", label: "Телефон" },
                        { key: "askEmail", label: "Email" },
                        { key: "askAddress", label: "Адрес доставки" },
                      ] as const).map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!menu[key]}
                            onChange={() => setMenu((prev) => ({ ...prev, [key]: !prev[key] }))}
                            className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-gray-700">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Items section */}
      {!isIiko && (
      <Card className="!p-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">
            Позиции меню
            {menu.items.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">{menu.items.length} позиций</span>
            )}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                showPreview
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "border-gray-300 text-gray-600 bg-white hover:bg-gray-50"
              }`}
            >
              <Smartphone className="w-4 h-4" />
              Предпросмотр
            </button>
            <Button onClick={exportCSV} variant="outline" size="sm" disabled={menu.items.length === 0}>
              <Download className="w-4 h-4 mr-1" />
              Экспорт CSV
            </Button>
            <label className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
              <FileUp className="w-4 h-4" />
              Импорт CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) importCSV(file); e.target.value = ""; }}
              />
            </label>
            <Button onClick={addItem} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Добавить позицию
            </Button>
          </div>
        </div>

        {errors.items && (
          <div className="mx-5 mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{errors.items}</div>
        )}

        {/* Preview panel (inline, collapsible) */}
        {showPreview && (
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
            <div className="flex items-start gap-6 overflow-x-auto pb-2">
              <div className="shrink-0 mx-auto">
                <p className="text-xs text-gray-500 mb-3 text-center">Так меню увидит гость</p>
                <div className="w-[300px] rounded-[2rem] border-[10px] border-gray-900 bg-gray-900 shadow-xl overflow-hidden">
                  <div className="h-[520px] overflow-y-auto overscroll-contain bg-gray-50">
                    <MenuView menu={previewMenu} establishmentName={establishmentName} embedded />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Items list */}
        <div className="divide-y divide-gray-100">
          {menu.items.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Plus className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 mb-3">В меню пока нет позиций</p>
              <Button onClick={addItem} variant="outline" size="sm">Добавить первое блюдо</Button>
            </div>
          ) : (
            menu.items.map((item, index) => {
              const isExpanded = expandedItems.has(index);
              return (
                <div key={index} className={`${item.hidden ? "bg-amber-50/40" : ""}`}>
                  {/* Item row header */}
                  <div className="flex items-center gap-3 px-5 py-3">
                    {/* Drag handle / move buttons */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveItem(index, -1)}
                        disabled={index === 0}
                        className="text-gray-300 hover:text-indigo-500 disabled:opacity-0 transition-colors"
                        title="Переместить выше"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(index, 1)}
                        disabled={index === menu.items.length - 1}
                        className="text-gray-300 hover:text-indigo-500 disabled:opacity-0 transition-colors"
                        title="Переместить ниже"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Image thumbnail */}
                    <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gray-300 text-xs">фото</span>
                      )}
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
                      <div className="col-span-2 sm:col-span-2">
                        <p className={`text-sm font-medium truncate ${item.name ? "text-gray-900" : "text-gray-400 italic"}`}>
                          {item.name || "Без названия"}
                        </p>
                        {item.category && (
                          <p className="text-xs text-gray-400 truncate">{item.category}</p>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 truncate">{item.price || <span className="text-gray-300">цена</span>}</div>
                      <div className="text-sm text-gray-400 truncate text-right sm:text-left">{item.weight || ""}</div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {item.hidden && (
                        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full">
                          <EyeOff className="w-3 h-3" />
                          Скрыто
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => updateItem(index, "hidden", !item.hidden)}
                        className={`p-1.5 rounded-lg transition-colors ${item.hidden ? "text-amber-500 hover:bg-amber-100" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`}
                        title={item.hidden ? "Показать" : "Скрыть"}
                      >
                        {item.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleExpanded(index)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                        title={isExpanded ? "Свернуть" : "Редактировать"}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded edit form */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 bg-white border-t border-gray-50">
                      {item.hidden && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium mb-3">
                          <EyeOff className="w-3.5 h-3.5" />
                          Позиция скрыта — гости её не видят
                        </div>
                      )}
                      <div className="flex gap-4">
                        {/* Image upload */}
                        <div className="shrink-0 flex flex-col items-center gap-2">
                          <div
                            className={`w-28 h-28 rounded-xl border-2 border-dashed flex items-center justify-center relative overflow-hidden ${
                              !isPro && !item.imageUrl ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200 hover:border-indigo-300"
                            }`}
                          >
                            {item.imageUrl ? (
                              <>
                                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => updateItem(index, "imageUrl", null)}
                                  className="absolute top-1 right-1 bg-white/80 p-1 rounded-full hover:bg-white text-red-500 shadow"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </>
                            ) : !isPro ? (
                              <div className="flex flex-col items-center justify-center w-full h-full px-2 text-center">
                                <Crown className="w-5 h-5 text-amber-500 mb-1" />
                                <span className="text-[10px] font-medium text-amber-900 leading-tight">Фото блюда</span>
                                <span className="text-[9px] text-amber-700 mt-0.5">только на PRO</span>
                              </div>
                            ) : (
                              <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-gray-100 transition-colors">
                                {uploadingImageIndex === index ? (
                                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                                ) : (
                                  <>
                                    <Upload className="w-5 h-5 text-gray-400 mb-1" />
                                    <span className="text-[10px] text-gray-500 text-center px-1">Загрузить фото</span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  className="hidden"
                                  onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageUpload(index, file); e.target.value = ""; }}
                                />
                              </label>
                            )}
                          </div>
                          {!isPro && !item.imageUrl && (
                            <Link href="/dashboard/subscription" className="text-[10px] font-medium text-indigo-600 hover:text-indigo-800 text-center leading-tight">
                              Подключить PRO →
                            </Link>
                          )}
                        </div>

                        {/* Fields */}
                        <div className="flex-1 min-w-0 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="lg:col-span-2">
                              <Input
                                label="Название блюда *"
                                value={item.name}
                                onChange={(e) => updateItem(index, "name", e.target.value)}
                                placeholder="Например: Капучино"
                              />
                            </div>
                            <Input
                              label="Цена"
                              value={item.price || ""}
                              onChange={(e) => updateItem(index, "price", e.target.value)}
                              placeholder="250 ₽"
                            />
                            <Input
                              label="Вес / объём"
                              value={item.weight || ""}
                              onChange={(e) => updateItem(index, "weight", e.target.value)}
                              placeholder="200 мл"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Input
                              label="Раздел / категория"
                              value={item.category || ""}
                              onChange={(e) => updateItem(index, "category", e.target.value)}
                              placeholder="Например: Кофе"
                            />
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Описание <span className="text-gray-400 font-normal">(открывается по нажатию)</span>
                              </label>
                              <textarea
                                value={item.description || ""}
                                onChange={(e) => updateItem(index, "description", e.target.value)}
                                placeholder="Состав, аллергены, подача"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[72px] resize-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {menu.items.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Добавить позицию
            </button>
          </div>
        )}
      </Card>
      )}

      {isIiko && (
        <Card className="p-5">
          <p className="text-sm text-gray-600">
            Позиции и категории подгружаются из iiko автоматически. Сохраните меню после настройки.
          </p>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Сохранение...</>
          ) : (
            "Сохранить меню"
          )}
        </Button>
        {menu.items.length > 0 && !isIiko && (
          <span className="text-sm text-gray-400">{menu.items.length} позиций в меню</span>
        )}
        {isIiko && iikoPreviewMenu && (
          <span className="text-sm text-gray-400">{iikoPreviewMenu.items.length} позиций из iiko</span>
        )}
      </div>
    </div>
  );
}
