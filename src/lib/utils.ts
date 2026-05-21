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

export function scanUrlForCode(code: string): string {
  return `${getAppBaseUrl()}/scan/${code}`;
}

export function generateQRCode(): string {
  const chars = "abcdefghijkmnopqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
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
