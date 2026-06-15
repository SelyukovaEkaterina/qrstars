import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DEMO_QR_PREFIX } from "@/lib/demo-qrcodes";
import { generateQRCode, normalizeMediaUrl } from "@/lib/utils";
import { userHasPaidFeatures } from "@/lib/subscription-utils";
import {
  qrcodeAccessWhere,
  establishmentAccessWhere,
  establishmentHasPaidFeatures,
} from "@/lib/establishment-access";
import { ensureQrStylePresets } from "@/lib/ensure-qr-style-presets";
import { ensureStickerPresets } from "@/lib/ensure-sticker-presets";
import { isBuiltInQrStyleTemplateId } from "@/lib/qr-code-templates";
import { isBuiltInStickerTemplateId } from "@/lib/builtin-sticker-templates";
import { invalidateScanCache } from "@/lib/cache";

export async function GET(request: Request) {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { searchParams } = new URL(request.url);
  const establishmentId = searchParams.get("establishmentId");
  const qrId = searchParams.get("id");

  const include = {
    establishment: {
      select: {
        name: true,
        id: true,
        pageModules: true,
        menu: {
          include: {
            items: { orderBy: { order: "asc" as const } },
          },
        },
        businessCard: { include: { contactMessenger: true } },
        wifiConfig: true,
        customPages: { orderBy: { createdAt: "asc" as const } },
      },
    },
    template: { select: { id: true, name: true } },
    qrStyleTemplate: { select: { id: true, name: true, layout: true } },
    businessCard: { include: { contactMessenger: true } },
    wifiConfig: true,
    fileAsset: true,
    customPage: true,
    menu: {
      include: {
        items: {
          orderBy: { order: "asc" as const },
        }
      }
    }
  };

  if (qrId) {
    const qrcode = await prisma.qRCode.findFirst({
      where: { id: qrId, ...qrcodeAccessWhere(userId) },
      include,
    });
    if (!qrcode) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const isPro = qrcode.establishmentId
      ? await establishmentHasPaidFeatures(qrcode.establishmentId)
      : await userHasPaidFeatures(userId);
    return NextResponse.json({
      qrcode: { ...qrcode, centerLogoUrl: normalizeMediaUrl(qrcode.centerLogoUrl) },
      isPro,
    });
  }

  const where: Record<string, unknown> = { ...qrcodeAccessWhere(userId) };
  if (establishmentId) {
    where.establishmentId = establishmentId;
  }

  const isPro = establishmentId
    ? await establishmentHasPaidFeatures(establishmentId)
    : await userHasPaidFeatures(userId);

  const qrcodes = await prisma.qRCode.findMany({
    where,
    include: {
      establishment: { select: { name: true } },
      template: { select: { id: true, name: true } },
    qrStyleTemplate: { select: { id: true, name: true, layout: true } },
      businessCard: { include: { contactMessenger: true } },
      wifiConfig: true,
      fileAsset: true,
      batch: { select: { id: true, masterCode: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    qrcodes: qrcodes.map((q) => ({
      ...q,
      centerLogoUrl: normalizeMediaUrl(q.centerLogoUrl),
    })),
    isPro,
  });
  } catch (e) {
    console.error("QR GET error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();
  const { code: bodyCode, establishmentId, label, redirectUrl, mode } = body;

  let code: string | undefined;
  if (bodyCode?.trim()) {
    const trimmed = bodyCode.trim();
    code = trimmed;
    if (trimmed.startsWith(DEMO_QR_PREFIX)) {
      return NextResponse.json(
        { error: "Код пересекается с зарезервированным префиксом" },
        { status: 400 }
      );
    }
    const existing = await prisma.qRCode.findUnique({ where: { code: trimmed } });
    if (existing) {
      return NextResponse.json({ error: "QR-код с таким кодом уже существует" }, { status: 400 });
    }
  } else {
    for (let i = 0; i < 10; i++) {
      const candidate = generateQRCode();
      const exists = await prisma.qRCode.findUnique({ where: { code: candidate } });
      if (!exists) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      return NextResponse.json({ error: "Не удалось сгенерировать уникальный код" }, { status: 500 });
    }
    if (code.startsWith(DEMO_QR_PREFIX)) {
      return NextResponse.json(
        { error: "Сгенерированный код пересекается с зарезервированным префиксом" },
        { status: 500 }
      );
    }
  }

  if (establishmentId) {
    const establishment = await prisma.establishment.findFirst({
      where: { id: establishmentId, ...establishmentAccessWhere(userId) },
    });
    if (!establishment) {
      return NextResponse.json({ error: "Establishment not found" }, { status: 404 });
    }
  }

  const createData: Record<string, unknown> = {
    code,
    mode: mode || "REVIEW",
    isActive: true,
    source: "DASHBOARD",
    user: { connect: { id: userId } },
  };
  if (label) createData.label = label;
  if (redirectUrl) createData.redirectUrl = redirectUrl;
  if (establishmentId) {
    createData.establishment = { connect: { id: establishmentId } };
  }

  const qrcode = await prisma.qRCode.create({
    data: createData as Parameters<typeof prisma.qRCode.create>[0]["data"],
  });

  return NextResponse.json({ qrcode });
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as Record<string, unknown>).id as string;
    const body = await request.json();
    const { id, label, establishmentId, redirectUrl, mode, isActive, templateId, qrStyleTemplateId, businessCardId, wifiConfigId, fileAssetId, menuId, centerText, centerLogoUrl, customSectionId, tipsType, tipsPhone, tipsBankName } = body;

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const qrcode = await prisma.qRCode.findFirst({
      where: { id, ...qrcodeAccessWhere(userId) },
    });

    if (!qrcode) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (establishmentId) {
      const est = await prisma.establishment.findFirst({
        where: { id: establishmentId, ...establishmentAccessWhere(userId) },
      });
      if (!est) {
        return NextResponse.json({ error: "Establishment not found" }, { status: 404 });
      }
    }

    const data: Record<string, unknown> = {};
    if (label !== undefined) data.label = label || null;
    if (redirectUrl !== undefined) data.redirectUrl = redirectUrl || null;
    if (mode !== undefined) data.mode = mode;
    if (isActive !== undefined) data.isActive = isActive;
    if (establishmentId !== undefined) {
      if (establishmentId) {
        data.establishment = { connect: { id: establishmentId } };
      } else {
        data.establishment = { disconnect: true };
      }
    }
    if (templateId !== undefined) {
      if (templateId) {
        if (isBuiltInStickerTemplateId(templateId)) {
          await ensureStickerPresets();
        }
        data.template = { connect: { id: templateId } };
      } else {
        data.template = { disconnect: true };
      }
    }
    if (qrStyleTemplateId !== undefined) {
      if (qrStyleTemplateId) {
        if (isBuiltInQrStyleTemplateId(qrStyleTemplateId)) {
          await ensureQrStylePresets();
        }
        data.qrStyleTemplate = { connect: { id: qrStyleTemplateId } };
      } else {
        data.qrStyleTemplate = { disconnect: true };
      }
    }
    if (businessCardId !== undefined) {
      if (businessCardId) {
        data.businessCard = { connect: { id: businessCardId } };
      } else {
        data.businessCard = { disconnect: true };
      }
    }
    if (wifiConfigId !== undefined) {
      if (wifiConfigId) {
        data.wifiConfig = { connect: { id: wifiConfigId } };
      } else {
        data.wifiConfig = { disconnect: true };
      }
    }
    if (fileAssetId !== undefined) {
      if (fileAssetId) {
        data.fileAsset = { connect: { id: fileAssetId } };
      } else {
        data.fileAsset = { disconnect: true };
      }
    }
    if (menuId !== undefined) {
      if (menuId) {
        data.menu = { connect: { id: menuId } };
      } else {
        data.menu = { disconnect: true };
      }
    }
    if (centerText !== undefined) data.centerText = centerText || null;
    if (centerLogoUrl !== undefined) {
      data.centerLogoUrl = centerLogoUrl ? normalizeMediaUrl(centerLogoUrl) : null;
    }
    if (tipsType !== undefined) data.tipsType = tipsType || null;
    if (tipsPhone !== undefined) data.tipsPhone = tipsPhone || null;
    if (tipsBankName !== undefined) data.tipsBankName = tipsBankName || null;
    if (customSectionId !== undefined) {
      if (customSectionId) {
        data.customPage = { connect: { id: customSectionId } };
      } else {
        data.customPage = { disconnect: true };
      }
    }

    if (qrcode.source === "DASHBOARD") {
      data.isActive = true;
    }

    const updated = await prisma.qRCode.update({
      where: { id },
      data,
    });

    invalidateScanCache(qrcode.code).catch(() => {});

    return NextResponse.json({ qrcode: updated });
  } catch (e) {
    console.error("QR PUT error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
