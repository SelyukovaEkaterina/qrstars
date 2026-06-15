export interface ClientInfo {
  ip: string;
  region: string;
  browser: string;
  device: string;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

export function parseUserAgent(ua: string | null): { browser: string; device: string } {
  if (!ua) {
    return { browser: "Неизвестно", device: "Неизвестно" };
  }

  let browser = "Другой";
  if (ua.includes("Edg/")) browser = "Microsoft Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera")) browser = "Opera";
  else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Chrome";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";
  else if (ua.includes("YaBrowser")) browser = "Яндекс.Браузер";

  let device = "Компьютер";
  if (/iPhone|iPod/i.test(ua)) device = "iPhone";
  else if (/iPad/i.test(ua)) device = "iPad";
  else if (/Android/i.test(ua)) {
    device = /Mobile/i.test(ua) ? "Android (телефон)" : "Android (планшет)";
  } else if (/Windows Phone/i.test(ua)) device = "Windows Phone";
  else if (/Macintosh|Mac OS X/i.test(ua) && !/Mobile/i.test(ua)) device = "Mac";
  else if (/Linux/i.test(ua) && !/Android/i.test(ua)) device = "Linux";
  else if (/Windows/i.test(ua)) device = "Windows";

  return { browser, device };
}

export { lookupGeoRegion as getGeoRegion } from "@/lib/geoip";
import { lookupGeoRegion } from "@/lib/geoip";

export async function collectClientInfo(request: Request): Promise<ClientInfo> {
  const ip = getClientIp(request);
  const ua = request.headers.get("user-agent");
  const { browser, device } = parseUserAgent(ua);
  const region = await lookupGeoRegion(ip);

  return { ip, region, browser, device };
}
