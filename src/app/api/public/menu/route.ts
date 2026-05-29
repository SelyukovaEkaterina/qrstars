import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { resolveMenuForScan } from "@/lib/iiko/menu";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limited = rateLimit(`public-menu:${ip}`, 60, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Слишком много запросов" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const establishmentId = searchParams.get("establishmentId")?.trim();
  const menuId = searchParams.get("menuId")?.trim();

  if (!establishmentId || !menuId) {
    return NextResponse.json({ error: "establishmentId и menuId обязательны" }, { status: 400 });
  }

  const menu = await prisma.qRMenu.findFirst({
    where: { id: menuId, estId: establishmentId },
    include: { items: { orderBy: { order: "asc" } } },
  });

  if (!menu) {
    return NextResponse.json({ error: "Меню не найдено" }, { status: 404 });
  }

  const { menu: resolved, error } = await resolveMenuForScan(menu);
  if (!resolved) {
    return NextResponse.json(
      { error: error ?? "Меню временно недоступно" },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { menu: resolved },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=120" } }
  );
}
