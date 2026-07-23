import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const STALE_SESSION_ERROR =
  "Сессия устарела. Выйдите из аккаунта и войдите снова.";

export function sessionUserId(session: Session): string | null {
  const id = (session.user as Record<string, unknown> | undefined)?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export async function requireDbUserId(): Promise<
  { ok: true; userId: string } | { ok: false; status: 401; error: string }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, status: 401, error: "Не авторизован" };
  }

  const userId = sessionUserId(session);
  if (!userId) {
    return { ok: false, status: 401, error: STALE_SESSION_ERROR };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    return { ok: false, status: 401, error: STALE_SESSION_ERROR };
  }

  return { ok: true, userId };
}
