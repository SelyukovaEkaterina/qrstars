/**
 * Алерты об исключениях в Telegram (только production) с защитой от переспама.
 *
 * Транспорт — support-бот (`TELEGRAM_SUPPORT_BOT_TOKEN`).
 * Канал — `ADMIN_ALERTS_TELEGRAM_CHAT_ID` (если задан), иначе `TELEGRAM_SUPPORT_GROUP_ID`.
 * Если ничего не задано — алерты отключены.
 *
 * Защита от переспама:
 *  1) Дедуп по fingerprint ошибки (`errorName + message + routePath`) —
 *     в течение окна (по умолчанию 5 мин) отправляется только первое срабатывание.
 *  2) Глобальный rate-limit: не более N алертов в минуту (по умолчанию 10).
 *  3) In-memory fallback, если Redis недоступен (e2e, локально).
 *
 * Модуль НИКОГДА не бросает исключения — сбой отправки не должен ронять запрос.
 */

import { createHash } from "node:crypto";
import Redis from "ioredis";

// ─── Конфигурация ───────────────────────────────────────────────────────────

const COOLDOWN_SEC = parseInt(process.env.ALERTS_COOLDOWN_SEC || "300", 10); // 5 мин
const MAX_PER_MIN = parseInt(process.env.ALERTS_MAX_PER_MIN || "10", 10);
const MESSAGE_MAX = 3500; // лимит Telegram sendMessage ~4096, оставляем запас под заголовок
const STACK_LINES = 4;

/**
 * Свой Redis-клиент для алертов (не разделяем с cache.ts).
 *
 * В cache.ts используются `lazyConnect: true` + `enableOfflineQueue: false`,
 * из-за чего первая команда на неподключенном клиенте молча отвергается.
 * Для алертов это неприемлемо — нужны надёжные атомарные счётчики сразу.
 * Здесь — стандартные настройки ioredis (auto-connect, offline-queue).
 */
let alertsRedis: Redis | null = null;
function getAlertsRedis(): Redis | null {
  if (alertsRedis) return alertsRedis;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    const client = new Redis(url, {
      maxRetriesPerRequest: 2,
      connectTimeout: 3000,
      enableOfflineQueue: true,
      retryStrategy: (times) => Math.min(times * 200, 1000),
    });
    client.on("error", () => {}); // не роняем лог шумом
    alertsRedis = client;
    return client;
  } catch {
    return null;
  }
}

function botToken(): string | null {
  return (
    process.env.TELEGRAM_SUPPORT_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN ||
    null
  );
}

function alertChatId(): string | null {
  return (
    process.env.ADMIN_ALERTS_TELEGRAM_CHAT_ID ||
    process.env.TELEGRAM_SUPPORT_GROUP_ID ||
    null
  );
}

export function isExceptionAlertsEnabled(): boolean {
  return process.env.NODE_ENV === "production" && Boolean(botToken() && alertChatId());
}

// ─── In-memory fallback (когда Redis недоступен) ────────────────────────────

const memFingerprints = new Map<string, number>(); // fp → expiresAt (ms)
const memMinuteBuckets = new Map<number, number>(); // minuteBucket → count
const MEM_CLEANUP_INTERVAL_MS = 120_000;
let memLastCleanup = 0;

function memCleanup(now: number): void {
  if (now - memLastCleanup < MEM_CLEANUP_INTERVAL_MS) return;
  memLastCleanup = now;
  for (const [k, exp] of memFingerprints) if (exp <= now) memFingerprints.delete(k);
  const cur = Math.floor(now / 60_000);
  for (const [k] of memMinuteBuckets) if (cur - k > 2) memMinuteBuckets.delete(k);
}

/**
 * Возвращает true, если алерт разрешён к отправке (прошёл дедуп + rate-limit).
 * Атомарно: на стороне Redis использует NX+Pipeline, на стороне памяти — Map.
 */
async function acquireAlertSlot(fingerprint: string): Promise<boolean> {
  const now = Date.now();
  const redis = getAlertsRedis();

  if (!redis) {
    // ─── In-memory fallback ─────────────────────────────────────────────────
    memCleanup(now);
    const minuteBucket = Math.floor(now / 60_000);
    const cur = (memMinuteBuckets.get(minuteBucket) ?? 0) + 1;
    if (cur > MAX_PER_MIN) return false;
    memMinuteBuckets.set(minuteBucket, cur);

    const exp = memFingerprints.get(fingerprint);
    if (exp && exp > now) return false;
    memFingerprints.set(fingerprint, now + COOLDOWN_SEC * 1000);
    return true;
  }

  // ─── Redis ─────────────────────────────────────────────────────────────────
  try {
    const minuteBucket = Math.floor(now / 60_000);
    const rlKey = `alerts:rl:${minuteBucket}`;
    const fpKey = `alerts:fp:${fingerprint}`;

    const pipeline = redis.pipeline();
    pipeline.incr(rlKey);
    pipeline.expire(rlKey, 90);
    // NX — поставится только если не существует; возвращает "OK" при успехе
    pipeline.set(fpKey, "1", "EX", COOLDOWN_SEC, "NX");
    const results = await pipeline.exec();

    if (!results) return false;
    const rlCount = results[0]?.[1] as number | undefined;
    const fpSet = results[2]?.[1] as string | null;

    if (typeof rlCount === "number" && rlCount > MAX_PER_MIN) return false;
    if (fpSet !== "OK") return false; // уже отправлено в окне
    return true;
  } catch {
    // Redis упал прямо сейчас — разрешаем отправку (лучше перешлём, чем пропустим)
    return true;
  }
}

// ─── Хелперы ────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

/** Берёт первые N значимых строк стека (пропуская node:internal / next internals). */
function topStackLines(stack: string | undefined, lines: number): string {
  if (!stack) return "";
  const out: string[] = [];
  for (const rawLine of stack.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("at ")) continue;
    if (line.includes("node:internal")) continue;
    out.push(line);
    if (out.length >= lines) break;
  }
  return out.join("\n");
}

function fingerprintOf(parts: string[]): string {
  const raw = parts.join("|");
  return createHash("sha1").update(raw).digest("hex").slice(0, 16);
}

/** Имена ошибок / digest'ов, которые не являются реальными сбоями. */
function isHarmless(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name ?? "";
  const msg = (error as { message?: string } | null)?.message ?? "";
  const digest = (error as { digest?: string } | null)?.digest ?? "";

  // Next.js: redirect() / notFound() реализованы через бросание специальных ошибок.
  if (name === "NEXT_REDIRECT" || name === "NEXT_NOT_FOUND") return true;
  // 4xx HTTP-ошибки (включая 404), сгенерированные фреймворком.
  if (name === "NEXT_HTTP_ERROR") {
    const m = msg.match(/(\d{3})/);
    if (m && parseInt(m[1], 10) < 500) return true;
  }
  if (typeof digest === "string" && digest.startsWith("NEXT_NOT_FOUND")) return true;
  return false;
}

// ─── Транспорт ──────────────────────────────────────────────────────────────

async function sendTelegram(text: string): Promise<void> {
  const token = botToken();
  const chatId = alertChatId();
  if (!token || !chatId) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
  } catch {
    // лучшая попытка — не роняем приложение
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Публичный API ──────────────────────────────────────────────────────────

export interface ExceptionContext {
  /** Источник: 'request' (App Router), 'unhandledRejection', 'uncaughtException'. */
  origin?: "request" | "unhandledRejection" | "uncaughtException";
  /** HTTP-контекст (для onRequestError). */
  path?: string;
  method?: string;
  routePath?: string;
  routeType?: "render" | "route" | "action" | "proxy";
  digest?: string;
  /** Произвольный текстовый контекст. */
  extra?: string;
}

const ROUTE_TYPE_LABEL: Record<string, string> = {
  render: "server component",
  route: "route handler",
  action: "server action",
  proxy: "proxy",
};

function buildMessage(error: unknown, ctx: ExceptionContext): string {
  const err = error as { name?: string; message?: string; stack?: string; digest?: string } | null;
  const name = err?.name || "Error";
  const message = err?.message ? String(err.message) : "(нет сообщения)";
  const digest = ctx.digest || err?.digest;

  const originLabel =
    ctx.origin === "unhandledRejection"
      ? "Unhandled rejection"
      : ctx.origin === "uncaughtException"
        ? "Uncaught exception"
        : "Server error";

  const lines: string[] = [`🚨 <b>${escapeHtml(originLabel)}</b>`, ""];

  lines.push(`<b>Type:</b> <code>${escapeHtml(name)}</code>`);
  lines.push(`<b>Message:</b> ${escapeHtml(truncate(message, 800))}`);

  if (ctx.path || ctx.method) {
    const method = ctx.method || "GET";
    const path = ctx.path || "?";
    lines.push(`<b>Request:</b> <code>${escapeHtml(method)} ${escapeHtml(truncate(path, 200))}</code>`);
  }
  if (ctx.routePath) {
    lines.push(`<b>Route:</b> <code>${escapeHtml(ctx.routePath)}</code>`);
  }
  if (ctx.routeType && ROUTE_TYPE_LABEL[ctx.routeType]) {
    lines.push(`<b>Context:</b> ${escapeHtml(ROUTE_TYPE_LABEL[ctx.routeType])}`);
  }
  if (digest) {
    lines.push(`<b>Digest:</b> <code>${escapeHtml(String(digest).slice(0, 64))}</code>`);
  }
  if (ctx.extra) {
    lines.push(`<b>Extra:</b> ${escapeHtml(truncate(ctx.extra, 400))}`);
  }

  const stack = topStackLines(err?.stack, STACK_LINES);
  if (stack) {
    lines.push("", `<code>${escapeHtml(truncate(stack, 1500))}</code>`);
  }

  const ts = new Date().toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    hour12: false,
  });
  lines.push("", `⏰ ${escapeHtml(ts)} MSK`);

  let text = lines.join("\n");
  if (text.length > MESSAGE_MAX) text = `${text.slice(0, MESSAGE_MAX - 1)}…`;
  return text;
}

/**
 * Отправить алерт об исключении в Telegram (с защитой от переспама).
 * Идемпотентен по fingerprint. Никогда не бросает.
 */
export async function notifyException(
  error: unknown,
  ctx: ExceptionContext = {}
): Promise<void> {
  try {
    if (!isExceptionAlertsEnabled()) return;
    if (!error) return;
    if (isHarmless(error)) return;

    const err = error as { name?: string; message?: string; digest?: string } | null;
    const fp = fingerprintOf([
      err?.name || "",
      err?.message || "",
      ctx.routePath || ctx.path || "",
      ctx.digest || err?.digest || "",
    ]);

    const allowed = await acquireAlertSlot(fp);
    if (!allowed) return;

    await sendTelegram(buildMessage(error, ctx));
  } catch {
    // модуль не должен ронять вызывающий код
  }
}

// ─── Глобальные process-обработчики ─────────────────────────────────────────
// Подключаются один раз при старте Node.js сервера из src/instrumentation.ts.
// Ловят ошибки вне HTTP-запроса: cron-задачи, scan-flush воркер, фоновые промисы.

let processHandlersInstalled = false;

export function registerProcessHandlers(): void {
  if (processHandlersInstalled) return;
  processHandlersInstalled = true;

  process.on("unhandledRejection", (reason) => {
    void notifyException(reason, { origin: "unhandledRejection" });
  });

  process.on("uncaughtException", (err) => {
    void notifyException(err, { origin: "uncaughtException" });
    // Не выходим: пусть Node.js / Next.js / Docker сами управляют жизненным циклом.
    // Healthcheck-скрипт (deploy/healthcheck.sh) перехватит истинные отказы.
  });
}
