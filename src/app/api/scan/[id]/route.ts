import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  demoBusinessCard,
  demoFileAsset,
  demoMenu,
  demoRedirectUrl,
  demoReviewScan,
  demoWifiConfig,
  isDemoQrCode,
} from "@/lib/demo-qrcodes";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isDemoQrCode(id)) {
    switch (id) {
      case "demo-review":
        return NextResponse.json({
          needsActivation: false,
          demo: true,
          ...demoReviewScan,
          tipsEnabled: false,
        });
      case "demo-redirect":
        return NextResponse.json({
          needsActivation: false,
          demo: true,
          mode: "REDIRECT",
          redirectUrl: demoRedirectUrl,
        });
      case "demo-business-card":
        return NextResponse.json({
          needsActivation: false,
          demo: true,
          mode: "BUSINESS_CARD",
          businessCard: demoBusinessCard,
        });
      case "demo-wifi":
        return NextResponse.json({
          needsActivation: false,
          demo: true,
          mode: "WIFI",
          wifiConfig: demoWifiConfig,
        });
      case "demo-file":
        return NextResponse.json({
          needsActivation: false,
          demo: true,
          mode: "FILE",
          fileAsset: demoFileAsset,
        });
      case "demo-menu":
        return NextResponse.json({
          needsActivation: false,
          demo: true,
          mode: "MENU",
          menu: demoMenu,
          establishmentName: "Кофейня «Бобр» (демо)",
        });
      default:
        break;
    }
  }

  const qrCode = await prisma.qRCode.findUnique({
    where: { code: id },
    include: {
      establishment: {
        include: {
          promocodes: { where: { isActive: true }, take: 1 },
          user: { include: { subscriptions: { where: { status: "ACTIVE" }, take: 1 } } },
        },
      },
      businessCard: true,
      wifiConfig: true,
      fileAsset: true,
    },
  });

  if (!qrCode) {
    return NextResponse.json({ error: "QR-код не найден" }, { status: 404 });
  }

  if (!qrCode.isActive) {
    return NextResponse.json({ needsActivation: true, code: id });
  }

  if (qrCode.mode === "BUSINESS_CARD") {
    if (!qrCode.businessCard) {
      return NextResponse.json({ needsActivation: true, code: id });
    }
    await prisma.qRCode.update({
      where: { id: qrCode.id },
      data: { scansCount: { increment: 1 } },
    });
    return NextResponse.json({
      needsActivation: false,
      mode: "BUSINESS_CARD",
      businessCard: qrCode.businessCard,
    });
  }

  if (qrCode.mode === "FILE") {
    if (!qrCode.fileAsset) {
      return NextResponse.json({ needsActivation: true, code: id });
    }
    await prisma.qRCode.update({
      where: { id: qrCode.id },
      data: { scansCount: { increment: 1 } },
    });
    return NextResponse.json({
      needsActivation: false,
      mode: "FILE",
      fileAsset: qrCode.fileAsset,
    });
  }

  if (qrCode.mode === "WIFI") {
    if (!qrCode.wifiConfig) {
      return NextResponse.json({ needsActivation: true, code: id });
    }
    await prisma.qRCode.update({
      where: { id: qrCode.id },
      data: { scansCount: { increment: 1 } },
    });
    return NextResponse.json({
      needsActivation: false,
      mode: "WIFI",
      wifiConfig: qrCode.wifiConfig,
    });
  }

  if (qrCode.mode === "REDIRECT" && qrCode.redirectUrl) {
    await prisma.qRCode.update({
      where: { id: qrCode.id },
      data: { scansCount: { increment: 1 } },
    });
    return NextResponse.json({
      needsActivation: false,
      mode: "REDIRECT",
      redirectUrl: qrCode.redirectUrl,
    });
  }

  if (!qrCode.establishment) {
    return NextResponse.json({ needsActivation: true, code: id });
  }

  const est = qrCode.establishment;
  const sub = est.user.subscriptions[0];
  const isPro = sub?.plan === "PRO";

  let redirectUrl = est.yandexMapsUrl || "";
  if (isPro && est.platformRotation) {
    const urls = [est.yandexMapsUrl, est.twoGisUrl, est.avitoUrl].filter(Boolean) as string[];
    if (urls.length > 0) {
      redirectUrl = urls[Math.floor(Date.now() / 86400000) % urls.length];
    }
  }

  let promoCode: string | undefined;
  if (isPro && est.promocodes.length > 0) {
    promoCode = est.promocodes[0].code;
  }

  return NextResponse.json({
    needsActivation: false,
    establishmentId: est.id,
    establishmentName: est.name,
    qrCodeId: qrCode.id,
    redirectUrl,
    watermarkEnabled: isPro ? !est.watermarkEnabled : true,
    showPromo: isPro && !!promoCode,
    promoCode,
    tipsEnabled: isPro && est.tipsEnabled,
  });
}
