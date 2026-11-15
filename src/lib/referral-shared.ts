/**
 * «Приведи друга»: константы и чистые функции без серверных зависимостей
 * (можно импортировать в клиентские компоненты и юнит-тесты).
 */

/** Сколько дней PRO получают друг (сверх оплаченного) и пригласивший. */
export const REFERRAL_BONUS_DAYS = 30;

/** `ivan@mail.ru` → `i***@mail.ru`: пригласивший не должен видеть чужие ПД. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

/** Сколько миллисекунд подарочной подписки осталось — переносится в оплаченный период. */
export function giftRemainingMs(
  sub: { giftReason: string | null; currentPeriodEnd: Date | null } | null | undefined,
  now = new Date()
): number {
  if (!sub?.giftReason || !sub.currentPeriodEnd) return 0;
  return Math.max(0, sub.currentPeriodEnd.getTime() - now.getTime());
}
