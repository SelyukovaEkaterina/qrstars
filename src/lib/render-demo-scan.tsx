import { redirect } from "next/navigation";
import {
  type DemoQrSlug,
  demoBusinessCard,
  demoFileAsset,
  demoMenu,
  demoRedirectUrl,
  demoReviewScan,
  demoWifiConfig,
  isDemoQrCode,
} from "@/lib/demo-qrcodes";

export async function renderDemoScan(code: string) {
  if (!isDemoQrCode(code)) {
    return null;
  }

  const slug = code as DemoQrSlug;

  switch (slug) {
    case "demo-redirect":
      redirect(demoRedirectUrl);

    case "demo-business-card": {
      const BusinessCardView = (await import("@/components/scan/BusinessCardView")).default;
      return <BusinessCardView card={demoBusinessCard} />;
    }

    case "demo-wifi": {
      const WifiConnect = (await import("@/components/scan/WifiConnect")).default;
      return <WifiConnect wifiConfig={demoWifiConfig} />;
    }

    case "demo-file": {
      const FileDownloadView = (await import("@/components/scan/FileDownloadView")).default;
      return (
        <FileDownloadView file={demoFileAsset} establishmentName="Кофейня «Бобр» (демо)" />
      );
    }

    case "demo-menu": {
      const MenuView = (await import("@/components/scan/MenuView")).default;
      return (
        <MenuView menu={demoMenu} establishmentName="Кофейня «Бобр» (демо)" />
      );
    }

    case "demo-review": {
      const ScanFlow = (await import("@/components/scan/ScanFlow")).default;
      return <ScanFlow {...demoReviewScan} isDemo />;
    }

    default:
      return null;
  }
}
