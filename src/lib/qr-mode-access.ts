import prisma from "@/lib/prisma";
import { establishmentHasPaidFeatures } from "@/lib/establishment-access";
import { userHasPaidFeatures } from "@/lib/subscription-utils";

export const LANDING_MODE = "LANDING";

export const LANDING_UPGRADE_ERROR =
  "Микросайт доступен на тарифах PRO и «Сеть»";

export type LandingAccessDenied = {
  ok: false;
  error: string;
  upgradeRequired: "PRO";
};

export type LandingAssignResult = { ok: true } | LandingAccessDenied;

export function landingDenied(): LandingAccessDenied {
  return {
    ok: false,
    error: LANDING_UPGRADE_ERROR,
    upgradeRequired: "PRO",
  };
}

/** Можно ли назначить режим LANDING при создании или переключении QR. */
export function canAssignLandingMode(opts: {
  nextMode: string | null | undefined;
  previousMode?: string | null;
  grandfathered?: boolean;
  hasPaidFeatures: boolean;
}): LandingAssignResult {
  if (opts.nextMode !== LANDING_MODE) return { ok: true };
  if (opts.hasPaidFeatures) return { ok: true };
  if (opts.grandfathered) return { ok: true };
  // Редактирование уже существующего LANDING (метка, шаблон) на FREE.
  if (opts.previousMode === LANDING_MODE) return { ok: true };
  return landingDenied();
}

/** Публичный показ микросайта: PRO/Сеть или grandfathered QR. */
export function canViewLandingPage(opts: {
  hasPaidFeatures: boolean;
  grandfathered?: boolean | null;
}): boolean {
  return opts.hasPaidFeatures || opts.grandfathered === true;
}

export async function resolveLandingPaidAccess(opts: {
  userId: string;
  establishmentId?: string | null;
}): Promise<boolean> {
  if (opts.establishmentId) {
    return establishmentHasPaidFeatures(opts.establishmentId);
  }
  return userHasPaidFeatures(opts.userId);
}

export async function assertCanAssignLandingMode(opts: {
  userId: string;
  establishmentId?: string | null;
  nextMode: string | null | undefined;
  previousMode?: string | null;
  grandfathered?: boolean;
}): Promise<LandingAssignResult> {
  if (opts.nextMode !== LANDING_MODE) return { ok: true };
  const paid = await resolveLandingPaidAccess({
    userId: opts.userId,
    establishmentId: opts.establishmentId,
  });
  return canAssignLandingMode({
    nextMode: opts.nextMode,
    previousMode: opts.previousMode,
    grandfathered: opts.grandfathered,
    hasPaidFeatures: paid,
  });
}

/** Короткий URL /a/[slug] — микросайт заведения. */
export async function establishmentCanShowPublicLanding(
  establishmentId: string,
  hasPaidFeatures: boolean
): Promise<boolean> {
  if (hasPaidFeatures) return true;
  const legacy = await prisma.qRCode.findFirst({
    where: { establishmentId, landingGrandfathered: true },
    select: { id: true },
  });
  return !!legacy;
}
