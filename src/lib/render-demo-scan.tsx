import { redirect } from "next/navigation";
import {
  type DemoQrSlug,
  demoBusinessCard,
  demoCustomPages,
  demoFileAsset,
  demoMenu,
  demoPageModules,
  demoModuleIcons,
  demoRedirectUrl,
  demoReviewScan,
  demoWifiConfig,
  isDemoQrCode,
  demo2Menu,
  demo2BusinessCard,
  demo2WifiConfig,
  demo2FileAsset,
  demo2PageModules,
  demo2ModuleIcons,
  demo2CustomPages,
  demo2ReviewScan,
  demo2RedirectUrl,
  demo3Menu,
  demo3BusinessCard,
  demo3WifiConfig,
  demo3FileAsset,
  demo3PageModules,
  demo3ModuleIcons,
  demo3CustomPages,
  demo3ReviewScan,
  demo3RedirectUrl,
} from "@/lib/demo-qrcodes";

export async function renderDemoScan(code: string) {
  if (!isDemoQrCode(code)) {
    return null;
  }

  const slug = code as DemoQrSlug;

  switch (slug) {
    case "demo-landing": {
      const MicroLandingView = (await import("@/components/scan/MicroLandingView")).default;
      const { parseReviewRouting } = await import("@/lib/review-routing");
      return (
        <MicroLandingView
          establishmentName={demoReviewScan.establishmentName}
          establishmentId={demoReviewScan.establishmentId}
          qrCodeId="demo-landing"
          pageModules={demoPageModules}
          moduleOrder={null}
          moduleIcons={demoModuleIcons}
          menu={demoMenu}
          businessCard={demoBusinessCard}
          wifiConfig={demoWifiConfig}
          reviewRouting={parseReviewRouting(demoReviewScan.reviewRouting)}
          customPages={demoCustomPages}
          platformUrls={demoReviewScan.platformUrls}
          watermarkEnabled={demoReviewScan.watermarkEnabled}
          showPromo={demoReviewScan.showPromo}
          promoCode={demoReviewScan.promoCode}
          isDemo
          brandColor="#4f46e5"
          pageAppearance="light"
        />
      );
    }

    case "demo-redirect":
      redirect(demoRedirectUrl);

    case "demo-business-card": {
      const BusinessCardView = (await import("@/components/scan/BusinessCardView")).default;
      return <BusinessCardView card={demoBusinessCard} brandColor="#4f46e5" pageAppearance="light" />;
    }

    case "demo-wifi": {
      const WifiConnect = (await import("@/components/scan/WifiConnect")).default;
      return <WifiConnect wifiConfig={demoWifiConfig} brandColor="#4f46e5" pageAppearance="light" />;
    }

    case "demo-file": {
      const FileDownloadView = (await import("@/components/scan/FileDownloadView")).default;
      return (
        <FileDownloadView file={demoFileAsset} establishmentName="Кофейня «Бобр» (демо)" brandColor="#4f46e5" pageAppearance="light" />
      );
    }

    case "demo-menu": {
      const MenuView = (await import("@/components/scan/MenuView")).default;
      return (
        <MenuView menu={demoMenu} establishmentName="Кофейня «Бобр» (демо)" brandColor="#4f46e5" pageAppearance="light" />
      );
    }

    case "demo-review": {
      const ScanFlow = (await import("@/components/scan/ScanFlow")).default;
      const { parseReviewRouting } = await import("@/lib/review-routing");
      return (
        <ScanFlow
          establishmentName={demoReviewScan.establishmentName}
          establishmentId={demoReviewScan.establishmentId}
          qrCodeId={demoReviewScan.qrCodeId}
          reviewRouting={parseReviewRouting(demoReviewScan.reviewRouting)}
          platformUrls={demoReviewScan.platformUrls}
          watermarkEnabled={demoReviewScan.watermarkEnabled}
          showPromo={demoReviewScan.showPromo}
          promoCode={demoReviewScan.promoCode}
          isDemo
          brandColor="#4f46e5"
          pageAppearance="light"
        />
      );
    }

    // ── Демо-набор №2: Шиномонтаж «Колесо» ──

    case "demo2-landing": {
      const MicroLandingView = (await import("@/components/scan/MicroLandingView")).default;
      const { parseReviewRouting } = await import("@/lib/review-routing");
      return (
        <MicroLandingView
          establishmentName={demo2ReviewScan.establishmentName}
          establishmentId={demo2ReviewScan.establishmentId}
          qrCodeId="demo2-landing"
          pageModules={demo2PageModules}
          moduleOrder={null}
          moduleIcons={demo2ModuleIcons}
          menu={demo2Menu}
          businessCard={demo2BusinessCard}
          wifiConfig={demo2WifiConfig}
          reviewRouting={parseReviewRouting(demo2ReviewScan.reviewRouting)}
          customPages={demo2CustomPages}
          platformUrls={demo2ReviewScan.platformUrls}
          watermarkEnabled={demo2ReviewScan.watermarkEnabled}
          showPromo={demo2ReviewScan.showPromo}
          promoCode={demo2ReviewScan.promoCode}
          isDemo
          brandColor="#ea580c"
          pageAppearance="light"
        />
      );
    }

    case "demo2-redirect":
      redirect(demo2RedirectUrl);

    case "demo2-business-card": {
      const BusinessCardView = (await import("@/components/scan/BusinessCardView")).default;
      return <BusinessCardView card={demo2BusinessCard} brandColor="#ea580c" pageAppearance="light" />;
    }

    case "demo2-wifi": {
      const WifiConnect = (await import("@/components/scan/WifiConnect")).default;
      return <WifiConnect wifiConfig={demo2WifiConfig} brandColor="#ea580c" pageAppearance="light" />;
    }

    case "demo2-file": {
      const FileDownloadView = (await import("@/components/scan/FileDownloadView")).default;
      return (
        <FileDownloadView file={demo2FileAsset} establishmentName="Шиномонтаж «Колесо» (демо)" brandColor="#ea580c" pageAppearance="light" />
      );
    }

    case "demo2-menu": {
      const MenuView = (await import("@/components/scan/MenuView")).default;
      return (
        <MenuView menu={demo2Menu} establishmentName="Шиномонтаж «Колесо» (демо)" brandColor="#ea580c" pageAppearance="light" />
      );
    }

    case "demo2-review": {
      const ScanFlow = (await import("@/components/scan/ScanFlow")).default;
      const { parseReviewRouting } = await import("@/lib/review-routing");
      return (
        <ScanFlow
          establishmentName={demo2ReviewScan.establishmentName}
          establishmentId={demo2ReviewScan.establishmentId}
          qrCodeId={demo2ReviewScan.qrCodeId}
          reviewRouting={parseReviewRouting(demo2ReviewScan.reviewRouting)}
          platformUrls={demo2ReviewScan.platformUrls}
          watermarkEnabled={demo2ReviewScan.watermarkEnabled}
          showPromo={demo2ReviewScan.showPromo}
          promoCode={demo2ReviewScan.promoCode}
          isDemo
          brandColor="#ea580c"
          pageAppearance="light"
        />
      );
    }

    // ── Демо-набор №3: Стоматология «ДентаЛюкс» ──

    case "demo3-landing": {
      const MicroLandingView = (await import("@/components/scan/MicroLandingView")).default;
      const { parseReviewRouting } = await import("@/lib/review-routing");
      return (
        <MicroLandingView
          establishmentName={demo3ReviewScan.establishmentName}
          establishmentId={demo3ReviewScan.establishmentId}
          qrCodeId="demo3-landing"
          pageModules={demo3PageModules}
          moduleOrder={null}
          moduleIcons={demo3ModuleIcons}
          menu={demo3Menu}
          businessCard={demo3BusinessCard}
          wifiConfig={demo3WifiConfig}
          reviewRouting={parseReviewRouting(demo3ReviewScan.reviewRouting)}
          customPages={demo3CustomPages}
          platformUrls={demo3ReviewScan.platformUrls}
          watermarkEnabled={demo3ReviewScan.watermarkEnabled}
          showPromo={demo3ReviewScan.showPromo}
          promoCode={demo3ReviewScan.promoCode}
          isDemo
          brandColor="#0369a1"
          pageAppearance="light"
        />
      );
    }

    case "demo3-redirect":
      redirect(demo3RedirectUrl);

    case "demo3-business-card": {
      const BusinessCardView = (await import("@/components/scan/BusinessCardView")).default;
      return <BusinessCardView card={demo3BusinessCard} brandColor="#0369a1" pageAppearance="light" />;
    }

    case "demo3-wifi": {
      const WifiConnect = (await import("@/components/scan/WifiConnect")).default;
      return <WifiConnect wifiConfig={demo3WifiConfig} brandColor="#0369a1" pageAppearance="light" />;
    }

    case "demo3-file": {
      const FileDownloadView = (await import("@/components/scan/FileDownloadView")).default;
      return (
        <FileDownloadView file={demo3FileAsset} establishmentName="Стоматология «ДентаЛюкс» (демо)" brandColor="#0369a1" pageAppearance="light" />
      );
    }

    case "demo3-menu": {
      const MenuView = (await import("@/components/scan/MenuView")).default;
      return (
        <MenuView menu={demo3Menu} establishmentName="Стоматология «ДентаЛюкс» (демо)" brandColor="#0369a1" pageAppearance="light" />
      );
    }

    case "demo3-review": {
      const ScanFlow = (await import("@/components/scan/ScanFlow")).default;
      const { parseReviewRouting } = await import("@/lib/review-routing");
      return (
        <ScanFlow
          establishmentName={demo3ReviewScan.establishmentName}
          establishmentId={demo3ReviewScan.establishmentId}
          qrCodeId={demo3ReviewScan.qrCodeId}
          reviewRouting={parseReviewRouting(demo3ReviewScan.reviewRouting)}
          platformUrls={demo3ReviewScan.platformUrls}
          watermarkEnabled={demo3ReviewScan.watermarkEnabled}
          showPromo={demo3ReviewScan.showPromo}
          promoCode={demo3ReviewScan.promoCode}
          isDemo
          brandColor="#0369a1"
          pageAppearance="light"
        />
      );
    }

    default:
      return null;
  }
}
