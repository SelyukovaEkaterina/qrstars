export interface OnboardingQRCode {
  id: string;
  establishmentId: string | null;
  isActive: boolean;
}

/** Выбирает непривязанный QR для автопривязки при создании первой организации. */
export function pickAutoLinkQrId(
  qrcodes: OnboardingQRCode[],
  preferredQrId?: string | null
): string | undefined {
  const unlinked = qrcodes.filter((q) => !q.establishmentId && !q.isActive);
  if (preferredQrId && unlinked.some((q) => q.id === preferredQrId)) {
    return preferredQrId;
  }
  if (unlinked.length === 1) {
    return unlinked[0].id;
  }
  return undefined;
}
