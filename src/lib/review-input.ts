/**
 * Проверка тела `POST /api/reviews`. Раньше поля писались как есть: длинная
 * жалоба не доходила в Telegram (лимит 4096), а `rating: 4.5` или строковый
 * `isNegative` роняли Prisma с 500.
 */

export const REVIEW_COMMENT_MAX = 2000;
export const REVIEW_GUEST_NAME_MAX = 100;
/** Телефон, @telegram или email — всё в одном поле. */
export const REVIEW_GUEST_CONTACT_MAX = 120;

export interface ReviewInput {
  establishmentId: string;
  qrCodeId: string | null;
  rating: number;
  comment: string | null;
  guestName: string | null;
  guestPhone: string | null;
  isNegative: boolean;
  pdConsentGiven: boolean;
}

function optionalText(value: unknown, max: number): string | null | false {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length > max) return false;
  return trimmed || null;
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 64;
}

export function parseReviewInput(
  body: Record<string, unknown> | null | undefined,
): { ok: true; data: ReviewInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Некорректный запрос" };

  if (!isId(body.establishmentId) || body.rating === undefined || body.rating === null) {
    return { ok: false, error: "Missing required fields" };
  }
  const rating = body.rating;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Неверная оценка" };
  }
  if (body.qrCodeId !== undefined && body.qrCodeId !== null && !isId(body.qrCodeId)) {
    return { ok: false, error: "Некорректный QR-код" };
  }

  const comment = optionalText(body.comment, REVIEW_COMMENT_MAX);
  if (comment === false) {
    return { ok: false, error: `Комментарий — до ${REVIEW_COMMENT_MAX} символов` };
  }
  const guestName = optionalText(body.guestName, REVIEW_GUEST_NAME_MAX);
  if (guestName === false) {
    return { ok: false, error: `Имя — до ${REVIEW_GUEST_NAME_MAX} символов` };
  }
  const guestPhone = optionalText(body.guestPhone, REVIEW_GUEST_CONTACT_MAX);
  if (guestPhone === false) {
    return { ok: false, error: `Контакт — до ${REVIEW_GUEST_CONTACT_MAX} символов` };
  }

  return {
    ok: true,
    data: {
      establishmentId: body.establishmentId,
      qrCodeId: isId(body.qrCodeId) ? body.qrCodeId : null,
      rating,
      comment,
      guestName,
      guestPhone,
      isNegative: body.isNegative === true,
      pdConsentGiven: body.pdConsentGiven === true,
    },
  };
}
