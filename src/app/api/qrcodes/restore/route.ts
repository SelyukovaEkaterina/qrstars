import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { establishmentAccessWhere } from "@/lib/establishment-access";
import { invalidateScanCache } from "@/lib/cache";
import { getAuthUserId } from "@/lib/mobile-auth";
import { findRedirectUrlProblem, toHeaderSafeUrl } from "@/lib/redirect-url";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { parseRestoreCode } from "@/lib/qr-restore";
import { logUserEvent } from "@/lib/user-events-server";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Восстановление QR после аварии Beget: владелец вводит ID напечатанного кода,
 * и мы заново создаём QR с этим кодом в его проекте. Владельца проверить нечем —
 * код получает тот, кто ввёл его первым (риск принят). Лимиты не дают перебирать коды.
 */
export async function POST(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const byUser = rateLimit(`qr-restore:user:${userId}`, 30, HOUR_MS);
  const byIp = rateLimit(`qr-restore:ip:${getClientIp(request)}`, 60, HOUR_MS);
  if (!byUser.ok || !byIp.ok) {
    return NextResponse.json(
      { error: "Слишком много попыток. Если кодов много — напишите в поддержку, восстановим вручную." },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const code = parseRestoreCode(body?.code);
  if (!code) {
    return NextResponse.json(
      { error: "Не похоже на ID QR-кода. Он указан на странице, которая открывается при сканировании, или в ссылке после /q/" },
      { status: 400 }
    );
  }

  const establishmentId = typeof body?.establishmentId === "string" ? body.establishmentId : "";
  if (!establishmentId) {
    return NextResponse.json({ error: "Выберите проект" }, { status: 400 });
  }
  const establishment = await prisma.establishment.findFirst({
    where: { id: establishmentId, ...establishmentAccessWhere(userId) },
    select: { id: true },
  });
  if (!establishment) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const rawUrl = typeof body?.redirectUrl === "string" ? body.redirectUrl.trim() : "";
  let redirectUrl: string | null = null;
  if (rawUrl) {
    const problem = findRedirectUrlProblem(rawUrl);
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 });
    }
    redirectUrl = toHeaderSafeUrl(rawUrl) ?? rawUrl;
  }

  const existing = await prisma.qRCode.findUnique({
    where: { code },
    select: { id: true, userId: true, establishmentId: true },
  });
  if (existing) {
    if (existing.userId === userId) {
      return NextResponse.json(
        {
          error: "Этот QR-код уже есть в вашем кабинете",
          qrcodeId: existing.id,
          establishmentId: existing.establishmentId,
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Этот код уже восстановлен другим аккаунтом. Если это ваш QR — напишите в поддержку." },
      { status: 409 }
    );
  }

  const label = typeof body?.label === "string" && body.label.trim() ? body.label.trim().slice(0, 100) : null;

  let qrcode;
  try {
    qrcode = await prisma.qRCode.create({
      data: {
        code,
        // Без ссылки — REDIRECT без адреса: гость видит «временно недоступен», пока владелец не настроит режим.
        mode: "REDIRECT",
        redirectUrl,
        label: label ?? "Восстановленный QR",
        isActive: true,
        source: "DASHBOARD",
        user: { connect: { id: userId } },
        establishment: { connect: { id: establishment.id } },
      },
      select: { id: true, code: true, establishmentId: true, mode: true, redirectUrl: true },
    });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      return NextResponse.json(
        { error: "Этот код только что восстановил другой аккаунт. Если это ваш QR — напишите в поддержку." },
        { status: 409 }
      );
    }
    throw err;
  }

  invalidateScanCache(code).catch(() => {});
  console.log("[qr-restore]", JSON.stringify({ userId, code, establishmentId: establishment.id, withUrl: Boolean(redirectUrl) }));
  logUserEvent(userId, "dash.qr_restored", { code, withUrl: Boolean(redirectUrl) });

  return NextResponse.json({ qrcode });
}
