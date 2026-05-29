import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function generatePassword(length = 12): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}

/** Base URL for links embedded in QR images (scan, etc.). */
export function getAppBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  const env = process.env.NEXT_PUBLIC_BASE_URL;
  if (env && !env.includes("localhost")) {
    return env;
  }
  return "https://app.qrstars.ru";
}

const BEGET_S3_BUCKET = "1919a3d97e3e-qrstarsru";

/** Extract object key from a public S3/CDN URL (e.g. `logos/user/abc.png`). */
export function storageKeyFromMediaUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/storage/")) {
      return parsed.pathname.slice("/storage/".length);
    }
    if (parsed.hostname === "s3.qrstars.ru") {
      return parsed.pathname.replace(/^\//, "");
    }
    if (parsed.hostname.includes("storage.beget.cloud")) {
      const prefix = `/${BEGET_S3_BUCKET}/`;
      if (parsed.pathname.startsWith(prefix)) {
        return parsed.pathname.slice(prefix.length);
      }
      return parsed.pathname.replace(/^\//, "");
    }
    const bucket = process.env.S3_BUCKET || "qrwin-logos";
    const pathPrefix = `/${bucket}/`;
    if (parsed.pathname.startsWith(pathPrefix)) {
      return parsed.pathname.slice(pathPrefix.length);
    }
  } catch {
    // ignore invalid URLs
  }
  return null;
}

/**
 * Same-origin URL for canvas/image loading (avoids CORS taint on s3.qrstars.ru).
 * Production nginx proxies `/storage/*` → S3; dev uses next.config rewrites.
 */
export function toSameOriginStorageUrl(url: string): string {
  const key = storageKeyFromMediaUrl(url);
  if (!key) return url;
  return `${getAppBaseUrl()}/storage/${key}`;
}

export function scanUrlForCode(code: string): string {
  return `${getAppBaseUrl()}/q/${code}`;
}

export function generateQRCode(): string {
  const chars = "abcdefghijkmnopqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function generateSerialCode(): string {
  const chars = "abcdefghijkmnopqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function generateMasterCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `MC-${code.slice(0, 4)}-${code.slice(4)}`;
}

export function getPlatformUrl(
  establishment: {
    yandexMapsUrl: string | null;
    twoGisUrl: string | null;
    avitoUrl: string | null;
    platformRotation: boolean;
  },
  rotationIndex?: number
): string {
  const urls: string[] = [];
  if (establishment.yandexMapsUrl) urls.push(establishment.yandexMapsUrl);
  if (establishment.twoGisUrl) urls.push(establishment.twoGisUrl);
  if (establishment.avitoUrl) urls.push(establishment.avitoUrl);

  if (urls.length === 0) return "";
  if (!establishment.platformRotation || urls.length === 1) return urls[0];

  const idx = rotationIndex !== undefined ? rotationIndex % urls.length : Date.now() % urls.length;
  return urls[idx];
}

export function ratingToLabel(rating: number): string {
  const labels: Record<number, string> = {
    1: "Ужасно",
    2: "Плохо",
    3: "Так себе",
    4: "Хорошо",
    5: "Отлично!",
  };
  return labels[rating] || "";
}
