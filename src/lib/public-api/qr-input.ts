import { findRedirectUrlProblem, toHeaderSafeUrl } from "@/lib/redirect-url";

/**
 * Режимы, которые можно выставить через API. FILE, FORM, TIPS и CUSTOM_SECTION
 * требуют привязки к объектам из кабинета — их настраивают там, API только читает.
 */
export const API_WRITABLE_QR_MODES = [
  "REVIEW",
  "REDIRECT",
  "MENU",
  "BUSINESS_CARD",
  "WIFI",
  "LANDING",
] as const;
export type ApiWritableQrMode = (typeof API_WRITABLE_QR_MODES)[number];

export interface QrInput {
  label?: string | null;
  mode?: ApiWritableQrMode;
  redirectUrl?: string | null;
}

export function parseQrInput(
  body: Record<string, unknown>
): { ok: true; data: QrInput } | { ok: false; message: string } {
  const data: QrInput = {};

  if (body.label !== undefined) {
    if (body.label !== null && typeof body.label !== "string") {
      return { ok: false, message: "label — строка" };
    }
    const label = typeof body.label === "string" ? body.label.trim() : "";
    if (label.length > 120) return { ok: false, message: "label — до 120 символов" };
    data.label = label || null;
  }

  if (body.mode !== undefined) {
    if (!API_WRITABLE_QR_MODES.includes(body.mode as ApiWritableQrMode)) {
      return {
        ok: false,
        message: `mode: ${API_WRITABLE_QR_MODES.join(", ")}. Остальные режимы настраиваются в кабинете`,
      };
    }
    data.mode = body.mode as ApiWritableQrMode;
  }

  if (body.redirectUrl !== undefined) {
    if (body.redirectUrl === null || body.redirectUrl === "") data.redirectUrl = null;
    else if (typeof body.redirectUrl !== "string") {
      return { ok: false, message: "redirectUrl — строка" };
    } else {
      const problem = findRedirectUrlProblem(body.redirectUrl);
      if (problem) return { ok: false, message: problem };
      const safe = toHeaderSafeUrl(body.redirectUrl);
      if (!safe || safe.startsWith("/")) return { ok: false, message: "redirectUrl — некорректная ссылка" };
      data.redirectUrl = safe;
    }
  }

  return { ok: true, data };
}
