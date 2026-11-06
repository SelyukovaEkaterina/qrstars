import type { Establishment, QRCode, Review } from "@/generated/prisma/client";
import { getAppBaseUrl, scanUrlForCode } from "@/lib/utils";

/**
 * Публичные формы объектов API v1. Поля — контракт для внешних интеграций:
 * переименовывать нельзя, только добавлять.
 */

export function serializeProject(
  e: Pick<
    Establishment,
    | "id"
    | "name"
    | "industry"
    | "address"
    | "phone"
    | "yandexMapsUrl"
    | "twoGisUrl"
    | "avitoUrl"
    | "shortSlug"
    | "userId"
    | "createdAt"
  >,
  userId: string,
  counts?: { qrcodes: number; reviews: number; totalScans: number }
) {
  return {
    id: e.id,
    name: e.name,
    industry: e.industry,
    address: e.address,
    phone: e.phone,
    yandexMapsUrl: e.yandexMapsUrl,
    twoGisUrl: e.twoGisUrl,
    avitoUrl: e.avitoUrl,
    micrositeUrl: e.shortSlug ? `${getAppBaseUrl()}/a/${e.shortSlug}` : null,
    role: e.userId === userId ? "owner" : "member",
    ...(counts ?? {}),
    createdAt: e.createdAt.toISOString(),
    dashboardUrl: `${getAppBaseUrl()}/dashboard/projects/${e.id}`,
  };
}

export function serializeQrCode(
  q: Pick<
    QRCode,
    | "id"
    | "code"
    | "label"
    | "mode"
    | "redirectUrl"
    | "isActive"
    | "establishmentId"
    | "scansCount"
    | "createdAt"
    | "updatedAt"
  >
) {
  const base = getAppBaseUrl();
  return {
    id: q.id,
    code: q.code,
    label: q.label,
    mode: q.mode,
    redirectUrl: q.redirectUrl,
    isActive: q.isActive,
    projectId: q.establishmentId,
    scanUrl: scanUrlForCode(q.code),
    imageUrl: `${base}/api/v1/qrcodes/${q.id}/image`,
    scansCount: q.scansCount,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

export function serializeReview(
  r: Pick<
    Review,
    | "id"
    | "rating"
    | "comment"
    | "guestName"
    | "guestPhone"
    | "isNegative"
    | "isProcessed"
    | "establishmentId"
    | "qrCodeId"
    | "createdAt"
  >
) {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    guestName: r.guestName,
    guestContact: r.guestPhone,
    isNegative: r.isNegative,
    isProcessed: r.isProcessed,
    projectId: r.establishmentId,
    qrCodeId: r.qrCodeId,
    createdAt: r.createdAt.toISOString(),
  };
}
