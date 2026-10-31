/**
 * Next.js instrumentation.
 *
 * - `onRequestError` — фреймворк вызывает при любом необработанном исключении
 *   в App Router (Server Components / Route Handlers / Server Actions / proxy).
 * - `register` — вызывается один раз при старте сервера. В Node.js runtime
 *   подключает `process.on('unhandledRejection' | 'uncaughtException')`, чтобы
 *   ловить ошибки вне запроса (cron-задачи, scan-flush воркер, фоновые промисы).
 *
 * Node-зависимости (crypto, redis, process.on) изолированы через динамический
 * импорт — Edge bundle их не получает.
 *
 * См. node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md
 */

import type { Instrumentation } from "next";

// ─── App Router errors (Server Components / Route Handlers / Server Actions) ─

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context
) => {
  // NEXT_RUNTIME = 'edge' только в Edge runtime; в Node.js это 'nodejs' (или не задано
  // при прямом старте). По доки Next.js используем "=== 'edge'" — безопаснее.
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { notifyException } = await import("@/lib/error-alerts");
  await notifyException(error, {
    origin: "request",
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    digest: (error as { digest?: string } | null)?.digest,
  });
};

// ─── Background (не в рамках HTTP-запроса) ───────────────────────────────────

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "edge") return; // Edge — без process.on
  // В контейнере нет IPv6, а IPv4 до api.telegram.org подключается 2–8 с.
  // Happy Eyeballs в Node ждёт адрес 250 мс и падал с ETIMEDOUT на каждом
  // запросе к Telegram (уведомления, support, алерты). Только IPv4, без перебора.
  const net = await import("node:net");
  const dns = await import("node:dns");
  net.setDefaultAutoSelectFamily(false);
  dns.setDefaultResultOrder("ipv4first");
  const { registerProcessHandlers } = await import("@/lib/error-alerts.node");
  registerProcessHandlers();
}
