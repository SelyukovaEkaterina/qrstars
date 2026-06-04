import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recordQrScan } from "@/lib/record-qr-scan";
import {
  demoBusinessCard,
  demoFileAsset,
  demoMenu,
  demoPageModules,
  demoRedirectUrl,
  demoReviewScan,
  demoWifiConfig,
  isDemoQrCode,
  demo2Menu,
  demo2BusinessCard,
  demo2WifiConfig,
  demo2FileAsset,
  demo2PageModules,
  demo2ReviewScan,
  demo2RedirectUrl,
  demo3Menu,
  demo3BusinessCard,
  demo3WifiConfig,
  demo3FileAsset,
  demo3PageModules,
  demo3ReviewScan,
  demo3RedirectUrl,
  demoTipsConfig,
} from "@/lib/demo-qrcodes";
import { DEFAULT_REVIEW_ROUTING, parseReviewRouting, reviewRoutingToJson } from "@/lib/review-routing";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isDemoQrCode(id)) {
    switch (id) {
      case "demo-landing":
        return NextResponse.json({
          needsActivation: false,
          demo: true,
          mode: "LANDING",
          establishmentName: demoReviewScan.establishmentName,
          establishmentId: demoReviewScan.establishmentId,
          qrCodeId: "demo-landing",
          pageModules: demoPageModules,
          menu: demoMenu,
          businessCard: demoBusinessCard,
          wifiConfig: demoWifiConfig,
          reviewRouting: demoReviewScan.reviewRouting,
          platformUrls: demoReviewScan.platformUrls,
          watermarkEnabled: demoReviewScan.watermarkEnabled,
          showPromo: demoReviewScan.showPromo,
          promoCode: demoReviewScan.promoCode,
          tipsConfig: demoTipsConfig,
        });
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

      // ── Демо-набор №2: Шиномонтаж «Колесо» ──

      case "demo2-landing":
        return NextResponse.json({
          needsActivation: false,
          demo: true,
          mode: "LANDING",
          establishmentName: demo2ReviewScan.establishmentName,
          establishmentId: demo2ReviewScan.establishmentId,
          qrCodeId: "demo2-landing",
          pageModules: demo2PageModules,
          menu: demo2Menu,
          businessCard: demo2BusinessCard,
          wifiConfig: demo2WifiConfig,
          reviewRouting: demo2ReviewScan.reviewRouting,
          platformUrls: demo2ReviewScan.platformUrls,
          watermarkEnabled: demo2ReviewScan.watermarkEnabled,
          showPromo: demo2ReviewScan.showPromo,
          promoCode: demo2ReviewScan.promoCode,
        });
      case "demo2-review":
        return NextResponse.json({
          needsActivation: false,
          demo: true,
          ...demo2ReviewScan,
          tipsEnabled: false,
        });
      case "demo2-redirect":
        return NextResponse.json({
          needsActivation: false,
          demo: true,
          mode: "REDIRECT",
          redirectUrl: demo2RedirectUrl,
        });
      case "demo2-business-card":
        return NextResponse.json({
          needsActivation: false,
          demo: true,
          mode: "BUSINESS_CARD",
          businessCard: demo2BusinessCard,
        });
      case "demo2-wifi":
        return NextResponse.json({
          needsActivation: false,
          demo: true,
          mode: "WIFI",
          wifiConfig: demo2WifiConfig,
        });
      case "demo2-file":
        return NextResponse.json({
          needsActivation: false,
          demo: true,
          mode: "FILE",
          fileAsset: demo2FileAsset,
        });
      case "demo2-menu":
        return NextResponse.json({
          needsActivation: false,
          demo: true,
          mode: "MENU",
          menu: demo2Menu,
          establishmentName: "Шиномонтаж «Колесо» (демо)",
        });

      // ── Демо-набор №3: Стоматология «ДентаЛюкс» ──

      case "demo3-landing":
        return NextResponse.json({
          needsActivation: false,
          demo: true,
          mode: "LANDING",
          establishmentName: demo3ReviewScan.establishmentName,
          establishmentId: demo3ReviewScan.establishmentId,
          qrCodeId: "demo3-landing",
          pageModules: demo3PageModules,
          menu: demo3Menu,
          businessCard: demo3BusinessCard,
          wifiConfig: demo3WifiConfig,
          reviewRouting: demo3ReviewScan.reviewRouting,
          platformUrls: demo3ReviewScan.platformUrls,
          watermarkEnabled: demo3ReviewScan.watermarkEnabled,
          showPromo: demo3ReviewScan.showPromo,
          promoCode: demo3ReviewScan.promoCode,
        });
      case "demo3-review":
        return NextResponse.json({
          needsActivation: false,
          demo: true,
          ...demo3ReviewScan,
          tipsEnabled: false,
        });
      case "demo3-redirect":
        return NextResponse.json({
          needsActivation: false,
          demo: true,
          mode: "REDIRECT",
          redirectUrl: demo3RedirectUrl,
        });
      case "demo3-business-card":
        return NextResponse.json({
          needsActivation: false,
          demo: true,
          mode: "BUSINESS_CARD",
          businessCard: demo3BusinessCard,
        });
      case "demo3-wifi":
        return NextResponse.json({
          needsActivation: false,
          demo: true,
          mode: "WIFI",
          wifiConfig: demo3WifiConfig,
        });
      case "demo3-file":
        return NextResponse.json({
          needsActivation: false,
          demo: true,
          mode: "FILE",
          fileAsset: demo3FileAsset,
        });
      case "demo3-menu":
        return NextResponse.json({
          needsActivation: false,
          demo: true,
          mode: "MENU",
          menu: demo3Menu,
          establishmentName: "Стоматология «ДентаЛюкс» (демо)",
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
    return NextResponse.json({
      needsActivation: true,
      source: qrCode.source,
      code: id,
    });
  }

  const logScan = (qrCodeId: string, establishmentId: string | null) => {
    recordQrScan({ qrCodeId, establishmentId, headers: request.headers });
  };

  if (qrCode.mode === "BUSINESS_CARD") {
    if (!qrCode.businessCard) {
      return NextResponse.json({ needsActivation: true, code: id });
    }
    logScan(qrCode.id, qrCode.establishmentId);
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
    logScan(qrCode.id, qrCode.establishmentId);
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
    logScan(qrCode.id, qrCode.establishmentId);
    return NextResponse.json({
      needsActivation: false,
      mode: "WIFI",
      wifiConfig: qrCode.wifiConfig,
    });
  }

  if (qrCode.mode === "REDIRECT" && qrCode.redirectUrl) {
    logScan(qrCode.id, qrCode.establishmentId);
    return NextResponse.json({
      needsActivation: false,
      mode: "REDIRECT",
      redirectUrl: qrCode.redirectUrl,
    });
  }

  if (qrCode.mode === "TIPS") {
    logScan(qrCode.id, qrCode.establishmentId);
    const { resolveTipsConfig } = await import("@/lib/tips-config");
    const tips = resolveTipsConfig(qrCode.establishment, qrCode);
    const tipsType = tips?.tipsType || "PHONE";
    let employees = null;
    if (tipsType === "EMPLOYEES" && qrCode.establishmentId) {
      employees = await prisma.tipsEmployee.findMany({
        where: { establishmentId: qrCode.establishmentId },
        orderBy: { order: "asc" },
        select: { id: true, name: true, photoUrl: true, paymentType: true, paymentUrl: true, phone: true, bankName: true },
      });
    }
    return NextResponse.json({
      needsActivation: false,
      mode: "TIPS",
      tipsType,
      redirectUrl: tipsType === "REDIRECT" ? tips?.tipsUrl ?? null : null,
      tipsPhone: tips?.tipsPhone ?? null,
      tipsBankName: tips?.tipsBankName ?? null,
      employees,
    });
  }

  if (!qrCode.establishment) {
    return NextResponse.json({ needsActivation: true, code: id });
  }

  const est = qrCode.establishment;
  const sub = est.user.subscriptions[0];
  const isPro = sub?.plan === "PRO" || sub?.plan === "NETWORK";

  let promoCode: string | undefined;
  if (isPro && est.promocodes.length > 0) {
    promoCode = est.promocodes[0].code;
  }

  const reviewRouting = isPro
    ? parseReviewRouting(est.reviewRouting)
    : DEFAULT_REVIEW_ROUTING;

  return NextResponse.json({
    needsActivation: false,
    establishmentId: est.id,
    establishmentName: est.name,
    qrCodeId: qrCode.id,
    reviewRouting: reviewRoutingToJson(reviewRouting),
    platformUrls: {
      yandexMapsUrl: est.yandexMapsUrl,
      twoGisUrl: est.twoGisUrl,
      avitoUrl: est.avitoUrl,
    },
    watermarkEnabled: isPro ? !est.watermarkEnabled : true,
    showPromo: isPro && !!promoCode,
    promoCode,
    tipsEnabled: isPro && est.tipsEnabled,
  });
}
