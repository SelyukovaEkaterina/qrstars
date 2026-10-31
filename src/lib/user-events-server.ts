import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Серверное событие действия в кабинете (`dash.*`): что владелец сделал после
 * мастера — сохранил меню, визитку, QR, микросайт. Пишется в `UserEvent`.
 * Никогда не бросает и не задерживает ответ: сбой записи только логируется.
 */
export function logUserEvent(
  userId: string | null | undefined,
  event: `dash.${string}`,
  props?: Record<string, unknown>
): void {
  if (!userId) return;
  void prisma.userEvent
    .create({
      data: {
        userId,
        event,
        props: (props && Object.keys(props).length > 0 ? props : undefined) as
          | Prisma.InputJsonValue
          | undefined,
      },
    })
    .catch((err: unknown) => {
      console.error("[user-event] write failed", event, err);
    });
}
