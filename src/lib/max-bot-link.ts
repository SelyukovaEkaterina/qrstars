import {
  DEFAULT_MAX_BOT_URL,
  establishmentLinkCode,
  getMaxBotUrl,
  messengerLinkCode,
} from "@/lib/messenger-linking";

export { DEFAULT_MAX_BOT_URL };

/** Открывает бота MAX без ?start= — deep link max.ru с start ломается, код отправляют вручную. */
export function maxBotDeepLink(_linkCode: string, baseUrl?: string | null): string | null {
  const url = getMaxBotUrl(baseUrl);
  return url || null;
}

export function maxMessengerLinkCode(userId: string): string {
  return messengerLinkCode(userId);
}

export function maxMessengerDeepLink(userId: string, baseUrl?: string | null): string | null {
  return maxBotDeepLink(messengerLinkCode(userId), baseUrl);
}

export function maxEstablishmentLinkCode(establishmentId: string): string {
  return establishmentLinkCode(establishmentId);
}

export function maxEstablishmentDeepLink(establishmentId: string, baseUrl?: string | null): string | null {
  return maxBotDeepLink(establishmentLinkCode(establishmentId), baseUrl);
}
