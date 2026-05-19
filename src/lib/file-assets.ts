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

export function normalizeContentType(mimeType: string, fileName: string): string {
  if (mimeType && mimeType !== "application/octet-stream") {
    return mimeType;
  }
  const ext = getFileExtension(fileName);
  const byExt: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    zip: "application/zip",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
    txt: "text/plain",
    html: "text/html",
  };
  return byExt[ext] || mimeType || "application/octet-stream";
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
