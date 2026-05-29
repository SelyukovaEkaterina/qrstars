import type { QRMenu } from "@/generated/prisma/client";

/** Never expose encrypted iiko API login to clients */
export function sanitizeMenuForClient<T extends QRMenu & { items?: unknown[] }>(menu: T) {
  const { iikoApiLogin: _, ...rest } = menu;
  return {
    ...rest,
    iikoApiLoginSaved: !!menu.iikoApiLogin,
  };
}
