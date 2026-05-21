"use client";

import { useState } from "react";
import { useSyncPropState } from "@/lib/sync-prop-state";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Link from "next/link";
import { Crown, EyeOff, Eye, Loader2, Plus, Trash2, Upload, X, Smartphone, Download, FileUp } from "lucide-react";
import MenuView from "@/components/scan/MenuView";

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
}

export interface MenuData {
  id?: string;
  title: string | null;
  description: string | null;
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
  isPro?: boolean;
}

export default function MenuEditor({
  initialData,
  onSave,
  saving,
  establishmentName,
  isPro = false,
}: MenuEditorProps) {
  const menuSyncKey = initialData?.id ?? "new";
  const [menu, setMenu] = useSyncPropState(
    initialData ? { ...defaultMenu, ...initialData } : defaultMenu,
    menuSyncKey
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(null);

  const updateField = (field: keyof MenuData, value: string | null) => {
    setMenu((prev) => ({ ...prev, [field]: value }));
  };

  const addItem = () => {
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
  };

  const handleImageUpload = async (index: number, file: File) => {
    if (!isPro) return;
    setUploadingImageIndex(index);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // Since this is generic upload, we might not need qrId immediately, but we can send a dummy one or adapt the API
      // Let's assume /api/upload accepts it without qrId or we just send it if we had it. The dashboard uses qrId, but it's okay without it if the route is flexible.
      fd.append("qrId", "menu-item");
      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        updateItem(index, "imageUrl", data.logoUrl || data.url || data.fileUrl); // API returns different fields depending on usage, usually logoUrl or fileUrl
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
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
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
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          result.push(current);
          current = "";
        } else {
          current += ch;
        }
      }
    }
    result.push(current);
    return result;
  };

  const headerMap: Record<string, keyof MenuItemData> = {
    "название": "name",
    "описание": "description",
    "цена": "price",
    "стоимость": "price",
    "вес": "weight",
    "развесовка": "weight",
    "раздел": "category",
    "категория": "category",
    "name": "name",
    "description": "description",
    "price": "price",
    "weight": "weight",
    "category": "category",
  };

  const importCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const lines = text.replace(/^\ufeff/, "").split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) return;

      const headerRow = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
      const colIndices: Record<string, number> = {};
      headerRow.forEach((h, i) => {
        const mapped = headerMap[h];
        if (mapped) colIndices[mapped] = i;
      });

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
      setMenu((prev) => ({
        ...prev,
        items: [...prev.items, ...importedItems],
      }));
    };
    reader.readAsText(file, "utf-8");
  };

  const handleSave = () => {
    // Basic validation
    let hasError = false;
    const newErrors: Record<string, string> = {};
    if (menu.items.some((i) => !i.name.trim())) {
      newErrors.items = "У всех блюд должно быть название";
      hasError = true;
    }
    if (hasError) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    onSave(menu);
  };

  const previewMenu: MenuData = {
    ...menu,
    title: menu.title?.trim() || "Меню",
    items: menu.items.filter((i) => !i.hidden),
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
      <div className="space-y-4 min-w-0">
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Настройки меню</h3>
        <div className="space-y-4">
          <Input
            label="Заголовок меню"
            value={menu.title || ""}
            onChange={(e) => updateField("title", e.target.value)}
            placeholder="Основное меню"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Описание
            </label>
            <textarea
              value={menu.description || ""}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Коротко о вашем меню"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold text-gray-900">Позиции меню</h3>
          <div className="flex items-center gap-2">
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
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importCSV(file);
                  e.target.value = "";
                }}
              />
            </label>
            <Button onClick={addItem} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Добавить позицию
            </Button>
          </div>
        </div>

        {errors.items && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">
            {errors.items}
          </div>
        )}

        <div className="space-y-4">
          {menu.items.map((item, index) => (
            <div key={index} className={`flex gap-4 p-4 border rounded-xl ${item.hidden ? "border-amber-200 bg-amber-50/50" : "border-gray-200 bg-gray-50"}`}>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                  className="text-gray-400 hover:text-indigo-600 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === menu.items.length - 1}
                  className="text-gray-400 hover:text-indigo-600 disabled:opacity-30"
                >
                  ↓
                </button>
              </div>

              <div className="flex-1 space-y-4">
                {item.hidden && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                    <EyeOff className="w-3.5 h-3.5" />
                    Скрыто из меню — гости не видят эту позицию
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Название блюда *"
                    value={item.name}
                    onChange={(e) => updateItem(index, "name", e.target.value)}
                    placeholder="Например: Капучино"
                  />
                  <Input
                    label="Стоимость"
                    value={item.price || ""}
                    onChange={(e) => updateItem(index, "price", e.target.value)}
                    placeholder="Например: 250 ₽"
                  />
                  <Input
                    label="Раздел"
                    value={item.category || ""}
                    onChange={(e) => updateItem(index, "category", e.target.value)}
                    placeholder="Например: Кофе"
                  />
                  <Input
                    label="Развесовка"
                    value={item.weight || ""}
                    onChange={(e) => updateItem(index, "weight", e.target.value)}
                    placeholder="Например: 200 мл или 150 г"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Описание (открывается гостю по нажатию)
                  </label>
                  <textarea
                    value={item.description || ""}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    placeholder="Состав, аллергены, подача"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                  />
                </div>
              </div>

              <div className="w-32 flex flex-col items-center gap-2 shrink-0">
                <div
                  className={`w-full aspect-square rounded-lg border-2 border-dashed flex items-center justify-center relative overflow-hidden ${
                    !isPro && !item.imageUrl
                      ? "bg-amber-50 border-amber-200"
                      : "bg-gray-100 border-gray-300"
                  }`}
                >
                  {item.imageUrl ? (
                    <>
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => updateItem(index, "imageUrl", null)}
                        className="absolute top-1 right-1 bg-white/80 p-1 rounded-full hover:bg-white text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : !isPro ? (
                    <div className="flex flex-col items-center justify-center w-full h-full px-2 text-center">
                      <Crown className="w-5 h-5 text-amber-500 mb-1" />
                      <span className="text-[10px] font-medium text-amber-900 leading-tight">
                        Фото блюда
                      </span>
                      <span className="text-[9px] text-amber-700 mt-0.5 leading-tight">
                        только на PRO
                      </span>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-gray-50 transition-colors">
                      {uploadingImageIndex === index ? (
                        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-gray-400 mb-1" />
                          <span className="text-[10px] text-gray-500 text-center px-1">Фото блюда</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(index, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
                {!isPro && !item.imageUrl && (
                  <Link
                    href="/dashboard/subscription"
                    className="text-[10px] font-medium text-indigo-600 hover:text-indigo-800 text-center leading-tight"
                  >
                    Подключить PRO →
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => updateItem(index, "hidden", !item.hidden)}
                  className={`text-sm flex items-center ${item.hidden ? "text-amber-600 hover:text-amber-700" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {item.hidden ? (
                    <>
                      <Eye className="w-3 h-3 mr-1" />
                      Показать
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3 h-3 mr-1" />
                      Скрыть
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-sm text-red-500 hover:text-red-700 flex items-center"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Удалить
                </button>
              </div>
            </div>
          ))}

          {menu.items.length === 0 && (
            <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <p className="text-sm text-gray-500 mb-2">В меню пока нет позиций</p>
              <Button onClick={addItem} variant="outline" size="sm">
                Добавить первое блюдо
              </Button>
            </div>
          )}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Сохранение...
            </>
          ) : (
            "Сохранить меню"
          )}
        </Button>
      </div>
      </div>

      <aside className="xl:sticky xl:top-8">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <Smartphone className="w-4 h-4 text-indigo-600" />
            <h3 className="font-semibold text-gray-900">Предпросмотр меню</h3>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Так меню увидит гость после сканирования QR-кода
          </p>
          <div className="mx-auto w-full max-w-[340px] rounded-[2rem] border-[10px] border-gray-900 bg-gray-900 shadow-2xl overflow-hidden">
            <div className="h-[min(640px,70vh)] overflow-y-auto overscroll-contain bg-gray-50">
              <MenuView
                menu={previewMenu}
                establishmentName={establishmentName}
                embedded
              />
            </div>
          </div>
        </Card>
      </aside>
    </div>
  );
}
