"use client";

import { useState, useRef } from "react";
import { useSyncPropState } from "@/lib/sync-prop-state";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Loader2, Upload, FileText, Trash2, RefreshCw } from "lucide-react";
import { formatFileSize, fileTypeLabel } from "@/lib/file-assets";

export interface FileAssetData {
  id?: string;
  title: string | null;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
}

interface FileAssetEditorProps {
  initialData?: FileAssetData | null;
  onSave: (data: FileAssetData) => Promise<void>;
  onDelete?: () => Promise<void>;
  saving?: boolean;
}

export default function FileAssetEditor({
  initialData,
  onSave,
  onDelete,
  saving,
}: FileAssetEditorProps) {
  const fileSyncKey = initialData?.id ?? "new";
  const [fileAsset, setFileAsset] = useSyncPropState<FileAssetData | null>(
    initialData || null,
    fileSyncKey
  );
  const [title, setTitle] = useSyncPropState(initialData?.title || "", fileSyncKey);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError("");

    try {
      const fd = new FormData();
      fd.append("file", file);
      if (title.trim()) fd.append("title", title.trim());
      if (fileAsset?.id) fd.append("replaceId", fileAsset.id);

      const res = await fetch("/api/file-assets/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка загрузки");
        return;
      }

      setFileAsset(data.fileAsset);
      if (!title.trim() && data.fileAsset.title) {
        setTitle(data.fileAsset.title);
      }
    } catch {
      setError("Ошибка соединения при загрузке");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!fileAsset?.id || !onDelete) return;
    if (!confirm("Удалить файл из хранилища? Это действие нельзя отменить.")) return;

    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/file-assets?id=${fileAsset.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Ошибка удаления");
        return;
      }
      setFileAsset(null);
      setTitle("");
      await onDelete();
    } catch {
      setError("Ошибка соединения");
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = () => {
    if (!fileAsset?.id) {
      setError("Сначала загрузите файл");
      return;
    }
    onSave({ ...fileAsset, title: title.trim() || null });
  };

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Файл для гостей
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Загрузите меню, прайс-лист, презентацию, архив или любой другой файл — гость
          скачает его одним нажатием после сканирования QR. Любой формат, до 25 МБ.
        </p>

        <Input
          label="Название для гостя"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например: Меню ресторана, Прайс-лист, Каталог услуг"
        />

        {fileAsset ? (
          <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-lg shrink-0">
                📄
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 truncate">{fileAsset.fileName}</p>
                <p className="text-sm text-gray-500">
                  {fileTypeLabel(fileAsset.mimeType, fileAsset.fileName)} ·{" "}
                  {formatFileSize(fileAsset.fileSize)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-amber-300 bg-white text-amber-800 hover:bg-amber-50 cursor-pointer transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
                {uploading ? "Загрузка..." : "Заменить файл"}
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  disabled={uploading || deleting}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                />
              </label>
              {onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || uploading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {deleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Удалить файл
                </button>
              )}
            </div>
          </div>
        ) : (
          <label className="mt-4 flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed border-amber-300 hover:border-amber-400 bg-amber-50/50 cursor-pointer transition-colors">
            <Upload className="w-8 h-8 text-amber-500" />
            <span className="text-sm font-medium text-amber-800">
              {uploading ? "Загрузка..." : "Выберите файл или перетащите сюда"}
            </span>
            <span className="text-xs text-gray-500">Любой формат — до 25 МБ</span>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
          </label>
        )}
      </Card>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || uploading || !fileAsset?.id}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Сохранение...
            </>
          ) : (
            "Сохранить настройки файла"
          )}
        </Button>
      </div>
    </div>
  );
}
