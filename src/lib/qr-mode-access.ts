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

/**
 * Публичный показ микросайта: PRO/Сеть, grandfathered QR или владелец, у
 * которого платный доступ был раньше (оплата или пробный PRO) — его страница
 * остаётся опубликованной, чтобы напечатанные таблички продолжали работать.
 */
export function canViewLandingPage(opts: {
  hasPaidFeatures: boolean;
  grandfathered?: boolean | null;
  hadPaidAccess?: boolean | null;
}): boolean {
  return (
    opts.hasPaidFeatures || opts.grandfathered === true || opts.hadPaidAccess === true
  );
}

/**
 * Микросайт заморожен: платный доступ закончился (оплата или триал), гостям
 * страница открывается, но состав плиток и брендинг менять нельзя — это
 * PRO-настройки. Контент разделов (меню, визитка, Wi-Fi, отзывы) остаётся
 * доступным, он нужен для бесплатных QR. Legacy-микросайты
 * (`landingGrandfathered`) не замораживаются — они и раньше правились на FREE.
 */
export function isMicrositeFrozen(opts: {
  hasPaidFeatures: boolean;
  grandfathered?: boolean | null;
  hadPaidAccess?: boolean | null;
}): boolean {
  if (opts.hasPaidFeatures) return false;
  if (opts.grandfathered === true) return false;
  return opts.hadPaidAccess === true;
}

export const MICROSITE_FROZEN_ERROR =
  "Платный доступ закончился: микросайт продолжает работать, но менять разделы и оформление можно на тарифе PRO";

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
  const [legacy, est] = await Promise.all([
    prisma.qRCode.findFirst({
      where: { establishmentId, landingGrandfathered: true },
      select: { id: true },
    }),
    prisma.establishment.findUnique({
      where: { id: establishmentId },
      select: { user: { select: { firstPaidAccessAt: true } } },
    }),
  ]);
  return !!legacy || !!est?.user.firstPaidAccessAt;
}
