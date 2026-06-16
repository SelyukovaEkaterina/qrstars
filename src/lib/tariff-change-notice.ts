import prisma from "@/lib/prisma";

const MS_DAY = 24 * 60 * 60 * 1000;

export const TARIFF_CHANGE_EFFECTIVE_KEY = "tariff_change_effective_at";
export const TARIFF_CHANGE_MESSAGE_KEY = "tariff_change_message";
export const TARIFF_CHANGE_EMAILS_SENT_KEY = "tariff_change_emails_sent_at";

export type PlatformTariffChangeBanner = {
  effectiveAt: string;
  message: string | null;
  daysUntilEffective: number;
};

export async function getPlatformTariffChangeBanner(): Promise<PlatformTariffChangeBanner | null> {
  const meta = await prisma.platformMeta.findUnique({
    where: { key: TARIFF_CHANGE_EFFECTIVE_KEY },
  });
  if (!meta?.value) return null;

  const effectiveAt = new Date(meta.value);
  if (Number.isNaN(effectiveAt.getTime())) return null;

  const now = Date.now();
  const effectiveMs = effectiveAt.getTime();
  if (effectiveMs <= now) return null;

  const daysUntil = Math.ceil((effectiveMs - now) / MS_DAY);
  if (daysUntil > 7) return null;

  const msgMeta = await prisma.platformMeta.findUnique({
    where: { key: TARIFF_CHANGE_MESSAGE_KEY },
  });

  return {
    effectiveAt: effectiveAt.toISOString(),
    message: msgMeta?.value ?? null,
    daysUntilEffective: daysUntil,
  };
}

export function tariffChangeEmailWindow(now: Date): { start: Date; end: Date } {
  return {
    start: new Date(now.getTime() + 6 * MS_DAY),
    end: new Date(now.getTime() + 8 * MS_DAY),
  };
}
