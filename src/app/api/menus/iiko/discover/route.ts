import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { establishmentAccessWhere, establishmentHasPaidFeatures } from "@/lib/establishment-access";
import { discoverIiko, IikoApiError } from "@/lib/iiko";
import { decryptApiLogin } from "@/lib/iiko/encrypt";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const rl = rateLimit(`iiko-discover:${userId}`, 20, 60 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком много запросов. Попробуйте позже." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { apiLogin, menuId, establishmentId } = body as {
    apiLogin?: string;
    menuId?: string;
    establishmentId?: string;
  };

  let login = apiLogin?.trim() || "";
  let estId = establishmentId?.trim() || "";

  if (menuId) {
    const menu = await prisma.qRMenu.findFirst({
      where: {
        id: menuId,
        OR: [
          { establishment: establishmentAccessWhere(userId) },
          { estId: { not: null } },
        ],
      },
      select: { iikoApiLogin: true, estId: true, establishment: { select: { id: true } } },
    });
    if (!menu) {
      return NextResponse.json({ error: "Меню не найдено" }, { status: 404 });
    }
    estId = menu.establishment?.id ?? menu.estId ?? estId;
    if (!login && menu.iikoApiLogin) {
      login = decryptApiLogin(menu.iikoApiLogin);
    }
  }

  if (!estId) {
    return NextResponse.json({ error: "Укажите заведение" }, { status: 400 });
  }

  const estAccess = await prisma.establishment.findFirst({
    where: { id: estId, ...establishmentAccessWhere(userId) },
    select: { id: true },
  });
  if (!estAccess) {
    return NextResponse.json({ error: "Заведение не найдено" }, { status: 404 });
  }

  const isPro = await establishmentHasPaidFeatures(estId);
  if (!isPro) {
    return NextResponse.json(
      { error: "Интеграция iiko доступна на тарифе PRO и Сеть" },
      { status: 403 }
    );
  }

  if (!login) {
    return NextResponse.json({ error: "Укажите API-login iiko" }, { status: 400 });
  }

  try {
    const result = await discoverIiko(login);
    return NextResponse.json({ ...result, apiLoginSaved: !!menuId && !apiLogin?.trim() });
  } catch (e) {
    const message =
      e instanceof IikoApiError ? e.message : "Не удалось подключиться к iiko";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
