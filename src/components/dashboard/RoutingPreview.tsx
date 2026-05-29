"use client";

import { Smartphone } from "lucide-react";
import MicroLandingView from "@/components/scan/MicroLandingView";
import MenuView from "@/components/scan/MenuView";
import type { MenuData } from "@/components/dashboard/MenuEditor";
import type { PageModules } from "@/lib/page-modules";
import type { ReviewRoutingConfig } from "@/lib/review-routing";
import { DEFAULT_REVIEW_ROUTING } from "@/lib/review-routing";
import type { RoutingGroup, SectionTarget } from "@/lib/qr-routing";
import { isBuiltinSection } from "@/lib/qr-routing";

interface RoutingPreviewProps {
  routingGroup: RoutingGroup;
  section?: SectionTarget;
  establishmentName: string;
  establishmentId?: string;
  pageModules?: PageModules;
  menu?: MenuData | null;
  redirectUrl?: string;
  hasFile?: boolean;
  customPageLabel?: string | null;
}

export default function RoutingPreview({
  routingGroup,
  section,
  establishmentName,
  establishmentId,
  pageModules,
  menu,
  redirectUrl,
  hasFile,
  customPageLabel,
}: RoutingPreviewProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Smartphone className="w-4 h-4" />
        <span>Предпросмотр для гостя</span>
      </div>
      <div className="mx-auto w-[280px] rounded-[2rem] border-[6px] border-gray-800 bg-gray-800 p-1 shadow-xl">
        <div className="rounded-[1.4rem] overflow-hidden bg-white min-h-[420px] max-h-[520px] overflow-y-auto">
          {routingGroup === "LANDING" && pageModules && establishmentId && (
            <MicroLandingView
              establishmentName={establishmentName}
              establishmentId={establishmentId}
              qrCodeId="preview"
              pageModules={pageModules}
              moduleOrder={null}
              menu={menu ?? null}
              businessCard={null}
              wifiConfig={null}
              reviewRouting={DEFAULT_REVIEW_ROUTING}
              customPages={[]}
              platformUrls={{
                yandexMapsUrl: null,
                twoGisUrl: null,
                avitoUrl: null,
              }}
              watermarkEnabled
              embedded
            />
          )}
          {routingGroup === "SECTION" && section === "MENU" && menu && (
            <MenuView menu={menu} establishmentName={establishmentName} embedded />
          )}
          {routingGroup === "SECTION" && section === "REVIEW" && (
            <div className="p-6 text-center space-y-3">
              <p className="font-semibold text-gray-900">{establishmentName}</p>
              <p className="text-sm text-gray-500">Оцените нас</p>
              <div className="flex justify-center gap-1 text-2xl text-amber-400">
                ★★★★★
              </div>
            </div>
          )}
          {routingGroup === "SECTION" &&
            (section === "BUSINESS_CARD" || section === "WIFI" || section === "TIPS") && (
              <SectionPlaceholder section={section} />
            )}
          {routingGroup === "SECTION" && section && !isBuiltinSection(section) && (
            <div className="p-6 text-center space-y-2">
              <p className="text-4xl">📄</p>
              <p className="font-medium text-gray-900">
                {customPageLabel || "Кастомная страница"}
              </p>
              <p className="text-xs text-gray-400">Контент из «Моей страницы»</p>
            </div>
          )}
          {routingGroup === "REDIRECT" && (
            <div className="p-6 text-center space-y-3">
              <p className="text-sm text-gray-500">Перенаправление на</p>
              <p className="text-xs font-mono text-indigo-600 break-all">
                {redirectUrl || "https://..."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionPlaceholder({
  section,
}: {
  section: "BUSINESS_CARD" | "WIFI" | "TIPS";
}) {
  const labels: Record<typeof section, string> = {
    BUSINESS_CARD: "Визитка",
    WIFI: "Wi-Fi",
    TIPS: "Чаевые",
  };
  return (
    <div className="p-6 text-center space-y-2">
      <p className="font-medium text-gray-900">
        {labels[section]}
      </p>
      <p className="text-xs text-gray-400">Контент из «Моей страницы»</p>
    </div>
  );
}
