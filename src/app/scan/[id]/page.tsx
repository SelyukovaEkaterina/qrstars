import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { renderDemoScan } from "@/lib/render-demo-scan";

function getRotatedUrl(
  urls: string[]
): string {
  if (urls.length === 0) return "";
  if (urls.length === 1) return urls[0];
  const daySeed = new Date().getDate();
  return urls[daySeed % urls.length];
}

interface ScanPageProps {
  params: Promise<{ id: string }>;
}

export default async function ScanPage({ params }: ScanPageProps) {
  const { id } = await params;

  const demoPage = await renderDemoScan(id);
  if (demoPage) {
    return demoPage;
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
      menu: {
        include: {
          items: {
            orderBy: { order: "asc" },
          },
        },
      },
    },
  });

  if (!qrCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="text-5xl">&#x2753;</div>
          <h1 className="text-2xl font-bold text-gray-900">QR-код не найден</h1>
          <p className="text-gray-500">Проверьте правильность кода или обратитесь к администратору.</p>
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

  if (qrCode.mode === "BUSINESS_CARD") {
    if (!qrCode.businessCard) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center space-y-4">
            <div className="text-5xl">&#x1F4CB;</div>
            <h1 className="text-2xl font-bold text-gray-900">Визитка не настроена</h1>
            <p className="text-gray-500">Владелец ещё не заполнил данные визитки.</p>
          </div>
        </div>
      );
    }

    await prisma.qRCode.update({
      where: { id: qrCode.id },
      data: { scansCount: { increment: 1 } },
    });

    const bc = qrCode.businessCard;
    const showContactForm = bc.contactEnabled && !!bc.contactMessengerId;

    const safeCard = {
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
      theme: bc.theme,
      accentColor: bc.accentColor,
    };

    const BusinessCardView = (await import("@/components/scan/BusinessCardView")).default;
    return (
      <BusinessCardView card={safeCard} qrCode={id} showContactForm={showContactForm} />
    );
  }

  if (qrCode.mode === "FILE") {
    if (!qrCode.fileAsset) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center space-y-4">
            <div className="text-5xl">&#x1F4C1;</div>
            <h1 className="text-2xl font-bold text-gray-900">Файл не загружен</h1>
            <p className="text-gray-500">Владелец ещё не прикрепил документ к этому QR-коду.</p>
          </div>
        </div>
      );
    }

    await prisma.qRCode.update({
      where: { id: qrCode.id },
      data: { scansCount: { increment: 1 } },
    });

    const FileDownloadView = (await import("@/components/scan/FileDownloadView")).default;
    return (
      <FileDownloadView
        file={JSON.parse(JSON.stringify(qrCode.fileAsset))}
        establishmentName={qrCode.establishment?.name}
      />
    );
  }

  if (qrCode.mode === "MENU") {
    if (!qrCode.menu) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center space-y-4">
            <div className="text-5xl">&#x2615;</div>
            <h1 className="text-2xl font-bold text-gray-900">Меню не заполнено</h1>
            <p className="text-gray-500">Владелец ещё не добавил позиции в меню.</p>
          </div>
        </div>
      );
    }

    await prisma.qRCode.update({
      where: { id: qrCode.id },
      data: { scansCount: { increment: 1 } },
    });

    const MenuView = (await import("@/components/scan/MenuView")).default;
    return (
      <MenuView
        menu={JSON.parse(JSON.stringify(qrCode.menu))}
        establishmentName={qrCode.establishment?.name}
      />
    );
  }

  if (qrCode.mode === "WIFI") {
    if (!qrCode.wifiConfig) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center space-y-4">
            <div className="text-5xl">&#x1F4F6;</div>
            <h1 className="text-2xl font-bold text-gray-900">Wi-Fi не настроен</h1>
            <p className="text-gray-500">Владелец ещё не настроил параметры Wi-Fi.</p>
          </div>
        </div>
      );
    }

    await prisma.qRCode.update({
      where: { id: qrCode.id },
      data: { scansCount: { increment: 1 } },
    });

    const WifiConnect = (await import("@/components/scan/WifiConnect")).default;
    return <WifiConnect wifiConfig={JSON.parse(JSON.stringify(qrCode.wifiConfig))} />;
  }

  if (!qrCode.establishment) {
    redirect(`/activate/${id}`);
  }

  const ScanFlow = (await import("@/components/scan/ScanFlow")).default;

  const est = qrCode.establishment;
  const sub = est.user.subscriptions[0];
  const isPro = sub?.plan === "PRO";

  let redirectUrl = est.yandexMapsUrl || "";
  if (isPro && est.platformRotation) {
    const urls = [est.yandexMapsUrl, est.twoGisUrl, est.avitoUrl].filter(Boolean) as string[];
    redirectUrl = getRotatedUrl(urls) || redirectUrl;
  }

  let promoCode: string | undefined;
  if (isPro && est.promocodes.length > 0) {
    promoCode = est.promocodes[0].code;
  }

  return (
    <ScanFlow
      establishmentName={est.name}
      establishmentId={est.id}
      qrCodeId={qrCode.id}
      redirectUrl={redirectUrl}
      watermarkEnabled={isPro ? !est.watermarkEnabled : true}
      showPromo={isPro && !!promoCode}
      promoCode={promoCode}
    />
  );
}
