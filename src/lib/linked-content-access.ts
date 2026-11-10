import prisma from "@/lib/prisma";
import { establishmentAccessWhere } from "@/lib/establishment-access";

/**
 * Проверка перед `connect` меню / визитки / Wi‑Fi / файла / своей страницы к
 * проекту или QR. Раньше id из тела запроса подключался без проверки — зная
 * cuid, можно было привязать чужое меню (в т.ч. iiko) или Wi‑Fi и прочитать
 * пароль через GET.
 *
 * Доступно, если объект принадлежит проекту, к которому у пользователя есть
 * доступ, или создан им самим / владельцем проекта (`ownerUserIds`) — так
 * участник команды может привязать legacy-объект владельца.
 */
export type LinkedContentKind = "menu" | "businessCard" | "wifiConfig" | "fileAsset" | "customPage";

export async function accessibleEstablishmentIds(userId: string): Promise<string[]> {
  const rows = await prisma.establishment.findMany({
    where: establishmentAccessWhere(userId),
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function canLinkContent(
  kind: LinkedContentKind,
  id: string,
  ctx: { userId: string; ownerUserIds?: (string | null | undefined)[]; estIds?: string[] },
): Promise<boolean> {
  if (typeof id !== "string" || !id) return false;
  const estIds = ctx.estIds ?? (await accessibleEstablishmentIds(ctx.userId));
  const ownerIds = [ctx.userId, ...(ctx.ownerUserIds ?? [])].filter(
    (v): v is string => typeof v === "string" && !!v,
  );

  switch (kind) {
    case "menu":
      return !!(await prisma.qRMenu.findFirst({
        where: {
          id,
          OR: [
            { estId: { in: estIds } },
            { establishment: { id: { in: estIds } } },
            {
              qrcodes: {
                some: { OR: [{ userId: { in: ownerIds } }, { establishmentId: { in: estIds } }] },
              },
            },
          ],
        },
        select: { id: true },
      }));
    case "businessCard":
      return !!(await prisma.businessCard.findFirst({
        where: {
          id,
          OR: [
            { userId: { in: ownerIds } },
            { estId: { in: estIds } },
            { establishment: { id: { in: estIds } } },
          ],
        },
        select: { id: true },
      }));
    case "wifiConfig":
      return !!(await prisma.wifiConfig.findFirst({
        where: {
          id,
          OR: [
            { userId: { in: ownerIds } },
            { estId: { in: estIds } },
            { establishment: { id: { in: estIds } } },
          ],
        },
        select: { id: true },
      }));
    case "fileAsset":
      return !!(await prisma.fileAsset.findFirst({
        where: { id, userId: { in: ownerIds } },
        select: { id: true },
      }));
    case "customPage":
      return !!(await prisma.customPage.findFirst({
        where: { id, establishmentId: { in: estIds } },
        select: { id: true },
      }));
  }
}

export const LINKED_CONTENT_NOT_FOUND: Record<LinkedContentKind, string> = {
  menu: "Меню не найдено",
  businessCard: "Визитка не найдена",
  wifiConfig: "Настройки Wi‑Fi не найдены",
  fileAsset: "Файл не найден",
  customPage: "Страница не найдена",
};
