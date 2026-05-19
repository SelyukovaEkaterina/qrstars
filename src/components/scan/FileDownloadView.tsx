"use client";

import { fileTypeLabel, formatFileSize } from "@/lib/file-assets";

interface FileAssetData {
  id: string;
  title: string | null;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
}

interface FileDownloadViewProps {
  file: FileAssetData;
  establishmentName?: string;
}

function MimeIcon({ mimeType }: { mimeType: string }) {
  const emoji =
    mimeType === "application/pdf"
      ? "📄"
      : mimeType.startsWith("image/")
        ? "🖼️"
        : "📎";
  const bg =
    mimeType === "application/pdf"
      ? "bg-red-100"
      : mimeType.startsWith("image/")
        ? "bg-blue-100"
        : "bg-indigo-100";

  return (
    <div className={`w-16 h-16 rounded-2xl ${bg} flex items-center justify-center text-3xl shrink-0`}>
      {emoji}
    </div>
  );
}

export default function FileDownloadView({ file, establishmentName }: FileDownloadViewProps) {
  const displayTitle = file.title || file.fileName;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-orange-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {establishmentName && (
          <p className="text-center text-sm text-gray-500 mb-2">{establishmentName}</p>
        )}

        <div className="bg-white rounded-2xl shadow-xl border border-amber-100 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-8 text-center text-white">
            <p className="text-amber-100 text-sm font-medium uppercase tracking-wide mb-1">
              Документ
            </p>
            <h1 className="text-xl font-bold leading-tight">{displayTitle}</h1>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
              <MimeIcon mimeType={file.mimeType} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 truncate">{file.fileName}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {fileTypeLabel(file.mimeType, file.fileName)} · {formatFileSize(file.fileSize)}
                </p>
              </div>
            </div>

            <a
              href={file.fileUrl}
              download={file.fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors shadow-md shadow-amber-200"
            >
              Скачать файл
            </a>

            <a
              href={file.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-sm text-amber-700 hover:text-amber-900 font-medium"
            >
              Открыть в браузере
            </a>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Сохраните файл на телефон — он останется доступен офлайн
        </p>
      </div>
    </div>
  );
}
