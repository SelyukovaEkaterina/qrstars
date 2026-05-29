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
  demoForm,
  demo2Form,
  demo3Form,
  demoModuleTypes,
  demo2ModuleTypes,
  demo3ModuleTypes,
  demoTipsConfig,
  demoTipsEmployees,
  demoWorkingHours,
  demo2WorkingHours,
  demo3WorkingHours,
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
          moduleTypes={demoModuleTypes}
          forms={[demoForm]}
          menu={demoMenu}
          businessCard={demoBusinessCard}
          wifiConfig={demoWifiConfig}
          reviewRouting={parseReviewRouting(demoReviewScan.reviewRouting)}
          customPages={demoCustomPages}
          platformUrls={demoReviewScan.platformUrls}
          watermarkEnabled={demoReviewScan.watermarkEnabled}
          showPromo={demoReviewScan.showPromo}
          promoCode={demoReviewScan.promoCode}
          tipsConfig={demoTipsConfig}
          isDemo
          brandColor="#4f46e5"
          pageAppearance="light"
          landingSubtitle="Кофе на зерне собственной обжарки • Открыто до 22:00"
          address={demoBusinessCard.address}
          phone={demoBusinessCard.phone}
          yandexMapsUrl={demoReviewScan.platformUrls.yandexMapsUrl}
          workingHours={demoWorkingHours}
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
        <FileDownloadView file={demoFileAsset} establishmentName="Кофейня «Бобр»" brandColor="#4f46e5" pageAppearance="light" />
      );
    }

    case "demo-menu": {
      const MenuView = (await import("@/components/scan/MenuView")).default;
      return (
        <MenuView menu={demoMenu} establishmentName="Кофейня «Бобр»" brandColor="#4f46e5" pageAppearance="light" isDemo />
      );
    }

    case "demo-form": {
      const FormView = (await import("@/components/scan/FormView")).default;
      const { FORM_PRESETS } = await import("@/lib/form-config");
      const preset = FORM_PRESETS.find((p) => p.id === "service_appointment") ?? FORM_PRESETS[0];
      return (
        <FormView
          form={{
            id: "demo-form",
            title: preset.title,
            description: "Демо: ваша заявка никуда не отправится.",
            submitLabel: preset.submitLabel,
            successMessage: preset.successMessage,
            enabled: true,
            fields: preset.fields.map((f, i) => ({
              id: `demo-${i}`,
              label: f.label,
              placeholder: f.placeholder ?? null,
              helpText: null,
              type: f.type,
              required: f.required,
              options: f.options ?? null,
              order: i,
            })),
          }}
          isDemo
          brandColor="#4f46e5"
          pageAppearance="light"
        />
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
          moduleTypes={demo2ModuleTypes}
          forms={[demo2Form]}
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
          landingSubtitle="Шиномонтаж за 20 минут • Запись и сезонное хранение"
          address={demo2BusinessCard.address}
          phone={demo2BusinessCard.phone}
          yandexMapsUrl={demo2ReviewScan.platformUrls.yandexMapsUrl}
          workingHours={demo2WorkingHours}
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
        <FileDownloadView file={demo2FileAsset} establishmentName="Шиномонтаж «Колесо»" brandColor="#ea580c" pageAppearance="light" />
      );
    }

    case "demo2-menu": {
      const MenuView = (await import("@/components/scan/MenuView")).default;
      return (
        <MenuView menu={demo2Menu} establishmentName="Шиномонтаж «Колесо»" brandColor="#ea580c" pageAppearance="light" />
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
          moduleTypes={demo3ModuleTypes}
          forms={[demo3Form]}
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
          landingSubtitle="Современная стоматология • Приём без боли и очередей"
          address={demo3BusinessCard.address}
          phone={demo3BusinessCard.phone}
          yandexMapsUrl={demo3ReviewScan.platformUrls.yandexMapsUrl}
          workingHours={demo3WorkingHours}
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
        <FileDownloadView file={demo3FileAsset} establishmentName="Стоматология «ДентаЛюкс»" brandColor="#0369a1" pageAppearance="light" />
      );
    }

    case "demo3-menu": {
      const MenuView = (await import("@/components/scan/MenuView")).default;
      return (
        <MenuView menu={demo3Menu} establishmentName="Стоматология «ДентаЛюкс»" brandColor="#0369a1" pageAppearance="light" />
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

    case "demo-tips": {
      const TipsEmployeesView = (await import("@/components/scan/TipsEmployeesView")).default;
      return (
        <TipsEmployeesView
          employees={demoTipsEmployees}
          establishmentName="Кофейня «Бобр»"
          brandColor="#4f46e5"
          pageAppearance="light"
        />
      );
    }

    default:
      return null;
  }
}
