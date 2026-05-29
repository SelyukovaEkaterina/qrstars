import type {
  BusinessCard,
  Establishment,
  QRCode,
  QRMenu,
  WifiConfig,
} from "@/generated/prisma/client";

type MenuWithItems = QRMenu & {
  items: { order: number }[];
};

type EstablishmentWithContent = Establishment & {
  menu?: (QRMenu & { items: unknown[] }) | null;
  businessCard?: BusinessCard | null;
  wifiConfig?: WifiConfig | null;
};

type QRWithContent = QRCode & {
  menu?: MenuWithItems | null;
  businessCard?: BusinessCard | null;
  wifiConfig?: WifiConfig | null;
};

export function resolveMenu(
  establishment: EstablishmentWithContent | null | undefined,
  qrCode: QRWithContent | null | undefined
) {
  return establishment?.menu ?? qrCode?.menu ?? null;
}

export function resolveBusinessCard(
  establishment: EstablishmentWithContent | null | undefined,
  qrCode: QRWithContent | null | undefined
) {
  return establishment?.businessCard ?? qrCode?.businessCard ?? null;
}

export function resolveWifiConfig(
  establishment: EstablishmentWithContent | null | undefined,
  qrCode: QRWithContent | null | undefined
) {
  return establishment?.wifiConfig ?? qrCode?.wifiConfig ?? null;
}

export { resolveTipsConfig } from "@/lib/tips-config";
