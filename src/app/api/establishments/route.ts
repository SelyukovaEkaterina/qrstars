import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  canAddEstablishment,
  effectivePlan,
  findActiveSubscription,
  getUpgradeHint,
} from "@/lib/subscription-utils";
import {
  establishmentAccessWhere,
  requireEstablishmentAccess,
} from "@/lib/establishment-access";
import { parseEstablishmentIndustry } from "@/lib/establishment-industry";
import { isPlatformUrlError, parsePlatformUrlField } from "@/lib/platform-url-input";
import { parseYandexMapsUrlField } from "@/lib/yandex-maps-url";
import { normalizeTwoGisUrl } from "@/lib/two-gis-url";
import { invalidateEstablishmentScans } from "@/lib/content-cache";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const establishments = await prisma.establishment.findMany({
    where: establishmentAccessWhere(userId),
    include: {
      _count: { select: { qrcodes: true, reviews: true } },
      qrcodes: { select: { scansCount: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = establishments.map((e) => ({
    id: e.id,
    isOwner: e.userId === userId,
    name: e.name,
    shortSlug: e.shortSlug,
    hasBusinessCard: !!e.businessCardId,
    industry: e.industry,
    address: e.address,
    phone: e.phone,
    yandexMapsUrl: e.yandexMapsUrl,
    twoGisUrl: e.twoGisUrl,
    avitoUrl: e.avitoUrl,
    qrcodesCount: e._count.qrcodes,
    reviewsCount: e._count.reviews,
    totalScans: e.qrcodes.reduce((a, q) => a + q.scansCount, 0),
    createdAt: e.createdAt.toISOString(),
  }));

  return NextResponse.json({ establishments: result });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();
  const { name, address, phone, yandexMapsUrl, twoGisUrl, avitoUrl, qrCodeId } = body;
  const industry = parseEstablishmentIndustry(body.industry);
  if (body.industry !== undefined && body.industry !== null && !industry) {
    return NextResponse.json({ error: "Некорректная отрасль" }, { status: 400 });
  }

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "Название обязательно" },
      { status: 400 }
    );
  }

  const platformUrls: Record<"yandexMapsUrl" | "twoGisUrl" | "avitoUrl", string | null> = {
    yandexMapsUrl: null,
    twoGisUrl: null,
    avitoUrl: null,
  };
  for (const [field, raw] of [
    ["yandexMapsUrl", yandexMapsUrl],
    ["twoGisUrl", twoGisUrl],
    ["avitoUrl", avitoUrl],
  ] as const) {
    // Яндекс — как в настройках проекта: только карточка организации, без коротких ссылок
    const parsed = field === "yandexMapsUrl" ? parseYandexMapsUrlField(raw) : parsePlatformUrlField(raw);
    if (isPlatformUrlError(parsed)) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    platformUrls[field] =
      field === "twoGisUrl" && parsed ? normalizeTwoGisUrl(parsed) ?? parsed : parsed ?? null;
  }

  const existingCount = await prisma.establishment.count({ where: { userId } });
  const subscription = await findActiveSubscription(userId);
  const plan = effectivePlan(subscription);

  if (!canAddEstablishment(plan, existingCount)) {
    const hint = getUpgradeHint(plan, existingCount);
    return NextResponse.json(
      {
        error: hint?.message || "Достигнут лимит заведений на текущем тарифе",
        upgradeRequired: hint?.requiredPlan,
      },
      { status: 403 }
    );
  }

  const establishment = await prisma.establishment.create({
    data: {
      name: name.trim().slice(0, 200),
      industry,
      address: address || null,
      phone: phone || null,
      yandexMapsUrl: platformUrls.yandexMapsUrl,
      twoGisUrl: platformUrls.twoGisUrl,
      avitoUrl: platformUrls.avitoUrl,
      user: { connect: { id: userId } },
    },
  });

  let linkedQrId: string | null = null;

  if (qrCodeId && existingCount === 0) {
    const qr = await prisma.qRCode.findFirst({
      where: { id: qrCodeId, establishmentId: null, source: "DASHBOARD", userId },
    });
    if (qr) {
      await prisma.qRCode.update({
        where: { id: qr.id },
        data: {
          establishment: { connect: { id: establishment.id } },
          isActive: true,
        },
      });
      linkedQrId = qr.id;
    }
  }

  return NextResponse.json({ establishment, linkedQrId });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const access = await requireEstablishmentAccess(userId, id, { ownerOnly: true });
  if (!access.ok) {
    if (access.error.type === "forbidden") {
      return NextResponse.json({ error: access.error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // QR после удаления проекта показывают заглушку — сбрасываем кэш до удаления,
  // пока связи ещё можно найти.
  await invalidateEstablishmentScans(id);
  await prisma.establishment.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
