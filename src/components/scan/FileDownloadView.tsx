"use client";

import { fileTypeLabel, formatFileSize } from "@/lib/file-assets";
import { getLandingTheme, isDarkLandingTheme } from "@/lib/landing-themes";

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
  landingTheme?: string | null;
}

function MimeIcon({ mimeType, dark }: { mimeType: string; dark: boolean }) {
  const emoji =
    mimeType === "application/pdf"
      ? "📄"
      : mimeType.startsWith("image/")
        ? "🖼️"
        : "📎";
  const bg =
    mimeType === "application/pdf"
      ? dark ? "bg-red-900/40" : "bg-red-100"
      : mimeType.startsWith("image/")
        ? dark ? "bg-sky-900/40" : "bg-blue-100"
        : dark ? "bg-slate-700" : "bg-indigo-100";

  return (
    <div className={`w-16 h-16 rounded-2xl ${bg} flex items-center justify-center text-3xl shrink-0`}>
      {emoji}
    </div>
  );
}

export default function FileDownloadView({ file, establishmentName, landingTheme: themeId }: FileDownloadViewProps) {
  const theme = getLandingTheme(themeId);
  const dark = isDarkLandingTheme(themeId);
  const displayTitle = file.title || file.fileName;

  return (
    <div className={`min-h-screen ${theme.bg} flex flex-col items-center justify-center px-4 py-10`}>
      <div className="w-full max-w-md">
        {establishmentName && (
          <p className={`text-center text-sm mb-2 ${dark ? "text-slate-400" : "text-gray-500"}`}>{establishmentName}</p>
        )}

        <div className={`${theme.cardBg} rounded-2xl shadow-xl border ${theme.cardBorder} overflow-hidden`}>
          <div className={`bg-gradient-to-r ${theme.headerGradientFrom} ${theme.headerGradientTo} px-6 py-8 text-center text-white`}>
            <p className="text-white/70 text-sm font-medium uppercase tracking-wide mb-1">
              Документ
            </p>
            <h1 className="text-xl font-bold leading-tight">{displayTitle}</h1>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
              <MimeIcon mimeType={file.mimeType} dark={dark} />
              <div className="min-w-0 flex-1">
                <p className={`font-medium truncate ${dark ? "text-white" : "text-gray-900"}`}>{file.fileName}</p>
                <p className={`text-sm mt-0.5 ${dark ? "text-slate-400" : "text-gray-500"}`}>
                  {fileTypeLabel(file.mimeType, file.fileName)} · {formatFileSize(file.fileSize)}
                </p>
              </div>
            </div>

            <a
              href={file.fileUrl}
              download={file.fileName}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-center gap-2 w-full py-3.5 px-4 ${theme.downloadBtnBg} text-white font-semibold rounded-xl transition-colors shadow-md ${theme.downloadBtnShadow}`}
            >
              Скачать файл
            </a>

            <a
              href={file.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`block text-center text-sm font-medium ${dark ? "text-indigo-400 hover:text-indigo-300" : `hover:opacity-80`}`}
              style={!dark ? { color: theme.accentHex } : undefined}
            >
              Открыть в браузере
            </a>
          </div>
        </div>

        <p className={`text-center text-xs mt-6 ${dark ? "text-slate-500" : "text-gray-400"}`}>
          Сохраните файл на телефон — он останется доступен офлайн
        </p>
      </div>
    </div>
  );
}
