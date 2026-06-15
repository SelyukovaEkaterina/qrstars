import maxmind from "maxmind";
import type { Reader, CityResponse } from "maxmind";

let readerPromise: Promise<Reader<CityResponse> | null> | null = null;

function getDbPath(): string {
  return process.env.GEOIP_DB_PATH || "data/GeoLite2-City.mmdb";
}

async function getReader(): Promise<Reader<CityResponse> | null> {
  if (readerPromise) return readerPromise;

  readerPromise = (async () => {
    const dbPath = getDbPath();
    try {
      const fs = await import("fs/promises");
      await fs.access(dbPath);
      return await maxmind.open<CityResponse>(dbPath, {
        cache: { max: 1000 },
        watchForUpdates: false,
      });
    } catch {
      return null;
    }
  })();

  return readerPromise;
}

function isPublicIp(ip: string): boolean {
  return (
    ip !== "unknown" &&
    ip !== "::1" &&
    !ip.startsWith("127.") &&
    !ip.startsWith("10.") &&
    !ip.startsWith("192.168.") &&
    !ip.startsWith("172.16.") &&
    !ip.startsWith("172.17.") &&
    !ip.startsWith("172.18.") &&
    !ip.startsWith("172.19.") &&
    !ip.startsWith("172.2") &&
    !ip.startsWith("169.254.") &&
    !ip.startsWith("fc") &&
    !ip.startsWith("fd")
  );
}

/**
 * Локальный GeoIP-лукуп через MaxMind GeoLite2 (.mmdb).
 * Без внешних HTTP-вызовов. Если БД не сконфигурирована — "Не определён".
 */
export async function lookupGeoRegion(ip: string): Promise<string> {
  if (!isPublicIp(ip)) return "Локальная сеть";

  const reader = await getReader();
  if (!reader) return "Не определён";

  try {
    const result = reader.get(ip);
    if (!result) return "Не определён";

    const city = result.city?.names?.ru || result.city?.names?.en;
    const subdivision =
      result.subdivisions?.[0]?.names?.ru ||
      result.subdivisions?.[0]?.names?.en;
    const country = result.country?.names?.ru || result.country?.names?.en;

    return [city, subdivision, country].filter(Boolean).join(", ") || "Не определён";
  } catch {
    return "Не определён";
  }
}
