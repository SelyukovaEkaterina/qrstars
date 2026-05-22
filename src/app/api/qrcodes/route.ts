import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DEMO_QR_PREFIX } from "@/lib/demo-qrcodes";
import { generateQRCode } from "@/lib/utils";

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

  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE", plan: "PRO" },
    orderBy: { createdAt: "desc" },
  });
  const isPro = !!subscription;

  if (qrId) {
    const qrcode = await prisma.qRCode.findFirst({
      where: { id: qrId, userId },
      include,
    });
    if (!qrcode) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ qrcode, isPro });
  }

  const where: Record<string, unknown> = { userId };
  if (establishmentId) {
    where.establishmentId = establishmentId;
    delete where.OR;
  }

  const qrcodes = await prisma.qRCode.findMany({
    where,
    include: {
      establishment: { select: { name: true } },
      template: { select: { id: true, name: true } },
      businessCard: { include: { contactMessenger: true } },
      wifiConfig: true,
      fileAsset: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ qrcodes, isPro });
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
  const { establishmentId, label, redirectUrl, mode, generate } = body;

  let code = body.code as string | undefined;

  if (generate) {
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
  }

  if (!code) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  if (code.startsWith(DEMO_QR_PREFIX)) {
    return NextResponse.json(
      { error: "Префикс demo- зарезервирован для демонстрации на лендинге" },
      { status: 400 }
    );
  }

  if (establishmentId) {
    const establishment = await prisma.establishment.findFirst({
      where: { id: establishmentId, userId },
    });
    if (!establishment) {
      return NextResponse.json({ error: "Establishment not found" }, { status: 404 });
    }
  }

  const existing = await prisma.qRCode.findUnique({ where: { code } });
  if (existing) {
    return NextResponse.json({ error: "QR-код с таким кодом уже существует" }, { status: 400 });
  }

  const createData: Record<string, unknown> = {
    code,
    mode: mode || "REVIEW",
    isActive: !!establishmentId,
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
    const { id, label, establishmentId, redirectUrl, mode, isActive, templateId, businessCardId, wifiConfigId, fileAssetId, menuId, centerText, centerLogoUrl, customSectionId } = body;

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const qrcode = await prisma.qRCode.findFirst({
      where: { id, userId },
    });

    if (!qrcode) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (establishmentId) {
      const est = await prisma.establishment.findFirst({
        where: { id: establishmentId, userId },
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
        data.template = { connect: { id: templateId } };
      } else {
        data.template = { disconnect: true };
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
    if (centerLogoUrl !== undefined) data.centerLogoUrl = centerLogoUrl || null;
    if (customSectionId !== undefined) {
      if (customSectionId) {
        data.customPage = { connect: { id: customSectionId } };
      } else {
        data.customPage = { disconnect: true };
      }
    }

    const updated = await prisma.qRCode.update({
      where: { id },
      data,
    });

    return NextResponse.json({ qrcode: updated });
  } catch (e) {
    console.error("QR PUT error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
