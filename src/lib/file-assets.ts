export const FILE_MAX_SIZE = 25 * 1024 * 1024;

export function getFileExtension(fileName: string, mimeType?: string): string {
  const fromName = fileName.includes(".") ? fileName.split(".").pop() : null;
  if (fromName && /^[a-zA-Z0-9]{1,16}$/.test(fromName)) {
    return fromName.toLowerCase();
  }

  if (mimeType?.includes("/")) {
    const subtype = mimeType.split("/")[1]?.replace(/[^a-z0-9]/gi, "").slice(0, 16);
    if (subtype) return subtype.toLowerCase();
  }

  return "bin";
}

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  tif: "image/tiff",
  tiff: "image/tiff",
  ico: "image/x-icon",
  svg: "image/svg+xml",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  txt: "text/plain",
  log: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  xml: "application/xml",
  html: "text/html",
  htm: "text/html",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export function normalizeContentType(mimeType: string, fileName: string): string {
  if (mimeType && mimeType !== "application/octet-stream") {
    return mimeType;
  }
  const ext = getFileExtension(fileName);
  return MIME_BY_EXTENSION[ext] || mimeType || "application/octet-stream";
}

function baseMimeType(mimeType: string): string {
  return (mimeType || "").toLowerCase().split(";")[0].trim();
}

/**
 * Типы, которые браузер исполняет как документ на нашем домене: файлы отдаются
 * с /storage/ (same-origin), поэтому inline-показ дал бы XSS с доступом к сессии.
 */
const ACTIVE_CONTENT_TYPES = new Set([
  "text/html",
  "text/xml",
  "application/xml",
  "application/xhtml+xml",
  "image/svg+xml",
]);

const INLINE_EXACT_TYPES = new Set(["application/pdf", "application/json"]);

/** Можно ли показать файл прямо в браузере вместо скачивания. */
export function isInlineViewable(mimeType: string): boolean {
  const type = baseMimeType(mimeType);
  if (!type || ACTIVE_CONTENT_TYPES.has(type)) return false;
  if (INLINE_EXACT_TYPES.has(type)) return true;
  return (
    type.startsWith("image/") ||
    type.startsWith("text/") ||
    type.startsWith("video/") ||
    type.startsWith("audio/")
  );
}

export function isImageMimeType(mimeType: string): boolean {
  const type = baseMimeType(mimeType);
  return type.startsWith("image/") && !ACTIVE_CONTENT_TYPES.has(type);
}

/** Content-Disposition для S3: картинки/текст/PDF открываются, остальное скачивается. */
export function buildContentDisposition(fileName: string, mimeType: string): string {
  const mode = isInlineViewable(mimeType) ? "inline" : "attachment";
  const fallback =
    fileName
      .replace(/[^\x20-\x7e]/g, "_")
      .replace(/["\\]/g, "_")
      .slice(0, 120) || "file";
  return `${mode}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function fileTypeLabel(mimeType: string, fileName?: string): string {
  const labels: Record<string, string> = {
    "application/pdf": "PDF",
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WebP",
    "image/gif": "GIF",
    "application/zip": "ZIP",
    "video/mp4": "MP4",
    "audio/mpeg": "MP3",
    "text/plain": "Текст",
  };
  if (labels[mimeType]) return labels[mimeType];

  const ext = fileName ? getFileExtension(fileName) : null;
  if (ext && ext !== "bin") return ext.toUpperCase();

  if (mimeType?.includes("/")) {
    const subtype = mimeType.split("/")[1];
    if (subtype && subtype !== "octet-stream") {
      return subtype.toUpperCase();
    }
  }

  return "Файл";
}
