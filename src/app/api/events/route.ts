import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { isAnalyticsDisabled } from "@/lib/analytics-exclusion";
import { parseUserEvent } from "@/lib/user-events";
import type { Prisma } from "@/generated/prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const events = await prisma.userEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      event: true,
      props: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const rl = rateLimit(`events:${userId}`, 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком много запросов" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = parseUserEvent(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const cookieStore = await cookies();
  const qa = isAnalyticsDisabled(cookieStore);
  const props = {
    ...(parsed.props ?? {}),
    ...(qa ? { qa: true } : {}),
  };

  await prisma.userEvent.create({
    data: {
      userId,
      event: parsed.event,
      props: (Object.keys(props).length > 0 ? props : undefined) as
        | Prisma.InputJsonValue
        | undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
