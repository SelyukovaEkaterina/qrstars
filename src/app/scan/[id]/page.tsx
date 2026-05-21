import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { renderDemoScan } from "@/lib/render-demo-scan";
import { DEFAULT_REVIEW_ROUTING, parseReviewRouting } from "@/lib/review-routing";
import { parsePageModules, parseModuleOrder, parseModuleLabels } from "@/lib/page-modules";
import {
  resolveMenu,
  resolveBusinessCard,
  resolveWifiConfig,
} from "@/lib/establishment-content";

interface ScanPageProps {
  params: Promise<{ id: string }>;
}

const establishmentContentInclude = {
  menu: {
    include: {
      items: { orderBy: { order: "asc" as const } },
    },
  },
  businessCard: true,
  wifiConfig: true,
  customPages: { where: { enabled: true }, orderBy: { createdAt: "asc" as const } },
  promocodes: { where: { isActive: true }, take: 1 },
  user: { include: { subscriptions: { where: { status: "ACTIVE" }, take: 1 } } },
} as const;

export default async function ScanPage({ params }: ScanPageProps) {
  const { id } = await params;

  const demoPage = await renderDemoScan(id);
  if (demoPage) {
    return demoPage;
  }

  const qrCode = await prisma.qRCode.findUnique({
    where: { code: id },
    include: {
      establishment: { include: establishmentContentInclude },
      businessCard: true,
      wifiConfig: true,
      fileAsset: true,
      customPage: true,
      menu: {
        include: {
          items: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  if (!qrCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="text-5xl">❓</div>
          <h1 className="text-2xl font-bold text-gray-900">QR-код не найден</h1>
          <p className="text-gray-500">
            Проверьте правильность кода или обратитесь к администратору.
          </p>
        </div>
      </div>
    );
  }

  if (!qrCode.isActive) {
    redirect(`/activate/${id}`);
  }

  if (qrCode.mode === "REDIRECT" && qrCode.redirectUrl) {
    await prisma.qRCode.update({
      where: { id: qrCode.id },
      data: { scansCount: { increment: 1 } },
    });
    redirect(qrCode.redirectUrl);
  }

  const est = qrCode.establishment;
  const menu = resolveMenu(est, qrCode);
  const businessCard = resolveBusinessCard(est, qrCode);
  const wifiConfig = resolveWifiConfig(est, qrCode);

  const incrementScan = async () => {
    await prisma.qRCode.update({
      where: { id: qrCode.id },
      data: { scansCount: { increment: 1 } },
    });
  };

  if (qrCode.mode === "FILE") {
    if (!qrCode.fileAsset) {
      return <ScanEmptyState emoji="📁" title="Файл не загружен" desc="Владелец ещё не прикрепил документ к этому QR-коду." />;
    }
    await incrementScan();
    const FileDownloadView = (await import("@/components/scan/FileDownloadView")).default;
    return (
      <FileDownloadView
        file={JSON.parse(JSON.stringify(qrCode.fileAsset))}
        establishmentName={est?.name}
        landingTheme={est?.landingTheme}
      />
    );
  }

  if (!est) {
    redirect(`/activate/${id}`);
  }

  const sub = est.user.subscriptions[0];
  const isPro = sub?.plan === "PRO";
  let promoCode: string | undefined;
  if (isPro && est.promocodes.length > 0) {
    promoCode = est.promocodes[0].code;
  }
  const reviewRouting = isPro
    ? parseReviewRouting(est.reviewRouting)
    : DEFAULT_REVIEW_ROUTING;
  const platformUrls = {
    yandexMapsUrl: est.yandexMapsUrl,
    twoGisUrl: est.twoGisUrl,
    avitoUrl: est.avitoUrl,
  };
  const reviewProps = {
    establishmentName: est.name,
    establishmentId: est.id,
    qrCodeId: qrCode.id,
    reviewRouting,
    platformUrls,
    watermarkEnabled: isPro ? !est.watermarkEnabled : true,
    showPromo: isPro && !!promoCode,
    promoCode,
  };

  if (qrCode.mode === "LANDING") {
    await incrementScan();
    const MicroLandingView = (await import("@/components/scan/MicroLandingView")).default;
    const pageModules = parsePageModules(est.pageModules);
    const moduleOrder = parseModuleOrder(est.moduleOrder);
    const moduleLabels = parseModuleLabels(est.moduleLabels);
    const safeCard = businessCard
      ? {
          id: businessCard.id,
          fullName: businessCard.fullName,
          title: businessCard.title,
          company: businessCard.company,
          phone: businessCard.phone,
          email: businessCard.email,
          website: businessCard.website,
          address: businessCard.address,
          about: businessCard.about,
          avatarUrl: businessCard.avatarUrl,
          socialLinks: (businessCard.socialLinks as { type: string; url: string }[]) || [],
          accentColor: businessCard.accentColor,
        }
      : null;

    return (
      <MicroLandingView
        establishmentName={est.name}
        establishmentId={est.id}
        qrCodeId={qrCode.id}
        pageModules={pageModules}
        moduleOrder={moduleOrder}
        moduleLabels={moduleLabels}
        menu={menu ? JSON.parse(JSON.stringify(menu)) : null}
        businessCard={safeCard}
        wifiConfig={wifiConfig ? JSON.parse(JSON.stringify(wifiConfig)) : null}
        reviewRouting={reviewRouting}
        customPages={JSON.parse(JSON.stringify(est.customPages || []))}
        platformUrls={platformUrls}
        watermarkEnabled={reviewProps.watermarkEnabled}
        showPromo={reviewProps.showPromo}
        promoCode={promoCode}
        landingTheme={est.landingTheme}
      />
    );
  }

  if (qrCode.mode === "BUSINESS_CARD") {
    if (!businessCard) {
      return <ScanEmptyState emoji="📋" title="Визитка не настроена" desc="Заполните визитку в разделе «Моя страница»." />;
    }
    await incrementScan();
    const bc = businessCard;
    const BusinessCardView = (await import("@/components/scan/BusinessCardView")).default;
    return (
      <BusinessCardView
        card={{
          id: bc.id,
          fullName: bc.fullName,
          title: bc.title,
          company: bc.company,
          phone: bc.phone,
          email: bc.email,
          website: bc.website,
          address: bc.address,
          about: bc.about,
          avatarUrl: bc.avatarUrl,
          socialLinks: (bc.socialLinks as { type: string; url: string }[]) || [],
          accentColor: bc.accentColor,
        }}
        qrCode={id}
        showContactForm={bc.contactEnabled && !!bc.contactMessengerId}
        landingTheme={est.landingTheme}
      />
    );
  }

  if (qrCode.mode === "MENU") {
    if (!menu) {
      return <ScanEmptyState emoji="☕" title="Меню не заполнено" desc="Добавьте позиции в разделе «Моя страница»." />;
    }
    await incrementScan();
    const MenuView = (await import("@/components/scan/MenuView")).default;
    return (
      <MenuView menu={JSON.parse(JSON.stringify(menu))} establishmentName={est.name} landingTheme={est.landingTheme} />
    );
  }

  if (qrCode.mode === "WIFI") {
    if (!wifiConfig) {
      return <ScanEmptyState emoji="📶" title="Wi-Fi не настроен" desc="Настройте Wi-Fi в разделе «Моя страница»." />;
    }
    await incrementScan();
    const WifiConnect = (await import("@/components/scan/WifiConnect")).default;
    return <WifiConnect wifiConfig={JSON.parse(JSON.stringify(wifiConfig))} landingTheme={est.landingTheme} />;
  }

  if (qrCode.mode === "CUSTOM_SECTION") {
    if (!qrCode.customPage) {
      return <ScanEmptyState emoji="📄" title="Страница не найдена" desc="Кастомная страница была удалена или отключена." />;
    }
    await incrementScan();
    if (qrCode.customPage.type === "LINK" && qrCode.customPage.url) {
      redirect(qrCode.customPage.url);
    }
    const CustomPageView = (await import("@/components/scan/CustomPageView")).default;
    return (
      <CustomPageView
        title={qrCode.customPage.title}
        content={qrCode.customPage.content}
        landingTheme={est.landingTheme}
      />
    );
  }

  await incrementScan();
  const ScanFlow = (await import("@/components/scan/ScanFlow")).default;
  return <ScanFlow {...reviewProps} landingTheme={est.landingTheme} />;
}

function ScanEmptyState({
  emoji,
  title,
  desc,
}: {
  emoji: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <div className="text-5xl">{emoji}</div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-500">{desc}</p>
      </div>
    </div>
  );
}

