/**
 * Runtime-aware dispatcher для алертов об исключениях.
 *
 * Реализация (node:crypto, ioredis, process.on) живёт в `error-alerts.node.ts`
 * и подгружается только в Node.js runtime. В Edge runtime (если когда-нибудь
 * понадобится) вызовы молча no-op'ают — так Turbopack не пытается бандлить
 * Node-модули в Edge bundle.
 *
 * См. node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md
 */

export type ExceptionContext = import("./error-alerts.node").ExceptionContext;

export async function notifyException(
  error: unknown,
  ctx?: ExceptionContext
): Promise<void> {
  if (process.env.NEXT_RUNTIME === "edge") return; // no-op в Edge
  const { notifyException: impl } = await import("./error-alerts.node");
  return impl(error, ctx);
}

