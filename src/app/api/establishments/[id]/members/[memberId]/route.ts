import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireEstablishmentAccess } from "@/lib/establishment-access";

type RouteContext = { params: Promise<{ id: string; memberId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { id: establishmentId, memberId } = await context.params;

  const access = await requireEstablishmentAccess(userId, establishmentId, { ownerOnly: true });
  if (!access.ok) {
    if (access.error.type === "forbidden") {
      return NextResponse.json({ error: access.error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const member = await prisma.establishmentMember.findFirst({
    where: { id: memberId, establishmentId },
  });
  if (!member) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.establishmentMember.delete({ where: { id: memberId } });

  return NextResponse.json({ success: true });
}
