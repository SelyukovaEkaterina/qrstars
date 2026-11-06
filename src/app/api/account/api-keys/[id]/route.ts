import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireDbUserId } from "@/lib/session-user";
import { logUserEvent } from "@/lib/user-events-server";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireDbUserId();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await context.params;
  const result = await prisma.apiKey.updateMany({
    where: { id, userId: auth.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Ключ не найден" }, { status: 404 });
  }

  logUserEvent(auth.userId, "dash.api_key_revoked", { keyId: id });
  return NextResponse.json({ ok: true });
}
