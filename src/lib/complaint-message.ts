/** Доп. поля уведомления о жалобе в Telegram / MAX. */
export interface ComplaintMessageExtra {
  /** Телефон / @telegram / email гостя. */
  guestContact?: string;
  /** Метка или код QR, с которого пришла жалоба. */
  qrLabel?: string;
  /** Ссылка на «Обратную связь» проекта в кабинете. */
  inboxUrl?: string;
}

/** Лимит сообщения Telegram — 4096 символов, оставляем запас под шапку. */
export const COMPLAINT_MESSAGE_COMMENT_MAX = 3000;

export function truncateComment(comment: string, max = COMPLAINT_MESSAGE_COMMENT_MAX): string {
  return comment.length > max ? `${comment.slice(0, max)}…` : comment;
}
