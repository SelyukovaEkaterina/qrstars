import https from "https";
import { URL } from "url";

const DEFAULT_BASE = "https://api-ru.iiko.services";
const REQUEST_TIMEOUT_MS = 60_000;

export class IikoApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "IikoApiError";
  }
}

export function iikoBaseUrl(): string {
  return process.env.IIKO_API_BASE_URL?.trim() || DEFAULT_BASE;
}

export async function getAccessToken(apiLogin: string): Promise<string> {
  const data = await iikoPost<{ token?: string }>(
    "/api/1/access_token",
    { apiLogin },
    null
  );
  if (!data.token) {
    throw new IikoApiError("iiko не вернул токен доступа");
  }
  return data.token;
}

function iikoErrorMessage(status: number, json: unknown, rawText: string): string {
  if (
    typeof json === "object" &&
    json !== null &&
    "errorDescription" in json &&
    typeof (json as { errorDescription: unknown }).errorDescription === "string"
  ) {
    return (json as { errorDescription: string }).errorDescription;
  }
  if (rawText.trimStart().startsWith("<")) {
    return `Сервер iiko временно недоступен (HTTP ${status})`;
  }
  return `iiko API error ${status}`;
}

/** Node fetch (undici) breaks on large menu/by_id responses; use https directly. */
function httpsPostJson(
  url: string,
  body: unknown,
  token: string | null,
  timeoutMs: number
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = JSON.stringify(body ?? {});
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(payload)),
      Accept: "application/json",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: "POST",
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            text: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );

    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error("IIKO_TIMEOUT"));
    }, timeoutMs);

    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    req.on("close", () => clearTimeout(timer));

    req.write(payload);
    req.end();
  });
}

export async function iikoPost<T>(
  path: string,
  body: unknown,
  token: string | null
): Promise<T> {
  try {
    const url = `${iikoBaseUrl()}${path}`;
    const { status, text } = await httpsPostJson(url, body, token, REQUEST_TIMEOUT_MS);

    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
    }

    if (status < 200 || status >= 300) {
      throw new IikoApiError(iikoErrorMessage(status, json, text), status, json);
    }

    return json as T;
  } catch (e) {
    if (e instanceof IikoApiError) throw e;
    if (e instanceof Error && e.message === "IIKO_TIMEOUT") {
      throw new IikoApiError("Таймаут запроса к iiko");
    }
    throw new IikoApiError(e instanceof Error ? e.message : "Ошибка iiko");
  }
}
