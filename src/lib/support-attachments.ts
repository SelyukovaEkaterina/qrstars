import { uploadObject } from "@/lib/s3";
import { getFileExtension, normalizeContentType } from "@/lib/file-assets";

/** Лимит для вложений в поддержке (Telegram Bot API до 50 МБ для документов). */
export const SUPPORT_ATTACHMENT_MAX_SIZE = 20 * 1024 * 1024;

const ALLOWED_PREFIXES = ["image/", "video/", "audio/"];
const ALLOWED_EXACT = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export function isSupportAttachmentMime(mime: string): boolean {
  if (ALLOWED_PREFIXES.some((p) => mime.startsWith(p))) return true;
  return ALLOWED_EXACT.has(mime);
}

export function isSupportImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

export type SupportAttachmentMeta = {
  url: string;
  name: string;
  mime: string;
};

export async function uploadSupportAttachment(
  ticketId: string,
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<SupportAttachmentMeta> {
  const contentType = normalizeContentType(mimeType, fileName);
  if (!isSupportAttachmentMime(contentType)) {
    throw new Error("UNSUPPORTED_TYPE");
  }
  if (buffer.length > SUPPORT_ATTACHMENT_MAX_SIZE) {
    throw new Error("TOO_LARGE");
  }

  const ext = getFileExtension(fileName, contentType);
  const safeName = fileName.replace(/[^\w.\-()а-яА-ЯёЁ ]+/g, "_").slice(0, 120) || `file.${ext}`;
  const key = `support/${ticketId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const url = await uploadObject(key, buffer, contentType);
  return { url, name: safeName, mime: contentType };
}

export function supportMessagePreview(body: string, attachmentName?: string | null): string {
  const t = body.trim();
  if (t) return t.slice(0, 200);
  if (attachmentName) return `📎 ${attachmentName}`;
  return "";
}
