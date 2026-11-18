import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { isMicrositeSlug } from "@/lib/microsite-host";
import { startOfMskDay } from "@/lib/report-formatting";

// Маяк шлёт JS, превью ссылок в мессенджерах его не запускают; отсекаем роботов, исполняющих JS.
const BOT_UA = /bot\b|bot\/|crawl|spider|slurp|headless|lighthouse|python|curl|wget|httpclient/i;

/**
 * Заход на короткий адрес проекта (`{slug}.qrstars.ru`, `/a/{slug}`) — маяк `SiteVisitBeacon`.
 * Пишет посуточный счётчик `SiteVisitStat` (день МСК). Всегда 204: гостю ответ не нужен.
 */
export async function POST(request: Request) {
  const done = new NextResponse(null, { status: 204 });

  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOT_UA.test(ua)) return done;

  let slug = "";
  try {
    const body = (await request.json()) as { slug?: unknown };
    slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  } catch {
    return done;
  }
  if (!isMicrositeSlug(slug)) return done;

  const ip = getClientIp(request);
  if (!rateLimit(`site-visit:${ip}:${slug}`, 5, 60 * 60_000).ok) return done;
  if (!rateLimit(`site-visit:${ip}`, 60, 60 * 60_000).ok) return done;

  const est = await prisma.establishment.findUnique({ where: { shortSlug: slug }, select: { id: true } });
  if (!est) return done;

  const date = startOfMskDay(new Date());
  await prisma.siteVisitStat
    .upsert({
      where: { establishmentId_date: { establishmentId: est.id, date } },
      create: { establishmentId: est.id, date, count: 1 },
      update: { count: { increment: 1 } },
    })
    .catch(() => {});
  return done;
}
