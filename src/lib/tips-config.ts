export type TipsMode = "REDIRECT" | "PHONE" | "EMPLOYEES";

export interface ResolvedTipsConfig {
  tipsType: TipsMode;
  tipsPhone: string | null;
  tipsBankName: string | null;
  tipsUrl: string | null;
}

type EstablishmentTipsFields = {
  landingTipsType?: string | null;
  landingTipsPhone?: string | null;
  landingTipsBankName?: string | null;
  landingTipsUrl?: string | null;
};

type QrTipsFields = {
  tipsType?: string | null;
  tipsPhone?: string | null;
  tipsBankName?: string | null;
  redirectUrl?: string | null;
};

function normalizeTipsType(raw: string | null | undefined): TipsMode | null {
  if (raw === "REDIRECT" || raw === "PHONE" || raw === "EMPLOYEES") return raw;
  return null;
}

/** Контент чаевых: сначала заведение, fallback — старые поля QR. */
export function resolveTipsConfig(
  establishment: EstablishmentTipsFields | null | undefined,
  qrCode?: QrTipsFields | null
): ResolvedTipsConfig | null {
  if (establishment?.landingTipsType) {
    const tipsType = normalizeTipsType(establishment.landingTipsType);
    if (!tipsType) return null;
    return {
      tipsType,
      tipsPhone: establishment.landingTipsPhone ?? null,
      tipsBankName: establishment.landingTipsBankName ?? null,
      tipsUrl: establishment.landingTipsUrl ?? null,
    };
  }

  const tipsType = normalizeTipsType(qrCode?.tipsType);
  if (!tipsType) return null;

  return {
    tipsType,
    tipsPhone: qrCode?.tipsPhone ?? null,
    tipsBankName: qrCode?.tipsBankName ?? null,
    tipsUrl: tipsType === "REDIRECT" ? qrCode?.redirectUrl ?? null : null,
  };
}

export interface LandingTipsPayload {
  landingTipsType: TipsMode | null;
  landingTipsPhone: string | null;
  landingTipsBankName: string | null;
  landingTipsUrl: string | null;
}

export function validateLandingTips(payload: LandingTipsPayload): string | null {
  if (!payload.landingTipsType) return null;
  if (payload.landingTipsType === "REDIRECT" && !payload.landingTipsUrl?.trim()) {
    return "Укажите URL сервиса чаевых";
  }
  if (payload.landingTipsType === "PHONE" && !payload.landingTipsPhone?.trim()) {
    return "Укажите номер телефона для чаевых";
  }
  return null;
}
