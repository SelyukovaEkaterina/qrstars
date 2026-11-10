import prisma from "@/lib/prisma";
import { invalidateEstablishmentCache, invalidateScanCache } from "@/lib/cache";

/**
 * Сброс кэша скана (`scan:{code}`, 60 с) после правки контента проекта.
 * Раньше его сбрасывали только микросайт и карточка QR: владелец менял меню,
 * сразу сканировал и видел старую версию — «не сохранилось».
 *
 * Для DELETE цели собираем до удаления (после него связи уже не найти).
 */
export type ContentCacheKind = "menu" | "businessCard" | "wifiConfig" | "customPage" | "form";

export interface CacheTargets {
  establishmentIds: string[];
  codes: string[];
}

const EMPTY: CacheTargets = { establishmentIds: [], codes: [] };

function targets(
  estIds: (string | null | undefined)[],
  qrcodes: { code: string; establishmentId: string | null }[],
): CacheTargets {
  return {
    establishmentIds: [
      ...new Set(
        [...estIds, ...qrcodes.map((q) => q.establishmentId)].filter(
          (v): v is string => typeof v === "string" && !!v,
        ),
      ),
    ],
    codes: [...new Set(qrcodes.map((q) => q.code))],
  };
}

const qrSelect = { select: { code: true, establishmentId: true } } as const;

export async function collectContentCacheTargets(
  kind: ContentCacheKind,
  id: string | null | undefined,
): Promise<CacheTargets> {
  if (!id) return EMPTY;
  try {
    switch (kind) {
      case "menu": {
        const row = await prisma.qRMenu.findUnique({
          where: { id },
          select: { estId: true, establishment: { select: { id: true } }, qrcodes: qrSelect },
        });
        return row ? targets([row.estId, row.establishment?.id], row.qrcodes) : EMPTY;
      }
      case "businessCard": {
        const row = await prisma.businessCard.findUnique({
          where: { id },
          select: { estId: true, establishment: { select: { id: true } }, qrcodes: qrSelect },
        });
        return row ? targets([row.estId, row.establishment?.id], row.qrcodes) : EMPTY;
      }
      case "wifiConfig": {
        const row = await prisma.wifiConfig.findUnique({
          where: { id },
          select: { estId: true, establishment: { select: { id: true } }, qrcodes: qrSelect },
        });
        return row ? targets([row.estId, row.establishment?.id], row.qrcodes) : EMPTY;
      }
      case "customPage": {
        const row = await prisma.customPage.findUnique({
          where: { id },
          select: { establishmentId: true, qrcodes: qrSelect },
        });
        return row ? targets([row.establishmentId], row.qrcodes) : EMPTY;
      }
      case "form": {
        const row = await prisma.form.findUnique({
          where: { id },
          select: { establishmentId: true, qrcodes: qrSelect },
        });
        return row ? targets([row.establishmentId], row.qrcodes) : EMPTY;
      }
    }
  } catch (err) {
    console.error("collectContentCacheTargets failed", { kind, id, err });
    return EMPTY;
  }
}

export async function invalidateCacheTargets(t: CacheTargets): Promise<void> {
  await Promise.all([
    ...t.establishmentIds.map((estId) => invalidateEstablishmentCache(estId)),
    ...t.codes.map((code) => invalidateScanCache(code)),
  ]);
}

/** Все QR проекта — и те, что не попали в обратный индекс `est_codes:`. */
export async function invalidateEstablishmentScans(establishmentId: string): Promise<void> {
  try {
    const qrs = await prisma.qRCode.findMany({ where: { establishmentId }, select: { code: true } });
    await invalidateCacheTargets({ establishmentIds: [establishmentId], codes: qrs.map((q) => q.code) });
  } catch (err) {
    console.error("invalidateEstablishmentScans failed", { establishmentId, err });
  }
}

/** Fire-and-forget после успешного create/update. Никогда не бросает. */
export function invalidateContentCache(kind: ContentCacheKind, id: string | null | undefined): void {
  void collectContentCacheTargets(kind, id)
    .then(invalidateCacheTargets)
    .catch(() => {});
}
