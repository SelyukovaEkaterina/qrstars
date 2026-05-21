"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import RichTextEditor from "@/components/dashboard/RichTextEditor";
import EmojiPicker from "@/components/ui/EmojiPicker";
import { Loader2, Trash2, ExternalLink, FileText } from "lucide-react";

export interface CustomPageData {
  id: string;
  menuItemLabel: string;
  title: string;
  content: string;
  type: string;
  url?: string | null;
  icon?: string | null;
  enabled: boolean;
}

interface CustomPageEditorProps {
  initialData: CustomPageData | null;
  onSave: (data: {
    id?: string;
    menuItemLabel: string;
    title: string;
    content: string;
    type: string;
    url?: string | null;
    icon?: string | null;
  }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  saving: boolean;
}

export default function CustomPageEditor({
  initialData,
  onSave,
  onDelete,
  saving,
}: CustomPageEditorProps) {
  const [menuItemLabel, setMenuItemLabel] = useState(initialData?.menuItemLabel ?? "");
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [content, setContent] = useState(initialData?.content ?? "");
  const [pageType, setPageType] = useState(initialData?.type ?? "HTML");
  const [url, setUrl] = useState(initialData?.url ?? "");
  const [icon, setIcon] = useState<string | null>(initialData?.icon ?? null);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    if (!menuItemLabel.trim()) return;
    if (pageType === "HTML" && !title.trim()) return;
    if (pageType === "LINK" && !url.trim()) return;
    await onSave({
      id: initialData?.id,
      menuItemLabel: menuItemLabel.trim(),
      title: pageType === "HTML" ? title.trim() : menuItemLabel.trim(),
      content: pageType === "HTML" ? content : "",
      type: pageType,
      url: pageType === "LINK" ? url.trim() : null,
      icon,
    });
  };

  const handleDelete = async () => {
    if (!initialData?.id || !onDelete) return;
    if (!window.confirm("Удалить эту страницу?")) return;
    setDeleting(true);
    try {
      await onDelete(initialData.id);
    } finally {
      setDeleting(false);
    }
  };

  const canSave = pageType === "HTML"
    ? menuItemLabel.trim() && title.trim()
    : menuItemLabel.trim() && url.trim();

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Тип страницы
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPageType("HTML")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
              pageType === "HTML"
                ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <FileText className="w-4 h-4" />
            Текстовая страница
          </button>
          <button
            type="button"
            onClick={() => setPageType("LINK")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
              pageType === "LINK"
                ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            Переход по URL
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Название пункта меню
        </label>
        <input
          type="text"
          value={menuItemLabel}
          onChange={(e) => setMenuItemLabel(e.target.value)}
          placeholder={pageType === "LINK" ? "Например: Наш сайт, Забронировать, Instagram" : "Например: О нас, Акции, Контакты"}
          maxLength={100}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <p className="text-xs text-gray-400 mt-1">
          Текст кнопки на микро-лендинге
        </p>
      </div>

      <EmojiPicker value={icon} onChange={setIcon} />

      {pageType === "HTML" && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Заголовок страницы
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Заголовок, который увидит гость"
              maxLength={200}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Содержимое
            </label>
            <RichTextEditor
              key={initialData?.id || "new"}
              content={content}
              onChange={setContent}
              placeholder="Введите текст страницы..."
            />
          </div>
        </>
      )}

      {pageType === "LINK" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            URL для перехода
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Гость перейдёт по этой ссылке при нажатии на кнопку
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button
          onClick={handleSave}
          disabled={saving || !canSave}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              Сохранение...
            </>
          ) : initialData ? (
            "Сохранить"
          ) : (
            "Создать страницу"
          )}
        </Button>

        {initialData && onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-1" />
                Удалить
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
