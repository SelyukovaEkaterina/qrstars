"use client";

import { useState } from "react";
import { useSyncPropState } from "@/lib/sync-prop-state";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Loader2, Plus, Trash2, Upload, X } from "lucide-react";

export interface MenuItemData {
  id?: string;
  name: string;
  description: string | null;
  price: string | null;
  weight: string | null;
  category: string | null;
  imageUrl: string | null;
  order: number;
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
}

export default function MenuEditor({ initialData, onSave, saving }: MenuEditorProps) {
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

  const updateItem = (index: number, field: keyof MenuItemData, value: string | null) => {
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

  return (
    <div className="space-y-4">
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Позиции меню</h3>
          <Button onClick={addItem} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Добавить позицию
          </Button>
        </div>

        {errors.items && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">
            {errors.items}
          </div>
        )}

        <div className="space-y-4">
          {menu.items.map((item, index) => (
            <div key={index} className="flex gap-4 p-4 border border-gray-200 rounded-xl bg-gray-50">
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

              <div className="w-32 flex flex-col items-center gap-2">
                <div className="w-full aspect-square bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center relative overflow-hidden">
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
                        }}
                      />
                    </label>
                  )}
                </div>
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
  );
}
